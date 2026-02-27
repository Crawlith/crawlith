import { Graph, GraphNode } from '../graph/graph.js';

export interface HITSOptions {
    iterations?: number;
}

/**
 * Computes Hub and Authority scores using the HITS algorithm.
 * Operates purely on the internal link graph.
 * Optimized for performance using array-based adjacency lists.
 */
export function computeHITS(graph: Graph, options: HITSOptions = {}): void {
    const iterations = options.iterations || 20;
    const nodes = graph.getNodes();

    // 1. Filter eligible nodes
    // Eligibility: status 200 (crawled) or status 0 (discovered)
    // Non-redirect, not noindex (if known), non-external
    const eligibleNodes = nodes.filter(n =>
        (n.status === 200 || n.status === 0) &&
        (!n.redirectChain || n.redirectChain.length === 0) &&
        !n.noindex
    );

    const N = eligibleNodes.length;
    if (N === 0) return;

    // Map URL to Index for O(1) access
    const urlToIndex = new Map<string, number>();
    for (let i = 0; i < N; i++) {
        urlToIndex.set(eligibleNodes[i].url, i);
    }

    // Build Adjacency Lists (Indices)
    // incoming[i] = list of { sourceIndex, weight }
    // outgoing[i] = list of { targetIndex, weight }
    const incoming: { sourceIndex: number, weight: number }[][] = new Array(N).fill(null).map(() => []);
    const outgoing: { targetIndex: number, weight: number }[][] = new Array(N).fill(null).map(() => []);

    const allEdges = graph.getEdges();
    for (const edge of allEdges) {
        if (edge.source === edge.target) continue;

        const sourceIndex = urlToIndex.get(edge.source);
        const targetIndex = urlToIndex.get(edge.target);

        if (sourceIndex !== undefined && targetIndex !== undefined) {
            incoming[targetIndex].push({ sourceIndex, weight: edge.weight });
            outgoing[sourceIndex].push({ targetIndex, weight: edge.weight });
        }
    }

    // Initialize Scores
    const authScores = new Float64Array(N).fill(1.0);
    const hubScores = new Float64Array(N).fill(1.0);

    // 2. Iteration
    for (let iter = 0; iter < iterations; iter++) {
        // Update Authorities
        let normAuth = 0;
        for (let i = 0; i < N; i++) {
            const inLinks = incoming[i];
            let newAuth = 0;
            for (let j = 0; j < inLinks.length; j++) {
                const link = inLinks[j];
                newAuth += hubScores[link.sourceIndex] * link.weight;
            }
            authScores[i] = newAuth;
            normAuth += newAuth * newAuth;
        }

        // Normalize Authorities (L2 norm)
        normAuth = Math.sqrt(normAuth);
        if (normAuth > 0) {
            for (let i = 0; i < N; i++) {
                authScores[i] /= normAuth;
            }
        }

        // Update Hubs
        let normHub = 0;
        for (let i = 0; i < N; i++) {
            const outLinks = outgoing[i];
            let newHub = 0;
            for (let j = 0; j < outLinks.length; j++) {
                const link = outLinks[j];
                newHub += authScores[link.targetIndex] * link.weight;
            }
            hubScores[i] = newHub;
            normHub += newHub * newHub;
        }

        // Normalize Hubs (L2 norm)
        normHub = Math.sqrt(normHub);
        if (normHub > 0) {
            for (let i = 0; i < N; i++) {
                hubScores[i] /= normHub;
            }
        }
    }

    // 3. Assign back to GraphNodes
    for (let i = 0; i < N; i++) {
        eligibleNodes[i].authorityScore = authScores[i];
        eligibleNodes[i].hubScore = hubScores[i];
    }

    // 4. Classification Logic
    classifyLinkRoles(eligibleNodes);
}

function classifyLinkRoles(nodes: GraphNode[]): void {
    if (nodes.length === 0) return;

    const authScores = nodes.map(n => n.authorityScore || 0).sort((a, b) => a - b);
    const hubScores = nodes.map(n => n.hubScore || 0).sort((a, b) => a - b);

    // Use 75th percentile as "high" threshold
    // Updated to use true 75th percentile for better discrimination
    // We target the top 25% of nodes.
    const thresholdIndex = Math.floor(authScores.length * 0.75);
    const thresholdAuth = authScores[thresholdIndex];
    const thresholdHub = hubScores[thresholdIndex];

    const maxAuth = authScores[authScores.length - 1];
    const maxHub = hubScores[hubScores.length - 1];

    for (const node of nodes) {
        const auth = node.authorityScore || 0;
        const hub = node.hubScore || 0;

        // A node is high if it's strictly ABOVE the 75th percentile score
        // If the distribution is very flat (many nodes have same score), this might exclude too many.
        // So we also include if it's the max score (e.g. all equal).
        // But if many nodes share the 75th percentile score, > excludes them, >= includes them.
        // Standard percentile logic: "top 25%" usually means those above the 75th percentile value.
        // If 75th percentile value equals 90th percentile value, strict > filters both out? No.

        const isHighAuth = (auth > thresholdAuth || (auth === maxAuth && auth > 0)) && auth > 0.00001;
        const isHighHub = (hub > thresholdHub || (hub === maxHub && hub > 0)) && hub > 0.00001;

        if (isHighAuth && isHighHub) {
            node.linkRole = 'power';
        } else if (isHighAuth) {
            node.linkRole = 'authority';
        } else if (isHighHub) {
            node.linkRole = 'hub';
        } else if (auth > 0.00001 && hub > 0.00001) {
            node.linkRole = 'balanced';
        } else {
            node.linkRole = 'peripheral';
        }
    }
}
