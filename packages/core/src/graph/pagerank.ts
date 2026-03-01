import { Graph, GraphNode } from './graph.js';

interface PageRankOptions {
    dampingFactor?: number;
    maxIterations?: number;
    convergenceThreshold?: number;
    soft404WeightThreshold?: number;
}

/**
 * Production-Grade Weighted PageRank Engine
 */
export function computePageRank(graph: Graph, options: PageRankOptions = {}) {
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
        if (node.soft404Score && node.soft404Score > soft404Threshold) return false;
        if (node.canonical && node.canonical !== node.url) return false;
        if (node.status >= 400) return false; // Don't pass rank to broken pages
        if (node.status === 0) return false; // Don't pass rank to uncrawled/external pages
        return true;
    });

    const nodeCount = eligibleNodes.length;
    if (nodeCount === 0) return;

    const nodeUrls = eligibleNodes.map(n => n.url);
    const nodeMap = new Map<string, GraphNode>();
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
        node.pageRank = rawRank;

        if (range > 1e-12) {
            node.pageRankScore = 100 * (rawRank - minPR) / range;
        } else {
            // If there's no range, all eligible pages are equally important.
            node.pageRankScore = 100;
        }
    }
}
