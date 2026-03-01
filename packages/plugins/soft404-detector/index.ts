import { CrawlPlugin, PluginContext, CLIWriter, ReportWriter, PluginStore } from '@crawlith/core';
import * as cheerio from 'cheerio';

function analyzeSoft404(html: string, outLinks: number) {
  let soft404Score = 0;
  const soft404Signals: string[] = [];

  const $ = cheerio.load(html);
  $('script, style, noscript, iframe').remove();

  const cleanText = $('body').text().replace(/\s+/g, ' ').trim();
  const title = $('title').text().toLowerCase();
  const h1Text = $('h1').first().text().toLowerCase();
  const bodyText = cleanText.toLowerCase();

  const errorPatterns = ['404', 'not found', 'error', "doesn't exist", 'unavailable', 'invalid'];

  for (const pattern of errorPatterns) {
    if (title.includes(pattern)) {
      soft404Score += 0.4;
      soft404Signals.push(`title:${pattern}`);
      break;
    }
  }

  for (const pattern of errorPatterns) {
    if (h1Text.includes(pattern)) {
      soft404Score += 0.3;
      soft404Signals.push(`h1:${pattern}`);
      break;
    }
  }

  if (bodyText.includes('page not found') || bodyText.includes('404 error')) {
    soft404Score += 0.2;
    soft404Signals.push('phrase:error');
  }

  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 50) {
    soft404Score += 0.3;
    soft404Signals.push('density:very_low');
  } else if (words.length < 150) {
    soft404Score += 0.1;
    soft404Signals.push('density:low');
  }

  if (outLinks === 0) {
    soft404Score += 0.2;
    soft404Signals.push('links:none');
  }

  return {
    score: Math.min(1.0, soft404Score),
    signals: soft404Signals.join(',')
  };
}

export const Soft404DetectorPlugin: CrawlPlugin = {
  name: 'soft404-detector',
  cli: {
    flag: 'soft404',
    description: 'Detect soft 404 pages (status 200 with error content)',
    defaultFor: ['crawl', 'page'],
  },

  storage: {
    perPage: {
      columns: {
        score: 'REAL',
        signals: 'TEXT'
      }
    }
  },

  hooks: {
    async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
      if (!ctx.graph) return;

      let totalSoft404Count = 0;
      let highConfidenceCount = 0;
      let evaluatedPages = 0;

      for (const node of ctx.graph.getNodes()) {
        if (node.status === 200 && node.html) {
          const result = analyzeSoft404(node.html, node.outLinks || 0);

          ctx.store.upsertPageData(node.url, {
            score: result.score,
            signals: result.signals
          });

          if (result.score > 0) totalSoft404Count++;
          if (result.score >= 0.7) highConfidenceCount++;
          evaluatedPages++;
        }
      }

      ctx.store.saveSummary({
        totalSoft404Count,
        highConfidenceCount,
        evaluatedPages
      });
    },

    async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
      const summary = ctx.store.loadSummary<any>();
      if (!summary) return;

      ctx.report.addSection('Soft 404 Detector', {
        metrics: {
          'Flagged': summary.totalSoft404Count,
          'High Confidence': summary.highConfidenceCount
        },
        headers: ['Metric', 'Value'],
        rows: [
          ['Pages Evaluated', summary.evaluatedPages],
          ['Soft-404 Flagged', summary.totalSoft404Count],
          ['High Confidence (Potential Issues)', summary.highConfidenceCount]
        ]
      });

      if (ctx.report.contributeScore) {
        const penalty = summary.highConfidenceCount * 10;
        ctx.report.contributeScore({
          label: 'Content Integrity',
          score: Math.max(0, 100 - penalty),
          weight: 0.1
        });
      }
    }
  },
  async onAnalyzeDone(result: any, _ctx: PluginContext) {
    if (!result.pages) return;
    for (const page of result.pages) {
      if (page.status === 200 && page.html) {
        const soft404 = analyzeSoft404(page.html, page.links?.internalLinks || 0);
        page.plugins = page.plugins || {};
        page.plugins['soft404-detector'] = {
          score: soft404.score,
          signals: soft404.signals || 'none'
        };
      }
    }
  }
}

export default Soft404DetectorPlugin;
