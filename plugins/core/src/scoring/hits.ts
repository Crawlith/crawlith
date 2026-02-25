import { Graph, GraphNode } from '../graph/graph.js';

export interface HITSOptions {
    iterations?: number;
}

/**
 * Computes Hub and Authority scores using the HITS algorithm.
 * Operates purely on the internal link graph.
 */
export function computeHITS(graph: Graph, options: HITSOptions = {}): void {
    const iterations = options.iterations || 20;
    const nodes = graph.getNodes();

    // 1. Filter eligible nodes
    // Eligibility: status 200, non-redirect (redirectChain empty), not noindex, non-external
    const eligibleNodes = nodes.filter(n =>
        n.status === 200 &&
        (!n.redirectChain || n.redirectChain.length === 0) &&
        !n.noindex
    );

    if (eligibleNodes.length === 0) return;

    const urlToNode = new Map<string, GraphNode>();
    for (const node of eligibleNodes) {
        urlToNode.set(node.url, node);
        // 2. Initialization
        node.authorityScore = 1.0;
        node.hubScore = 1.0;
    }

    const allEdges = graph.getEdges();
    // Filter edges: internal links only (both source and target must be in eligibleNodes), no self-links
    const eligibleEdges = allEdges.filter(e =>
        e.source !== e.target &&
        urlToNode.has(e.source) &&
        urlToNode.has(e.target)
    );

    // Group edges for efficient iteration
    const incoming = new Map<string, { source: string, weight: number }[]>();
    const outgoing = new Map<string, { target: string, weight: number }[]>();

    for (const edge of eligibleEdges) {
        if (!incoming.has(edge.target)) incoming.set(edge.target, []);
        incoming.get(edge.target)!.push({ source: edge.source, weight: edge.weight });

        if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
        outgoing.get(edge.source)!.push({ target: edge.target, weight: edge.weight });
    }

    // 3. Iteration
    for (let i = 0; i < iterations; i++) {
        // Update Authorities
        let normAuth = 0;
        for (const node of eligibleNodes) {
            const inLinks = incoming.get(node.url) || [];
            let newAuth = 0;
            for (const link of inLinks) {
                const sourceNode = urlToNode.get(link.source)!;
                newAuth += (sourceNode.hubScore || 0) * link.weight;
            }
            node.authorityScore = newAuth;
            normAuth += newAuth * newAuth;
        }

        // Normalize Authorities (L2 norm)
        normAuth = Math.sqrt(normAuth);
        if (normAuth > 0) {
            for (const node of eligibleNodes) {
                node.authorityScore = (node.authorityScore || 0) / normAuth;
            }
        }

        // Update Hubs
        let normHub = 0;
        for (const node of eligibleNodes) {
            const outLinks = outgoing.get(node.url) || [];
            let newHub = 0;
            for (const link of outLinks) {
                const targetNode = urlToNode.get(link.target)!;
                newHub += (targetNode.authorityScore || 0) * link.weight;
            }
            node.hubScore = newHub;
            normHub += newHub * newHub;
        }

        // Normalize Hubs (L2 norm)
        normHub = Math.sqrt(normHub);
        if (normHub > 0) {
            for (const node of eligibleNodes) {
                node.hubScore = (node.hubScore || 0) / normHub;
            }
        }
    }

    // 4. Classification Logic
    classifyLinkRoles(eligibleNodes);
}

function classifyLinkRoles(nodes: GraphNode[]): void {
    if (nodes.length === 0) return;

    const authScores = nodes.map(n => n.authorityScore || 0).sort((a, b) => a - b);
    const hubScores = nodes.map(n => n.hubScore || 0).sort((a, b) => a - b);

    // Use 75th percentile as "high" threshold
    const medianAuth = authScores[Math.floor(authScores.length / 2)];
    const medianHub = hubScores[Math.floor(hubScores.length / 2)];

    for (const node of nodes) {
        const auth = node.authorityScore || 0;
        const hub = node.hubScore || 0;

        const isHighAuth = auth > medianAuth && auth > 0.0001;
        const isHighHub = hub > medianHub && hub > 0.0001;

        if (isHighAuth && isHighHub) {
            node.linkRole = 'power';
        } else if (isHighAuth) {
            node.linkRole = 'authority';
        } else if (isHighHub) {
            node.linkRole = 'hub';
        } else if (auth > 0.0001 && hub > 0.0001) {
            node.linkRole = 'balanced';
        } else {
            node.linkRole = 'peripheral';
        }
    }
}
