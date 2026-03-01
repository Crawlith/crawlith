import path from 'node:path';
import fs from 'node:fs/promises';
import chalk from 'chalk';
import {
    generateHtml,
} from './html.js';
import {
    renderCrawlMarkdown,
    renderCrawlCsvNodes,
    renderCrawlCsvEdges
} from './crawlExport.js';
import {
    renderAnalysisHtml,
    renderAnalysisMarkdown,
    renderAnalysisCsv
} from '../analysis/analyze.js';

import type { BaseReport } from '../plugin/types.js';

export function parseExportFormats(exportOption: string | boolean | undefined): string[] {
    if (exportOption === undefined || exportOption === false) return [];
    if (exportOption === true) return ['json'];
    return (exportOption as string).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

export async function runCrawlExports(
    formats: string[],
    outputDir: string,
    url: string,
    graphData: any,
    metrics: any,
    graphObj: any,
    report?: BaseReport
) {
    if (formats.length === 0) return;

    await fs.mkdir(outputDir, { recursive: true });

    if (formats.includes('json')) {
        await fs.writeFile(path.join(outputDir, 'graph.json'), JSON.stringify(graphData, null, 2));
        await fs.writeFile(path.join(outputDir, 'metrics.json'), JSON.stringify(metrics, null, 2));

        if (report) {
            await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
        }
        console.log(chalk.green(`JSON exports saved to ${outputDir} (graph.json, metrics.json${report ? ', report.json' : ''})`));
    }

    if (formats.includes('html')) {
        const html = generateHtml(graphData, metrics);
        await fs.writeFile(path.join(outputDir, 'graph.html'), html);
        console.log(chalk.green(`HTML report saved to ${path.join(outputDir, 'graph.html')}`));
    }

    if (formats.includes('visualize')) {
        const CrawlHtml = generateHtml(graphData, metrics);
        await fs.writeFile(path.join(outputDir, 'crawl.html'), CrawlHtml);
        console.log(chalk.green(`Visualization saved to ${path.join(outputDir, 'crawl.html')}`));
    }

    if (formats.includes('csv')) {
        await fs.writeFile(path.join(outputDir, 'nodes.csv'), renderCrawlCsvNodes(graphData));
        await fs.writeFile(path.join(outputDir, 'edges.csv'), renderCrawlCsvEdges(graphData));
        console.log(chalk.green(`CSV exports saved to ${outputDir} (nodes.csv, edges.csv)`));
    }

    if (formats.includes('markdown')) {
        const md = renderCrawlMarkdown(url, graphData, metrics, graphObj);
        await fs.writeFile(path.join(outputDir, 'summary.md'), md);
        console.log(chalk.green(`Markdown summary saved to ${path.join(outputDir, 'summary.md')}`));

        if (report && report.plugins) {
            for (const [pluginName, pluginData] of Object.entries(report.plugins)) {
                // Ensure Exporter remains generic without plugin-specific logical branches
                const serialized = JSON.stringify(pluginData, null, 2);
                const pluginMd = `\n## Plugin: ${pluginName}\n\n\`\`\`json\n${serialized}\n\`\`\`\n`;
                await fs.appendFile(path.join(outputDir, 'summary.md'), pluginMd);
            }
        }
    }
}

export async function runAnalysisExports(
    formats: string[],
    outputDir: string,
    result: any,
    isLive: boolean
) {
    if (formats.length === 0) return;

    await fs.mkdir(outputDir, { recursive: true });

    if (formats.includes('json')) {
        await fs.writeFile(path.join(outputDir, 'analysis.json'), JSON.stringify(result, null, 2));
        console.log(chalk.green(`JSON export saved to ${path.join(outputDir, 'analysis.json')}`));
    }

    if (formats.includes('html')) {
        const html = renderAnalysisHtml(result);
        const filename = isLive ? 'page.html' : 'analysis.html';
        await fs.writeFile(path.join(outputDir, filename), html, 'utf-8');
        console.log(chalk.green(`HTML report saved to ${path.join(outputDir, filename)}`));
    }

    if (formats.includes('markdown')) {
        const markdown = renderAnalysisMarkdown(result);
        const filename = isLive ? 'analysis.md' : 'analysis.md';
        await fs.writeFile(path.join(outputDir, filename), markdown, 'utf-8');
        console.log(chalk.green(`Markdown report saved to ${path.join(outputDir, filename)}`));
    }

    if (formats.includes('csv')) {
        const csv = renderAnalysisCsv(result);
        const filename = isLive ? 'analysis.csv' : 'analysis.csv';
        await fs.writeFile(path.join(outputDir, filename), csv, 'utf-8');
        console.log(chalk.green(`CSV export saved to ${path.join(outputDir, filename)}`));
    }
}
