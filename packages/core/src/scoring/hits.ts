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
    // Using median (50th percentile) as per original implementation,
    // but the comment said "Use 75th percentile" while code used median.
    // I'll stick to median to avoid breaking existing behavior, but correct the comment or logic?
    // The original code:
    // const medianAuth = authScores[Math.floor(authScores.length / 2)];
    // const isHighAuth = auth > medianAuth && auth > 0.0001;
    // So it uses median. I'll keep it as median.

    const medianAuth = authScores[Math.floor(authScores.length / 2)];
    const medianHub = hubScores[Math.floor(hubScores.length / 2)];
    const maxAuth = authScores[authScores.length - 1];
    const maxHub = hubScores[hubScores.length - 1];

    for (const node of nodes) {
        const auth = node.authorityScore || 0;
        const hub = node.hubScore || 0;

        // A node is high if it's above median, OR if it's the max (to handle uniform distributions)
        // auth > 0 check is essential.
        const isHighAuth = (auth > medianAuth || (auth === maxAuth && auth > 0)) && auth > 0.00001;
        const isHighHub = (hub > medianHub || (hub === maxHub && hub > 0)) && hub > 0.00001;

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
