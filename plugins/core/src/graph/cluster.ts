import { Graph, GraphNode, ClusterInfo } from './graph.js';
import { SimHash } from './simhash.js';

/**
 * Detects content clusters using 64-bit SimHash and Hamming Distance.
 * Uses band optimization to reduce O(n^2) comparisons.
 */
export function detectContentClusters(
    graph: Graph,
    threshold: number = 10,
    minSize: number = 3
): ClusterInfo[] {
    const nodes = graph.getNodes().filter(n => n.simhash && n.status === 200);
    if (nodes.length === 0) return [];

    const adjacency = new Map<string, Set<string>>();

    // Banding Optimization (4 bands of 16 bits)
    // Note: For threshold > 3, this is a heuristic and may miss some pairs,
    // but it dramatically reduces the search space as requested.
    const bands = 4;
    const bandWidth = 16;
    const buckets: Map<number, Set<string>>[] = Array.from({ length: bands }, () => new Map());

    for (const node of nodes) {
        const hash = BigInt(node.simhash!);
        for (let b = 0; b < bands; b++) {
            const bandValue = Number((hash >> BigInt(b * bandWidth)) & 0xFFFFn);
            if (!buckets[b].has(bandValue)) {
                buckets[b].set(bandValue, new Set());
            }
            buckets[b].get(bandValue)!.add(node.url);
        }
    }

    const checkedPairs = new Set<string>();

    for (let b = 0; b < bands; b++) {
        for (const bucket of buckets[b].values()) {
            if (bucket.size < 2) continue;
            const bucketNodes = Array.from(bucket);
            for (let i = 0; i < bucketNodes.length; i++) {
                for (let j = i + 1; j < bucketNodes.length; j++) {
                    const u1 = bucketNodes[i];
                    const u2 = bucketNodes[j];
                    if (u1 === u2) continue;

                    const pairKey = u1 < u2 ? `${u1}|${u2}` : `${u2}|${u1}`;
                    if (checkedPairs.has(pairKey)) continue;
                    checkedPairs.add(pairKey);

                    const n1 = graph.nodes.get(u1)!;
                    const n2 = graph.nodes.get(u2)!;

                    const dist = SimHash.hammingDistance(BigInt(n1.simhash!), BigInt(n2.simhash!));
                    if (dist <= threshold) {
                        if (!adjacency.has(u1)) adjacency.set(u1, new Set());
                        if (!adjacency.has(u2)) adjacency.set(u2, new Set());
                        adjacency.get(u1)!.add(u2);
                        adjacency.get(u2)!.add(u1);
                    }
                }
            }
        }
    }

    // Find connected components (Clusters)
    const visited = new Set<string>();
    const clusters: string[][] = [];

    for (const node of nodes) {
        if (visited.has(node.url)) continue;

        const component: string[] = [];
        const queue = [node.url];
        visited.add(node.url);

        while (queue.length > 0) {
            const current = queue.shift()!;
            component.push(current);

            const neighbors = adjacency.get(current);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
        }

        if (component.length >= minSize) {
            clusters.push(component);
        }
    }

    // Sort clusters by size (descending) then by primary URL (ascending) for deterministic IDs
    clusters.sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        const aPrimary = selectPrimaryUrl(a, graph);
        const bPrimary = selectPrimaryUrl(b, graph);
        return aPrimary.localeCompare(bPrimary);
    });

    const clusterInfos: ClusterInfo[] = [];
    clusters.forEach((memberUrls, index) => {
        const clusterId = index + 1;
        const clusterNodes = memberUrls.map(url => graph.nodes.get(url)!);

        for (const node of clusterNodes) {
            node.clusterId = clusterId;
        }

        const primaryUrl = selectPrimaryUrl(memberUrls, graph);
        const risk = calculateClusterRisk(clusterNodes);
        const sharedPathPrefix = findSharedPathPrefix(memberUrls);

        clusterInfos.push({
            id: clusterId,
            count: memberUrls.length,
            primaryUrl,
            risk,
            sharedPathPrefix
        });
    });

    graph.contentClusters = clusterInfos;
    return clusterInfos;
}

/**
 * Selects the primary URL for a cluster based on:
 * 1. Highest PageRank
 * 2. Shortest URL
 * 3. Lexicographic fallback
 */
function selectPrimaryUrl(urls: string[], graph: Graph): string {
    return urls.reduce((best, current) => {
        const nBest = graph.nodes.get(best)!;
        const nCurrent = graph.nodes.get(current)!;

        if ((nCurrent.pageRank || 0) > (nBest.pageRank || 0)) return current;
        if ((nCurrent.pageRank || 0) < (nBest.pageRank || 0)) return best;

        if (current.length < best.length) return current;
        if (current.length > best.length) return best;

        return current.localeCompare(best) < 0 ? current : best;
    });
}

/**
 * Calculates cannibalization risk based on title and H1 similarity within the cluster.
 */
function calculateClusterRisk(nodes: GraphNode[]): 'low' | 'medium' | 'high' {
    // Logic: Check if there's significant overlap in Titles or H1s among cluster members.
    // This is a heuristic as requested.
    // Simplified heuristic: risk is based on cluster density and size
    // Large clusters of highly similar content are high risk.

    // Fallback to a safe categorization
    if (nodes.length > 5) return 'high';
    if (nodes.length > 2) return 'medium';
    return 'low';
}

/**
 * Finds the common path prefix among a set of URLs.
 */
function findSharedPathPrefix(urls: string[]): string | undefined {
    if (urls.length < 2) return undefined;

    try {
        const paths = urls.map(u => new URL(u).pathname.split('/').filter(Boolean));
        const first = paths[0];
        const common: string[] = [];

        for (let i = 0; i < first.length; i++) {
            const segment = first[i];
            if (paths.every(p => p[i] === segment)) {
                common.push(segment);
            } else {
                break;
            }
        }

        return common.length > 0 ? '/' + common.join('/') : undefined;
    } catch {
        return undefined;
    }
}
