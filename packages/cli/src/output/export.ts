import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AnalysisResult,
  renderAnalysisHtml,
  renderAnalysisMarkdown,
  renderAnalysisCsv
} from '@crawlith/core';

export async function exportAnalysisResult(
  result: AnalysisResult,
  format: 'json' | 'csv' | 'markdown' | 'html',
  outputDir: string
): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  let filename: string;
  let content: string;

  switch (format) {
    case 'json': {
      filename = 'analysis.json';
      const active = result.active_modules;
      const isSinglePage = result.pages.length === 1;

      if (isSinglePage) {
        const p = result.pages[0];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { seoScore, thinScore, ...rest } = p as any;

        // Respect module filters
        if (active) {
          if (!active.seo) {
            delete rest.title;
            delete rest.metaDescription;
            delete rest.links;
            delete rest.structuredData;
          }
          if (!active.content) {
            delete rest.content;
          }
          if (!active.accessibility) {
            delete rest.images;
          }
          if (!active.seo && !active.content) {
            delete rest.h1;
          }
        }

        // Round ratios
        if (rest.content) rest.content.textHtmlRatio = Number(rest.content.textHtmlRatio.toFixed(3));
        if (rest.links) rest.links.externalRatio = Number(rest.links.externalRatio.toFixed(3));

        const simplified = {
          ...rest,
          health_score: Number(result.site_summary.site_score.toFixed(3))
        };
        content = JSON.stringify(simplified, null, 2);
      } else {
        // Site-wide export: Keep structure but filter modules and round ratios
        const filteredResult = {
          ...result,
          pages: result.pages.map(p => {
            const page: any = { ...p };
            if (active) {
              if (!active.seo) {
                delete page.title;
                delete page.metaDescription;
                delete page.links;
                delete page.structuredData;
              }
              if (!active.content) {
                delete page.content;
              }
              if (!active.accessibility) {
                delete page.images;
              }
              if (!active.seo && !active.content) {
                delete page.h1;
              }
            }
            if (page.content) page.content.textHtmlRatio = Number(page.content.textHtmlRatio.toFixed(3));
            if (page.links) page.links.externalRatio = Number(page.links.externalRatio.toFixed(3));
            return page;
          })
        };
        content = JSON.stringify(filteredResult, null, 2);
      }
      break;
    }
    case 'html':
      filename = 'analysis.html';
      content = renderAnalysisHtml(result);
      break;
    case 'markdown': {
      filename = 'analysis.md';
      const active = result.active_modules;
      const isSinglePage = result.pages.length === 1;

      if (isSinglePage) {
        const page = result.pages[0];
        const hasFilters = active && (active.seo || active.content || active.accessibility);
        const healthScore = result.site_summary.site_score.toFixed(1);

        const md = [
          `# SEO Analysis Report: ${page.url}`,
          '',
          `## 🛡️ Health Score: ${healthScore}/100`,
          '',
          '### 📋 Audit Results',
          ''
        ];

        // 1. Robots
        const isBlocked = page.meta.crawlStatus === 'blocked_by_robots';
        md.push(`- **Robots.txt**: ${isBlocked ? '❌ Blocked' : '✅ Access Allowed'}`);

        // 2. SEO Module
        if (!hasFilters || active.seo) {
          md.push('#### 🔍 SEO Checks');
          md.push(`- **Title**: ${page.title.value || '*Missing*'} (${page.title.length} chars) — *${page.title.status}*`);
          md.push(`- **Meta Description**: ${page.metaDescription.value || '*Missing*'} (${page.metaDescription.length} chars) — *${page.metaDescription.status}*`);
          md.push(`- **Canonical**: ${page.meta.canonical || '*None*'}`);
          md.push(`- **Structured Data**: ${page.structuredData.present ? (page.structuredData.valid ? '✅ Valid' : '❌ Invalid') : '➖ Not found'}`);
          if (page.structuredData.present && page.structuredData.types.length) {
            md.push(`  - Types: ${page.structuredData.types.join(', ')}`);
          }
          md.push('');
        }

        // 3. Content Module
        if (!hasFilters || active.content) {
          md.push('#### 📝 Content Quality');
          md.push(`- **H1 Header**: ${page.h1.count} tag(s) found — *${page.h1.status}*`);
          md.push(`- **Word Count**: ${page.content.wordCount} words`);
          md.push(`- **Text/HTML Ratio**: ${(page.content.textHtmlRatio * 100).toFixed(1)}%`);
          md.push(`- **Thin Content**: ${page.thinScore >= 70 ? '⚠️ Potential Issue' : '✅ Good'}`);
          md.push('');
        }

        // 4. Links & Accessibility
        if (!hasFilters || active.seo) {
          md.push('#### 🔗 Links');
          md.push(`- **Internal Links**: ${page.links.internalLinks}`);
          md.push(`- **External Links**: ${page.links.externalLinks}`);
          md.push('');
        }

        if (!hasFilters || active.accessibility) {
          md.push('#### ♿ Accessibility');
          md.push(`- **Images**: ${page.images.totalImages} total, ${page.images.missingAlt} missing alt text`);
          md.push('');
        }

        content = md.join('\n');
      } else {
        content = renderAnalysisMarkdown(result);
      }
      break;
    }
    case 'csv':
      filename = 'analysis.csv';
      content = renderAnalysisCsv(result);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  return filepath;
}
