import { Command, CrawlithPlugin, PluginContext } from '@crawlith/core';
import { analyzeHeadingHealth, enrichDuplicateRisk, jaccardSimilarity } from './src/analyzer.js';
import { LocalPageAnalysis } from './src/types.js';

function scoreHealth(input: {
  metrics: LocalPageAnalysis['metrics'];
  thinSectionCount: number;
  duplicateH1GroupSize: number;
  similarH1GroupSize: number;
  identicalH2SetGroupSize: number;
  duplicatePatternGroupSize: number;
  templateRisk: number;
  issues: string[];
}) {
  let score = 100;
  const m = input.metrics;
  if (m.missingH1) score -= 20;
  if (m.multipleH1) score -= 6;
  score -= m.hierarchySkips * 8;
  score -= m.reverseJumps * 6;
  score -= Math.round(m.entropy * 7);
  score -= Math.round(m.fragmentation * 20);
  score -= Math.round(m.levelVolatility * 6);
  score -= input.thinSectionCount * 4;
  if (input.duplicateH1GroupSize > 1) score -= Math.min(16, (input.duplicateH1GroupSize - 1) * 3);
  if (input.similarH1GroupSize > 1) score -= Math.min(8, (input.similarH1GroupSize - 1) * 2);
  if (input.identicalH2SetGroupSize > 1) score -= Math.min(10, (input.identicalH2SetGroupSize - 1) * 2);
  if (input.duplicatePatternGroupSize > 1) score -= Math.min(12, (input.duplicatePatternGroupSize - 1) * 2);
  score -= Math.round(input.templateRisk * 12);
  score = Math.max(0, Math.min(100, score));
  return { score, status: score >= 80 ? 'Healthy' : score >= 55 ? 'Moderate' : 'Poor', issues: input.issues };
}

const computeTemplateRisk = (similar: number, h2set: number, pattern: number) =>
  Number(Math.max(0, Math.min(1, ((similar - 1) * 0.15) + ((h2set - 1) * 0.2) + ((pattern - 1) * 0.2))).toFixed(3));

export const HeadingHealthPlugin: CrawlithPlugin = {
  name: 'heading-health',
  description: 'Analyzes heading structure, hierarchy health, and content distribution',
  register: (cli: Command) => {
    if (cli.name() === 'crawl' || cli.name() === 'page') {
      cli.option('--heading', 'Analyze heading structure and hierarchy health');
    }
  },
  hooks: {
    onMetrics: async (ctx: PluginContext, graph: any) => {
      if (!ctx.flags?.heading) return;
      const nodes = graph.getNodes();
      const analyzedPages: LocalPageAnalysis[] = [];

      for (const node of nodes) {
        if (node.status < 200 || node.status >= 300 || !node.html) continue;
        const analysis = analyzeHeadingHealth(node.html, node.title || (node as any).rawTitle);
        analysis.url = node.url;
        analyzedPages.push(analysis);
      }

      enrichDuplicateRisk(analyzedPages);

      const exactH1Buckets = new Map<string, string[]>();
      const h2SetBuckets = new Map<string, string[]>();
      const patternBuckets = new Map<string, string[]>();
      for (const page of analyzedPages) {
        if (page.h1Norm) {
          const bucket = exactH1Buckets.get(page.h1Norm) || [];
          bucket.push(page.url);
          exactH1Buckets.set(page.h1Norm, bucket);
        }
        h2SetBuckets.set(page.h2SetHash, [...(h2SetBuckets.get(page.h2SetHash) || []), page.url]);
        patternBuckets.set(page.patternHash, [...(patternBuckets.get(page.patternHash) || []), page.url]);
      }

      const similarH1GroupSizes = new Map<string, number>();
      const uniqueH1 = Array.from(new Set(analyzedPages.map(p => p.h1Norm).filter(Boolean)));
      const similarBuckets = new Map<string, Set<string>>();
      for (const h1 of uniqueH1) similarBuckets.set(h1, new Set([h1]));

      for (let i = 0; i < uniqueH1.length; i++) {
        for (let j = i + 1; j < uniqueH1.length; j++) {
          const a = uniqueH1[i];
          const b = uniqueH1[j];
          if (jaccardSimilarity(a, b) >= 0.7) {
            similarBuckets.get(a)?.add(b);
            similarBuckets.get(b)?.add(a);
          }
        }
      }

      for (const page of analyzedPages) {
        similarH1GroupSizes.set(page.url, similarBuckets.get(page.h1Norm)?.size || (page.h1Norm ? 1 : 0));
      }

      let totalScore = 0, totalMissing = 0, totalMultiple = 0, totalSkips = 0, totalReverseJumps = 0, totalThinSections = 0, totalEntropy = 0, poorPages = 0;

      for (const node of nodes) {
        const page = analyzedPages.find(p => p.url === node.url);
        if (!page) continue;

        const duplicateH1GroupSize = page.h1Norm ? (exactH1Buckets.get(page.h1Norm)?.length || 1) : 0;
        const similarH1GroupSize = similarH1GroupSizes.get(page.url) || 0;
        const identicalH2SetGroupSize = h2SetBuckets.get(page.h2SetHash)?.length || 1;
        const duplicatePatternGroupSize = patternBuckets.get(page.patternHash)?.length || 1;
        const templateRisk = computeTemplateRisk(similarH1GroupSize, identicalH2SetGroupSize, duplicatePatternGroupSize);
        const thinSectionCount = page.sections.filter(s => s.thin).length;

        const health = scoreHealth({
          metrics: page.metrics,
          thinSectionCount,
          duplicateH1GroupSize,
          similarH1GroupSize,
          identicalH2SetGroupSize,
          duplicatePatternGroupSize,
          templateRisk,
          issues: page.issues
        });

        if (health.status === 'Poor') poorPages++;
        totalScore += health.score; totalMissing += page.metrics.missingH1; totalMultiple += page.metrics.multipleH1;
        totalSkips += page.metrics.hierarchySkips; totalReverseJumps += page.metrics.reverseJumps; totalThinSections += thinSectionCount;
        totalEntropy += page.metrics.entropy;

        (node as any).headingHealth = {
          score: health.score, status: health.status, issues: health.issues, map: page.headingNodes,
          missing_h1: page.metrics.missingH1, multiple_h1: page.metrics.multipleH1,
          entropy: page.metrics.entropy, max_depth: page.metrics.max_depth, avg_depth: page.metrics.avgDepth,
          heading_density: page.metrics.headingDensity, fragmentation: page.metrics.fragmentation,
          volatility: page.metrics.levelVolatility, hierarchy_skips: page.metrics.hierarchySkips,
          reverse_jumps: page.metrics.reverseJumps, thin_sections: thinSectionCount,
          duplicate_h1_group: duplicateH1GroupSize, similar_h1_group: similarH1GroupSize,
          identical_h2_set_group: identicalH2SetGroupSize, duplicate_pattern_group: duplicatePatternGroupSize,
          template_risk: templateRisk
        };
      }

      const evaluatedPages = analyzedPages.length;
      ctx.metadata = ctx.metadata || {};
      ctx.metadata.headingHealthSummary = {
        avgScore: evaluatedPages ? Math.round(totalScore / evaluatedPages) : 0,
        evaluatedPages, totalMissing, totalMultiple, totalSkips, totalReverseJumps, totalThinSections,
        avgEntropy: evaluatedPages ? Number((totalEntropy / evaluatedPages).toFixed(3)) : 0,
        poorPages
      };
    },
    onReport: async (ctx: PluginContext, result: any) => {
      if (!ctx.flags?.heading) return;
      if (ctx.metadata?.headingHealthSummary) {
        if (!result.plugins) result.plugins = {};
        result.plugins.headingHealth = ctx.metadata.headingHealthSummary;
      }
    }
  }
};

export default HeadingHealthPlugin;
