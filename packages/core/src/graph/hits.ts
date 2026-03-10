import { Graph } from './graph.js';

export type LinkRole = 'hub' | 'authority' | 'power' | 'balanced' | 'peripheral';

export interface HITSRow {
    authority_score: number;
    hub_score: number;
    link_role: LinkRole;
}

export interface HITSOptions {
    iterations?: number;
}

/**
 * Service to compute Hub and Authority scores using the HITS algorithm.
 * Operates purely on the internal link graph.
 */
export class HITSService {
    /**
     * Computes Hub and Authority scores using the HITS algorithm.
     * @param {Graph} graph - The link graph to analyze.
     * @param {HITSOptions} options - Algorithm options (e.g. number of iterations).
     * @returns {Map<string, HITSRow>} A map of page URLs to their HITS results.
     */
    public evaluate(graph: Graph, options: HITSOptions = {}): Map<string, HITSRow> {
        const iterations = options.iterations || 20;
        const nodes = graph.getNodes();

        // 1. Filter eligible nodes
        const eligibleNodes = nodes.filter(n =>
            (n.status === 200 || n.status === 0) &&
            (!n.redirectChain || n.redirectChain.length === 0) &&
            !n.noindex
        );

        const N = eligibleNodes.length;
        const results = new Map<string, HITSRow>();
        if (N === 0) return results;

        // Map URL to Index for O(1) access
        const urlToIndex = new Map<string, number>();
        for (let i = 0; i < N; i++) {
            urlToIndex.set(eligibleNodes[i].url, i);
        }

        // Build Adjacency Lists
        const incoming: { sourceIndex: number, weight: number }[][] = new Array(N).fill(null).map(() => []);
        const outgoing: { targetIndex: number, weight: number }[][] = new Array(N).fill(null).map(() => []);

        graph.forEachEdge((source, target, weight) => {
            if (source === target) return;

            const sourceIndex = urlToIndex.get(source);
            const targetIndex = urlToIndex.get(target);

            if (sourceIndex !== undefined && targetIndex !== undefined) {
                const w = weight || 1.0;
                incoming[targetIndex].push({ sourceIndex, weight: w });
                outgoing[sourceIndex].push({ targetIndex, weight: w });
            }
        });

        // Initialize Scores
        const authScores = new Float64Array(N).fill(1.0);
        const hubScores = new Float64Array(N).fill(1.0);

        // 2. Iteration
        for (let iter = 0; iter < iterations; iter++) {
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

            normAuth = Math.sqrt(normAuth);
            if (normAuth > 0) {
                for (let i = 0; i < N; i++) authScores[i] /= normAuth;
            }

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

            normHub = Math.sqrt(normHub);
            if (normHub > 0) {
                for (let i = 0; i < N; i++) hubScores[i] /= normHub;
            }
        }

        // 3. Classification and Result Mapping
        const sortedAuth = [...authScores].sort((a, b) => a - b);
        const sortedHub = [...hubScores].sort((a, b) => a - b);
        const medianAuth = sortedAuth[Math.floor(sortedAuth.length / 2)];
        const medianHub = sortedHub[Math.floor(sortedHub.length / 2)];
        const maxAuth = sortedAuth[sortedAuth.length - 1];
        const maxHub = sortedHub[sortedHub.length - 1];

        for (let i = 0; i < N; i++) {
            const auth = authScores[i];
            const hub = hubScores[i];
            const url = eligibleNodes[i].url;

            const isHighAuth = (auth > medianAuth || (auth === maxAuth && auth > 0)) && auth > 0.00001;
            const isHighHub = (hub > medianHub || (hub === maxHub && hub > 0)) && hub > 0.00001;

            let link_role: LinkRole = 'peripheral';
            if (isHighAuth && isHighHub) link_role = 'power';
            else if (isHighAuth) link_role = 'authority';
            else if (isHighHub) link_role = 'hub';
            else if (auth > 0.00001 && hub > 0.00001) link_role = 'balanced';

            results.set(url, {
                authority_score: auth,
                hub_score: hub,
                link_role
            });
        }

        return results;
    }
}
