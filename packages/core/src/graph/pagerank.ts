import { Graph } from './graph.js';

export interface PageRankRow {
    raw_rank: number;
    score: number;
}

export interface PageRankOptions {
    dampingFactor?: number;
    maxIterations?: number;
    convergenceThreshold?: number;
    soft404WeightThreshold?: number;
}

/**
 * Service to analyze a site's link graph and compute PageRank metrics.
 * Runs only on the full crawl graph.
 */
export class PageRankService {
    /**
     * Computes a Production-Grade Weighted PageRank over the given graph.
     * @param {Graph} graph - The full site graph structure.
     * @param {PageRankOptions} options - Configuration overrides for damping factor, limits, etc.
     * @returns {Map<string, PageRankRow>} The individual metrics keyed by exact normalized url.
     */
    public evaluate(graph: Graph, options: PageRankOptions = {}): Map<string, PageRankRow> {
        const d = options.dampingFactor ?? 0.85;
        const maxIterations = options.maxIterations ?? 40;
        const epsilon = options.convergenceThreshold ?? 1e-5;
        const soft404Threshold = options.soft404WeightThreshold ?? 0.8;

        const allNodes = graph.getNodes();
        const allEdges = graph.getEdges();

        // 1. Filter Eligible Nodes
        const eligibleNodes = allNodes.filter(node => {
            if (node.noindex) return false;
            if (node.isCollapsed) return false;
            // Keep compat with other plugins mutating soft404Score onto nodes

            if (node.soft404Score && node.soft404Score > soft404Threshold) return false;
            // canonical is stored as absolute URL; extract pathname for path-based comparison
            if (node.canonical) {
                try {
                    const canonicalPath = new URL(node.canonical).pathname;
                    if (canonicalPath !== node.url) return false;
                } catch {
                    // if canonical isn't a valid URL, compare as-is
                    if (node.canonical !== node.url) return false;
                }
            }
            if (node.status >= 400) return false; // Don't pass rank to broken pages
            if (node.status === 0) return false; // Don't pass rank to uncrawled/external pages
            return true;
        });

        const nodeCount = eligibleNodes.length;
        const results = new Map<string, PageRankRow>();
        if (nodeCount === 0) return results;

        const nodeUrls = eligibleNodes.map(n => n.url);
        const nodeMap = new Map<string, any>();
        eligibleNodes.forEach(n => nodeMap.set(n.url, n));

        // Initialize PageRank
        let pr = new Map<string, number>();
        nodeUrls.forEach(url => pr.set(url, 1 / nodeCount));

        // Pre-calculate weighted outbound sums and inverted adjacency
        const outWeights = new Map<string, number>();
        const incoming = new Map<string, { source: string; weight: number }[]>();
        const sinks: string[] = [];

        // Initialize outWeights for all eligible nodes
        nodeUrls.forEach(url => outWeights.set(url, 0));

        for (const edge of allEdges) {
            if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
                const weight = edge.weight || 1.0;

                const sources = incoming.get(edge.target) ?? [];
                sources.push({ source: edge.source, weight });
                incoming.set(edge.target, sources);

                outWeights.set(edge.source, (outWeights.get(edge.source) || 0) + weight);
            }
        }

        // Identify sinks
        nodeUrls.forEach(url => {
            if ((outWeights.get(url) || 0) === 0) {
                sinks.push(url);
            }
        });

        // Iterative Calculation
        for (let i = 0; i < maxIterations; i++) {
            const nextPr = new Map<string, number>();

            // Calculate total rank from sinks to redistribute
            let sinkRankTotal = 0;
            for (const url of sinks) {
                sinkRankTotal += pr.get(url) || 0;
            }

            const baseRank = (1 - d) / nodeCount + (d * sinkRankTotal / nodeCount);

            for (const url of nodeUrls) {
                let rankFromLinks = 0;
                const sources = incoming.get(url) || [];

                for (const edge of sources) {
                    const sourceRank = pr.get(edge.source) || 0;
                    const sourceOutWeight = outWeights.get(edge.source) || 1.0;
                    rankFromLinks += sourceRank * (edge.weight / sourceOutWeight);
                }

                const newRank = baseRank + d * rankFromLinks;
                nextPr.set(url, newRank);
            }

            // Convergence check
            let maxDelta = 0;
            for (const url of nodeUrls) {
                const delta = Math.abs(nextPr.get(url)! - pr.get(url)!);
                if (delta > maxDelta) maxDelta = delta;
            }

            pr = nextPr;

            if (maxDelta < epsilon) break;
        }

        // 2. Normalization (0-100)
        const ranks = Array.from(pr.values());
        const minPR = Math.min(...ranks);
        const maxPR = Math.max(...ranks);
        const range = maxPR - minPR;

        for (const node of eligibleNodes) {
            const rawRank = pr.get(node.url)!;
            let score = 100;

            if (range > 1e-12) {
                score = 100 * (rawRank - minPR) / range;
            }

            results.set(node.url, {
                raw_rank: rawRank,
                score: Number(score.toFixed(3))
            });
        }

        return results;
    }
}
