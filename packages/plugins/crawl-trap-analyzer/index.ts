import { CrawlPlugin, CrawlContext, PluginContext, CLIWriter, ReportWriter, PluginStore } from '@crawlith/core';
import { TrapDetector, TrapResult } from './src/trap.js';

let detector: TrapDetector | null = null;
const trapResults = new Map<string, TrapResult>();

export const CrawlTrapAnalyzerPlugin: CrawlPlugin = {
    name: 'crawl-trap-analyzer',
    cli: {
        flag: 'traps',
        description: 'Detect and isolate infinite crawl traps / faceted navigation explosion',
        defaultFor: ['crawl', 'page']
    },

    storage: {
        perPage: {
            columns: {
                risk: 'REAL',
                type: 'TEXT'
            }
        }
    },

    async onInit(_ctx: PluginContext) {
        detector = new TrapDetector();
        trapResults.clear();
    },

    shouldEnqueueUrl(url: string, depth: number, ctx: CrawlContext) {
        if (!detector) return true;
        const trap = detector.checkTrap(url, depth);
        if (trap.risk > 0) {
            trapResults.set(url, trap);
        }
        if (trap.risk > 0.8) {
            ctx.logger?.info?.(`🪤 Caught potential crawl trap: ${url} (risk: ${trap.risk.toFixed(2)})`);
            return false;
        }
        return true;
    },

    hooks: {
        async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
            if (!ctx.graph) return;

            let totalTraps = 0;
            let criticalTraps = 0;

            for (const node of ctx.graph.getNodes()) {
                const trap = trapResults.get(node.url) || { risk: 0, type: null };

                ctx.store.upsertPageData(node.url, {
                    risk: trap.risk,
                    type: trap.type
                });

                if (trap.risk > 0) totalTraps++;
                if (trap.risk > 0.8) criticalTraps++;
            }

            ctx.store.saveSummary({
                totalTraps,
                criticalTraps
            });
        },

        async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
            const summary = ctx.store.loadSummary<any>();
            if (!summary) return;

            ctx.report.addSection('Crawl Trap Analysis', {
                metrics: {
                    'Identified': summary.totalTraps,
                    'Critical': summary.criticalTraps
                },
                headers: ['Metric', 'Count'],
                rows: [
                    ['Total Signals Detected', summary.totalTraps],
                    ['High-Risk Traps Blocked', summary.criticalTraps]
                ]
            });
        }
    },

    async onAnalyzeDone(result: any, _ctx: PluginContext) {
        if (!result.pages) return;
        const analyzer = new TrapDetector();
        for (const page of result.pages) {
            const trap = analyzer.checkTrap(page.url, 0);
            if (trap.risk > 0) {
                page.plugins = page.plugins || {};
                page.plugins['crawl-trap-analyzer'] = {
                    risk: trap.risk,
                    type: trap.type
                };
            }
        }
    }
};

export default CrawlTrapAnalyzerPlugin;
