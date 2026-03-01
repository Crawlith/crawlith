import { CrawlPlugin, CrawlContext } from '@crawlith/core';
import { TrapDetector, TrapResult } from './src/trap.js';

let detector: TrapDetector | null = null;
const trapResults = new Map<string, TrapResult>();

export const CrawlTrapAnalyzerPlugin: CrawlPlugin = {
    name: 'CrawlTrapAnalyzerPlugin',
    cli: {
        defaultFor: ['crawl'],
        options: [
            { flags: "--detect-traps", description: "Detect and cluster crawl traps" }
        ]
    },
    onInit: async (ctx) => {
        const flags = ctx.flags || {};
        if (flags.detectTraps) {
            detector = new TrapDetector();
            trapResults.clear();
        }
    },
    shouldEnqueueUrl: (url: string, depth: number, ctx: CrawlContext) => {
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
    onMetricsPhase: async (graph: any, context: any) => {
        if (!detector) return;

        context.logger?.info?.('🔍 Processing crawl traps...');

        const nodes = graph.getNodes();
        let trapCount = 0;

        for (const node of nodes) {
            // Re-evaluate in case any weren't checked during shouldEnqueueUrl, or use cached
            let trap = trapResults.get(node.url);
            if (!trap) {
                trap = detector.checkTrap(node.url, node.depth);
            }
            if (trap && trap.risk > 0.8) {
                node.crawlTrapFlag = true;
                node.crawlTrapRisk = trap.risk;
                node.trapType = trap.type;
                trapCount++;
            } else if (trap && trap.risk > 0) {
                node.crawlTrapFlag = false;
                node.crawlTrapRisk = trap.risk;
                node.trapType = trap.type;
            }
        }

        if (trapCount > 0) {
            context.logger?.info?.(`🪤 Identified ${trapCount} crawl traps`);
        }
    }
};
