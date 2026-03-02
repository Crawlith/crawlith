import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');

import { CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from '@crawlith/core';
import { TrapDetector, TrapResult } from './src/trap.js';

let detector: TrapDetector | null = null;
const trapResults = new Map<string, TrapResult>();

/**
 * Crawl Trap Analyzer Plugin
 * Crawlith plugin for crawl trap analyzer
 */
export const CrawlTrapAnalyzerPlugin: CrawlithPlugin = {
    name: 'crawl-trap-analyzer',
  version: pkg.version,
  description: pkg.description,

    register: (cli: Command) => {
        if (cli.name() === 'crawl') {
            cli.option("--detect-traps", "Detect and cluster crawl traps");
        }
    },

    hooks: {
        onInit: async (ctx: PluginContext) => {
            const flags = ctx.flags || {};
            if (flags.detectTraps) {
                detector = new TrapDetector();
                trapResults.clear();
            }
        },
        shouldEnqueueUrl: (ctx: PluginContext, url: string, depth: number) => {
            if (!detector) return true;
            const trap = detector.checkTrap(url, depth);
            if (trap.risk > 0) {
                trapResults.set(url, trap);
            }
            if (trap.risk > 0.8) {
                ctx.logger?.info(`🪤 Caught potential crawl trap: ${url} (risk: ${trap.risk.toFixed(2)})`);
                return false;
            }
            return true;
        },
        onMetrics: async (ctx: PluginContext, graph: any) => {
            if (!detector) return;

            ctx.logger?.info('🔍 Processing crawl traps...');

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
                ctx.logger?.info(`🪤 Identified ${trapCount} crawl traps`);
            }
        }
    }
};

export default CrawlTrapAnalyzerPlugin;
