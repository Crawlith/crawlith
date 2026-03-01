import type { CrawlPlugin, PluginContext, CLIWriter, ReportWriter, PluginStore } from '@crawlith/core';
import { load } from 'cheerio';

function analyzeTitle(html: string) {
    const $ = load(html);
    const title = $('title').first().text().trim();
    if (!title) return { value: null, length: 0, status: 'missing' };
    if (title.length < 50) return { value: title, length: title.length, status: 'too_short' };
    if (title.length > 60) return { value: title, length: title.length, status: 'too_long' };
    return { value: title, length: title.length, status: 'ok' };
}

function analyzeMetaDescription(html: string) {
    const $ = load(html);
    const raw = $('meta[name="description"]').attr('content');
    if (raw === undefined) return { value: null, length: 0, status: 'missing' };

    const description = raw.trim();
    if (!description) return { value: '', length: 0, status: 'missing' };
    if (description.length < 140) return { value: description, length: description.length, status: 'too_short' };
    if (description.length > 160) return { value: description, length: description.length, status: 'too_long' };

    return { value: description, length: description.length, status: 'ok' };
}

function analyzeContent(html: string) {
    const $ = load(html);
    const body = $('body').length ? $('body') : $('html');
    const text = body.clone().find('script,style,nav,footer').remove().end().text();
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;
    const textHtmlRatio = cleanText.length / (html.length || 1);
    return { wordCount, textHtmlRatio };
}

function analyzeImages(html: string) {
    const $ = load(html);
    let missingAlt = 0;
    const images = $('img');
    images.each((_i, el) => {
        const alt = $(el).attr('alt');
        if (alt === undefined || !alt.trim()) missingAlt++;
    });
    return { total: images.length, missingAlt };
}

export const PageAnalyzerPlugin: CrawlPlugin = {
    name: 'page-analyzer',
    cli: {
        flag: 'analyzer',
        description: 'Analyzes page structure like SEO, Content depth, and Accessibility',
        defaultFor: ['crawl', 'page'],
    },

    storage: {
        perPage: {
            columns: {
                title_status: 'TEXT',
                meta_status: 'TEXT',
                word_count: 'INTEGER',
                text_html_ratio: 'REAL',
                images_total: 'INTEGER',
                images_missing_alt: 'INTEGER'
            }
        }
    },

    hooks: {
        async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
            if (!ctx.graph) return;

            let evaluatedPages = 0;
            let missingTitles = 0;
            let duplicateTitles = 0;
            let missingMetas = 0;
            let duplicateMetas = 0;
            let thinContentPages = 0;
            let totalMissingAlts = 0;

            const titleCounts = new Map<string, number>();
            const metaCounts = new Map<string, number>();

            // Step 1: Pre-calculate counts
            for (const node of ctx.graph.getNodes()) {
                if (node.status < 200 || node.status >= 300 || !node.html) continue;
                const title = analyzeTitle(node.html);
                const meta = analyzeMetaDescription(node.html);
                if (title.value) titleCounts.set(title.value.toLowerCase(), (titleCounts.get(title.value.toLowerCase()) || 0) + 1);
                if (meta.value) metaCounts.set(meta.value.toLowerCase(), (metaCounts.get(meta.value.toLowerCase()) || 0) + 1);
            }

            // Step 2: Full analysis
            for (const node of ctx.graph.getNodes()) {
                if (node.status < 200 || node.status >= 300 || !node.html) continue;

                const title = analyzeTitle(node.html);
                const meta = analyzeMetaDescription(node.html);
                const content = analyzeContent(node.html);
                const images = analyzeImages(node.html);

                if (title.value && titleCounts.get(title.value.toLowerCase())! > 1) title.status = 'duplicate';
                if (meta.value && metaCounts.get(meta.value.toLowerCase())! > 1) meta.status = 'duplicate';

                if (title.status === 'missing') missingTitles++;
                if (title.status === 'duplicate') duplicateTitles++;
                if (meta.status === 'missing') missingMetas++;
                if (meta.status === 'duplicate') duplicateMetas++;
                if (content.wordCount < 300) thinContentPages++;
                totalMissingAlts += images.missingAlt;

                evaluatedPages++;

                ctx.store.upsertPageData(node.url, {
                    title_status: title.status,
                    meta_status: meta.status,
                    word_count: content.wordCount,
                    text_html_ratio: content.textHtmlRatio,
                    images_total: images.total,
                    images_missing_alt: images.missingAlt
                });
            }

            ctx.store.saveSummary({
                evaluatedPages,
                missingTitles,
                duplicateTitles,
                missingMetas,
                duplicateMetas,
                thinContentPages,
                totalMissingAlts
            });
        },

        async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
            const summary = ctx.store.loadSummary<any>();
            if (!summary) return;

            ctx.report.addSection('Page Analyzer', {
                metrics: {
                    'Missing Titles': summary.missingTitles,
                    'Duplicate Titles': summary.duplicateTitles,
                    'Missing Metas': summary.missingMetas,
                    'Thin Pages': summary.thinContentPages,
                    'Missing Alts': summary.totalMissingAlts
                },
                headers: ['Metric', 'Value'],
                rows: [
                    ['Pages Evaluated', summary.evaluatedPages],
                    ['Missing Titles', summary.missingTitles],
                    ['Duplicate Titles', summary.duplicateTitles],
                    ['Missing Metas', summary.missingMetas],
                    ['Duplicate Metas', summary.duplicateMetas],
                    ['Thin Content Pages (<300 words)', summary.thinContentPages],
                    ['Missing Image Alts', summary.totalMissingAlts]
                ]
            });
        }
    },
    async onAnalyzeDone(result: any, _ctx: PluginContext) {
        if (!result.pages) return;
        for (const page of result.pages) {
            if (!page.html) continue;
            const title = analyzeTitle(page.html);
            const meta = analyzeMetaDescription(page.html);
            const content = analyzeContent(page.html);
            const images = analyzeImages(page.html);

            page.plugins = page.plugins || {};
            page.plugins['page-analyzer'] = {
                titleStatus: title.status,
                metaStatus: meta.status,
                wordCount: content.wordCount,
                textHtmlRatio: (content.textHtmlRatio * 100).toFixed(1) + '%',
                totalImages: images.total,
                missingAlts: images.missingAlt
            };
        }
    }
};

export default PageAnalyzerPlugin;
