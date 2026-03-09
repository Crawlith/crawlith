import { Graph } from './graph.js';
import { DEFAULTS } from '../constants.js';

export interface PageRankRow {
    raw_rank: number;
    score: number;
}

export interface PageRankOptions {
    dampingFactor?: number;
    maxIterations?: number;
    convergenceThreshold?: number;
    soft404WeightThreshold?: number;
    neutralScoreWhenFlat?: number;
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
        const neutralScoreWhenFlat = options.neutralScoreWhenFlat ?? 50;

        const allNodes = graph.getNodes();

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

        // Map URL to Index for O(1) access and TypedArray usage
        const urlToIndex = new Map<string, number>();
        for (let i = 0; i < nodeCount; i++) {
            urlToIndex.set(eligibleNodes[i].url, i);
        }

        // Pre-calculate weighted outbound sums and inverted adjacency
        const outWeights = new Float64Array(nodeCount);
        const incoming: { sourceIndex: number, weight: number }[][] = new Array(nodeCount).fill(null).map(() => []);

        graph.forEachEdge((source, target, weight) => {
            const sourceIndex = urlToIndex.get(source);
            const targetIndex = urlToIndex.get(target);

            if (sourceIndex !== undefined && targetIndex !== undefined) {
                const w = weight || 1.0;
                incoming[targetIndex].push({ sourceIndex, weight: w });
                outWeights[sourceIndex] += w;
            }
        });

        // Identify sinks
        const sinks: number[] = [];
        for (let i = 0; i < nodeCount; i++) {
            if (outWeights[i] === 0) {
                sinks.push(i);
            }
        }

        // Initialize PageRank typed arrays
        let pr = new Float64Array(nodeCount).fill(1 / nodeCount);
        let nextPr = new Float64Array(nodeCount);

        // Iterative Calculation
        for (let iter = 0; iter < maxIterations; iter++) {
            // Calculate total rank from sinks to redistribute
            let sinkRankTotal = 0;
            for (let i = 0; i < sinks.length; i++) {
                sinkRankTotal += pr[sinks[i]];
            }

            const baseRank = (1 - d) / nodeCount + (d * sinkRankTotal / nodeCount);
            let maxDelta = 0;

            for (let i = 0; i < nodeCount; i++) {
                let rankFromLinks = 0;
                const sources = incoming[i];

                for (let j = 0; j < sources.length; j++) {
                    const edge = sources[j];
                    const sourceRank = pr[edge.sourceIndex];
                    const sourceOutWeight = outWeights[edge.sourceIndex] || 1.0;
                    rankFromLinks += sourceRank * (edge.weight / sourceOutWeight);
                }

                const newRank = baseRank + d * rankFromLinks;
                nextPr[i] = newRank;

                const delta = Math.abs(newRank - pr[i]);
                if (delta > maxDelta) {
                    maxDelta = delta;
                }
            }

            // Swap arrays
            const temp = pr;
            pr = nextPr;
            nextPr = temp;

            if (maxDelta < epsilon) break;
        }

        // 2. Normalization (0-100)
        let minPR = pr[0];
        let maxPR = pr[0];
        for (let i = 1; i < nodeCount; i++) {
            const rank = pr[i];
            if (rank < minPR) minPR = rank;
            if (rank > maxPR) maxPR = rank;
        }
        const range = maxPR - minPR;

        for (let i = 0; i < nodeCount; i++) {
            const rawRank = pr[i];
            const url = eligibleNodes[i].url;
            let score = neutralScoreWhenFlat;

            if (range > DEFAULTS.GRAPH_PRECISION) {
                score = 100 * (rawRank - minPR) / range;
            }

            results.set(url, {
                raw_rank: rawRank,
                score: Number(score.toFixed(3))
            });
        }

        return results;
    }
}
