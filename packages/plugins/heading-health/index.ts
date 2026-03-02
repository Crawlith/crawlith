
import { createHash } from 'node:crypto';
import type { CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from '@crawlith/core';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
interface HeadingNode { level: HeadingLevel; text: string; index: number; parentIndex?: number; }
interface SectionMetrics { headingIndex: number; headingText: string; words: number; keywordConcentration: number; thin: boolean; duplicateRisk: number; }
interface HeadingHealth { score: number; status: 'Healthy' | 'Moderate' | 'Poor'; issues: string[]; }
interface LocalPageAnalysis {
  url: string; headingNodes: HeadingNode[]; sections: SectionMetrics[]; h1Norm: string; h2SetHash: string; patternHash: string; issues: string[];
  metrics: { entropy: number; maxDepth: number; avgDepth: number; headingDensity: number; fragmentation: number; levelVolatility: number; hierarchySkips: number; reverseJumps: number; missingH1: number; multipleH1: number; };
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'about', 'into', 'over', 'under', 'are', 'was', 'were', 'can', 'has', 'have', 'had', 'you', 'our', 'out', 'all']);
const THIN_SECTION_WORDS = 80;
const HEADING_PATTERN = /<h([1-6])\b[^<>]*>([\s\S]*?)<\/h\1>/gi;
const TITLE_PATTERN = /<title\b[^<>]*>([\s\S]*?)<\/title>/i;

const normalizeText = (input: string) => input.replace(/<[^<>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const normalizeComparable = (input: string) => normalizeText(input).toLowerCase();
const tokenize = (input: string) => normalizeComparable(input).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
const stableHash = (input: string) => createHash('sha1').update(input).digest('hex').slice(0, 16);

function jaccardSimilarity(a: string, b: string): number {
  const aSet = new Set(tokenize(a));
  const bSet = new Set(tokenize(b));
  if (!aSet.size || !bSet.size) return 0;
  let intersection = 0;
  for (const token of aSet) if (bSet.has(token)) intersection++;
  return intersection / (aSet.size + bSet.size - intersection);
}

function entropy(values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return values.reduce((sum, value) => value === 0 ? sum : sum - (value / total) * Math.log2(value / total), 0);
}

function getTitleFromHtml(html: string): string {
  const match = html.match(TITLE_PATTERN);
  return match ? normalizeText(match[1]) : '';
}

function extractHeadingSegments(html: string): Array<{ level: HeadingLevel; text: string; start: number; end: number }> {
  const segments: Array<{ level: HeadingLevel; text: string; start: number; end: number }> = [];
  for (const match of html.matchAll(HEADING_PATTERN)) {
    const level = Number(match[1]) as HeadingLevel;
    segments.push({ level, text: normalizeText(match[2] || ''), start: match.index || 0, end: (match.index || 0) + match[0].length });
  }
  return segments;
}

function computeHeadingNodes(segments: Array<{ level: HeadingLevel; text: string }>): HeadingNode[] {
  const nodes: HeadingNode[] = [];
  const stack: HeadingNode[] = [];
  segments.forEach((segment, index) => {
    const node: HeadingNode = { level: segment.level, text: segment.text, index };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) stack.pop();
    if (stack.length > 0) node.parentIndex = stack[stack.length - 1].index;
    stack.push(node);
    nodes.push(node);
  });
  return nodes;
}

function computeSectionsFromSegments(html: string, headingNodes: HeadingNode[], segments: Array<{ text: string; start: number; end: number }>): SectionMetrics[] {
  const sections: SectionMetrics[] = [];
  const allWords = tokenize(normalizeText(html));
  const frequency = new Map<string, number>();
  for (const word of allWords) frequency.set(word, (frequency.get(word) || 0) + 1);

  for (let i = 0; i < segments.length; i++) {
    const current = segments[i];
    const next = segments[i + 1];
    const textChunk = html.slice(current.end, next ? next.start : html.length);
    const words = tokenize(textChunk);
    const headingTokens = tokenize(current.text);
    const concentration = headingTokens.reduce((sum, token) => sum + (frequency.get(token) || 0), 0);
    sections.push({
      headingIndex: headingNodes[i]?.index ?? i,
      headingText: current.text,
      words: words.length,
      keywordConcentration: words.length > 0 ? Number((concentration / words.length).toFixed(3)) : 0,
      thin: words.length > 0 && words.length < THIN_SECTION_WORDS,
      duplicateRisk: 0
    });
  }
  return sections;
}

function analyzePage(html: string, fallbackTitle?: string): LocalPageAnalysis {
  const segments = extractHeadingSegments(html);
  const headingNodes = computeHeadingNodes(segments);
  const sections = computeSectionsFromSegments(html, headingNodes, segments);

  const levelCounts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < headingNodes.length; i++) {
    levelCounts[headingNodes[i].level - 1]++;
  }

  const entropyScore = Number(entropy(levelCounts).toFixed(3));
  const missingH1 = levelCounts[0] === 0 ? 1 : 0;
  const multipleH1 = levelCounts[0] > 1 ? 1 : 0;

  let hierarchySkips = 0; let reverseJumps = 0; let volatilitySum = 0;
  for (let i = 1; i < headingNodes.length; i++) {
    const delta = headingNodes[i].level - headingNodes[i - 1].level;
    volatilitySum += Math.abs(delta);
    if (delta > 1) hierarchySkips++;
    if (delta < -1) reverseJumps++;
  }

  const maxDepth = headingNodes.length ? Math.max(...headingNodes.map((n) => n.level)) : 0;
  const avgDepth = headingNodes.length ? Number((headingNodes.reduce((sum, node) => sum + node.level, 0) / headingNodes.length).toFixed(2)) : 0;
  const pageWords = tokenize(html).length;
  const headingDensity = pageWords ? Number((headingNodes.length / pageWords).toFixed(4)) : 0;
  const fragmentation = headingNodes.length ? Number((headingNodes.filter((n) => n.level <= 2).length / headingNodes.length).toFixed(3)) : 0;
  const levelVolatility = headingNodes.length > 1 ? Number((volatilitySum / (headingNodes.length - 1)).toFixed(3)) : 0;

  const issues: string[] = [];
  const h1Nodes = headingNodes.filter((node) => node.level === 1);
  if (missingH1) issues.push('Missing H1');
  if (multipleH1) issues.push('Multiple H1 found');
  if (h1Nodes.some((node) => node.text.length < 6)) issues.push('Empty or near-empty H1');
  const title = fallbackTitle || getTitleFromHtml(html);
  if (title && h1Nodes[0] && jaccardSimilarity(title, h1Nodes[0].text) < 0.3) issues.push('H1 diverges from <title>');
  if (hierarchySkips > 0) issues.push(`${hierarchySkips} hierarchy skips detected`);
  if (reverseJumps > 0) issues.push(`${reverseJumps} reverse hierarchy jumps detected`);
  for (const thin of sections.filter((s) => s.thin).slice(0, 2)) issues.push(`Thin section under "${thin.headingText || 'Untitled heading'}"`);
  if (entropyScore > 2.1) issues.push('High structural entropy');
  if (fragmentation > 0.65) issues.push('Section fragmentation is high');

  const h1Norm = normalizeComparable(h1Nodes[0]?.text || '');
  const h2SetHash = stableHash(headingNodes.filter((n) => n.level === 2).map((n) => normalizeComparable(n.text)).filter(Boolean).sort().join('|'));
  const patternHash = stableHash(headingNodes.map((n) => n.level).join('>'));

  return { url: '', headingNodes, sections, h1Norm, h2SetHash, patternHash, issues, metrics: { entropy: entropyScore, maxDepth, avgDepth, headingDensity, fragmentation, levelVolatility, hierarchySkips, reverseJumps, missingH1, multipleH1 } };
}

function scoreHealth(input: { metrics: LocalPageAnalysis['metrics']; thinSectionCount: number; duplicateH1GroupSize: number; similarH1GroupSize: number; identicalH2SetGroupSize: number; duplicatePatternGroupSize: number; templateRisk: number; issues: string[]; }): HeadingHealth {
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

const computeTemplateRisk = (similar: number, h2set: number, pattern: number) => Number(Math.max(0, Math.min(1, ((similar - 1) * 0.15) + ((h2set - 1) * 0.2) + ((pattern - 1) * 0.2))).toFixed(3));

function enrichDuplicateRisk(pages: LocalPageAnalysis[]): void {
  const buckets = new Map<string, string[]>();
  for (const page of pages) for (const section of page.sections) {
    const key = stableHash(`${normalizeComparable(section.headingText)}:${section.words}`);
    const bucket = buckets.get(key) || [];
    bucket.push(page.url);
    buckets.set(key, bucket);
  }
  for (const page of pages) for (const section of page.sections) {
    const key = stableHash(`${normalizeComparable(section.headingText)}:${section.words}`);
    const size = (buckets.get(key) || []).length;
    section.duplicateRisk = Number(Math.min(1, (size - 1) / 5).toFixed(3));
  }
}

/**
 * Heading Health Plugin
 * Crawlith plugin for heading health
 */
export const HeadingHealthPlugin: CrawlithPlugin = {
  name: 'heading-health',
  register: (cli: Command) => {
    if (cli.name() === 'crawl' || cli.name() === 'page') {
      cli.option('--heading', 'Analyze heading structure');
    }
  },

  hooks: {
    onMetrics: async (ctx: PluginContext, graph: any) => {
      const flags = ctx.flags || {};
      if (!flags.heading) return;

      const analyzedPages: LocalPageAnalysis[] = [];
      const nodes = graph.getNodes();

      for (const node of nodes) {
        if (node.status < 200 || node.status >= 300 || !node.html) continue;
        const analysis = analyzePage(node.html, node.title || (node as any).rawTitle);
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
      const uniqueH1 = Array.from(new Set(analyzedPages.map((p) => p.h1Norm).filter(Boolean)));
      const similarBuckets = new Map<string, Set<string>>();
      for (const h1 of uniqueH1) similarBuckets.set(h1, new Set([h1]));
      for (let i = 0; i < uniqueH1.length; i++) for (let j = i + 1; j < uniqueH1.length; j++) {
        const a = uniqueH1[i]; const b = uniqueH1[j];
        if (jaccardSimilarity(a, b) >= 0.7) { similarBuckets.get(a)?.add(b); similarBuckets.get(b)?.add(a); }
      }
      for (const page of analyzedPages) similarH1GroupSizes.set(page.url, similarBuckets.get(page.h1Norm)?.size || (page.h1Norm ? 1 : 0));

      let totalScore = 0, totalMissing = 0, totalMultiple = 0, totalSkips = 0, totalReverseJumps = 0, totalThinSections = 0, totalEntropy = 0, poorPages = 0;

      for (const node of nodes) {
        const page = analyzedPages.find(p => p.url === node.url);
        if (!page) continue;

        const duplicateH1GroupSize = page.h1Norm ? (exactH1Buckets.get(page.h1Norm)?.length || 1) : 0;
        const similarH1GroupSize = similarH1GroupSizes.get(page.url) || 0;
        const identicalH2SetGroupSize = h2SetBuckets.get(page.h2SetHash)?.length || 1;
        const duplicatePatternGroupSize = patternBuckets.get(page.patternHash)?.length || 1;
        const templateRisk = computeTemplateRisk(similarH1GroupSize, identicalH2SetGroupSize, duplicatePatternGroupSize);
        const thinSectionCount = page.sections.filter((s) => s.thin).length;

        const health = scoreHealth({ metrics: page.metrics, thinSectionCount, duplicateH1GroupSize, similarH1GroupSize, identicalH2SetGroupSize, duplicatePatternGroupSize, templateRisk, issues: page.issues });

        if (health.status === 'Poor') poorPages++;
        totalScore += health.score; totalMissing += page.metrics.missingH1; totalMultiple += page.metrics.multipleH1; totalSkips += page.metrics.hierarchySkips; totalReverseJumps += page.metrics.reverseJumps; totalThinSections += thinSectionCount; totalEntropy += page.metrics.entropy;

        (node as any).headingHealth = {
          score: health.score, status: health.status, issues: health.issues, map: page.headingNodes,
          missing_h1: page.metrics.missingH1, multiple_h1: page.metrics.multipleH1,
          entropy: page.metrics.entropy, max_depth: page.metrics.maxDepth, avg_depth: page.metrics.avgDepth,
          heading_density: page.metrics.headingDensity, fragmentation: page.metrics.fragmentation,
          volatility: page.metrics.levelVolatility, hierarchy_skips: page.metrics.hierarchySkips, reverse_jumps: page.metrics.reverseJumps, thin_sections: thinSectionCount,
          duplicate_h1_group: duplicateH1GroupSize, similar_h1_group: similarH1GroupSize, identical_h2_set_group: identicalH2SetGroupSize, duplicate_pattern_group: duplicatePatternGroupSize, template_risk: templateRisk
        };
      }

      const evaluatedPages = analyzedPages.length;
      ctx.metadata = ctx.metadata || {};
      ctx.metadata.headingHealthSummary = {
        avgScore: evaluatedPages ? Math.round(totalScore / evaluatedPages) : 0, evaluatedPages, totalMissing, totalMultiple, totalSkips, totalReverseJumps, totalThinSections,
        avgEntropy: evaluatedPages ? Number((totalEntropy / evaluatedPages).toFixed(3)) : 0, poorPages
      };
    },

    onReport: async (ctx: PluginContext, result: any) => {
      const flags = ctx.flags || {};
      if (!flags.heading) return;

      if (ctx.metadata?.headingHealthSummary) {
        if (!result.plugins) result.plugins = {};
        result.plugins.headingHealth = ctx.metadata.headingHealthSummary;
      }
    }
  }
};

export default HeadingHealthPlugin;
