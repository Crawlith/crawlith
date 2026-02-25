import { Graph, GraphNode } from './graph.js';
import { SimHash } from './simhash.js';

export interface DuplicateOptions {
    collapse?: boolean;
    simhashThreshold?: number; // Hamming distance threshold (default: 3)
}

interface DuplicateCluster {
    id: string;
    type: 'exact' | 'near' | 'template_heavy';
    nodes: GraphNode[];
    representative?: string;
    severity?: 'low' | 'medium' | 'high';
}

/**
 * Detects exact and near duplicates, identifies canonical conflicts,
 * and performs non-destructive collapse of edges.
 */
export function detectDuplicates(graph: Graph, options: DuplicateOptions = {}) {
    const collapse = options.collapse !== false; // Default to true
    const threshold = options.simhashThreshold ?? 3;
    const nodes = graph.getNodes();
    let clusterCounter = 1;

    // Phase 1 & 2: Exact Duplicate Detection
    const { exactClusters, nearCandidates, nextId: nextId1 } = findExactDuplicates(nodes, clusterCounter);
    clusterCounter = nextId1;

    // Phase 3: Near Duplicate Detection
    const { nearClusters } = findNearDuplicates(nearCandidates, threshold, clusterCounter);

    const allClusters = [...exactClusters, ...nearClusters];

    // Phase 4, 5, 6: Process Clusters (Template-Heavy, Canonical, Representative)
    processClusters(allClusters, graph, collapse);

    // Final Edge Transfer if Collapsing
    if (collapse) {
        collapseEdges(graph);
    }
}

function findExactDuplicates(nodes: GraphNode[], startId: number): { exactClusters: DuplicateCluster[], nearCandidates: GraphNode[], nextId: number } {
    const exactMap = groupNodesByContentHash(nodes);
    return createExactClusters(exactMap, startId);
}

function groupNodesByContentHash(nodes: GraphNode[]): Map<string, GraphNode[]> {
    const exactMap = new Map<string, GraphNode[]>();
    for (const node of nodes) {
        if (!node.contentHash || node.status !== 200) continue;
        let arr = exactMap.get(node.contentHash);
        if (!arr) {
            arr = [];
            exactMap.set(node.contentHash, arr);
        }
        arr.push(node);
    }
    return exactMap;
}

function createExactClusters(exactMap: Map<string, GraphNode[]>, startId: number): { exactClusters: DuplicateCluster[], nearCandidates: GraphNode[], nextId: number } {
    const exactClusters: DuplicateCluster[] = [];
    const nearCandidates: GraphNode[] = [];
    let clusterCounter = startId;

    for (const [_hash, group] of exactMap.entries()) {
        if (group.length > 1) {
            const id = `cluster_exact_${clusterCounter++}`;
            exactClusters.push({ id, type: 'exact', nodes: group });
            for (const n of group) {
                n.duplicateClusterId = id;
                n.duplicateType = 'exact';
            }
        } else {
            nearCandidates.push(group[0]);
        }
    }

    return { exactClusters, nearCandidates, nextId: clusterCounter };
}

function findNearDuplicates(candidates: GraphNode[], threshold: number, startId: number): { nearClusters: DuplicateCluster[], nextId: number } {
    const { bandsMaps, simhashes } = buildSimHashBuckets(candidates);
    const { parent, involvedIndices } = findConnectedComponents(bandsMaps, simhashes, candidates.length, threshold);
    return extractClusters(parent, involvedIndices, candidates, startId);
}

function buildSimHashBuckets(candidates: GraphNode[]): { bandsMaps: Map<number, number[]>[], simhashes: BigUint64Array, validIndices: number[] } {
    const n = candidates.length;
    const simhashes = new BigUint64Array(n);
    const validIndices: number[] = [];

    for (let i = 0; i < n; i++) {
        if (candidates[i].simhash) {
            simhashes[i] = BigInt(candidates[i].simhash!);
            validIndices.push(i);
        }
    }

    const bandsMaps: Map<number, number[]>[] = Array.from({ length: SimHash.BANDS }, () => new Map());

    for (const idx of validIndices) {
        const bands = SimHash.getBands(simhashes[idx]);
        for (let b = 0; b < SimHash.BANDS; b++) {
            let arr = bandsMaps[b].get(bands[b]);
            if (!arr) {
                arr = [];
                bandsMaps[b].set(bands[b], arr);
            }
            arr.push(idx);
        }
    }

    return { bandsMaps, simhashes, validIndices };
}

function findConnectedComponents(bandsMaps: Map<number, number[]>[], simhashes: BigUint64Array, n: number, threshold: number): { parent: Uint32Array, involvedIndices: Set<number> } {
    // Union-Find Arrays (Integer-based)
    const parent = new Uint32Array(n);
    const rank = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        parent[i] = i;
        rank[i] = 0;
    }

    function find(i: number): number {
        let root = i;
        while (parent[root] !== root) {
            root = parent[root];
        }
        let curr = i;
        while (curr !== root) {
            const next = parent[curr];
            parent[curr] = root;
            curr = next;
        }
        return root;
    }

    function union(i: number, j: number) {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) {
            const rankI = rank[rootI];
            const rankJ = rank[rootJ];
            if (rankI < rankJ) {
                parent[rootI] = rootJ;
            } else if (rankI > rankJ) {
                parent[rootJ] = rootI;
            } else {
                parent[rootJ] = rootI;
                rank[rootI]++;
            }
        }
    }

    const involvedIndices = new Set<number>();

    for (let b = 0; b < SimHash.BANDS; b++) {
        for (const bucketIndices of bandsMaps[b].values()) {
            if (bucketIndices.length < 2) continue;

            for (let j = 0; j < bucketIndices.length; j++) {
                for (let k = j + 1; k < bucketIndices.length; k++) {
                    const idx1 = bucketIndices[j];
                    const idx2 = bucketIndices[k];

                    const root1 = find(idx1);
                    const root2 = find(idx2);

                    if (root1 === root2) continue; // Already connected, skip expensive distance check

                    const dist = SimHash.hammingDistance(simhashes[idx1], simhashes[idx2]);
                    if (dist <= threshold) {
                        union(root1, root2);
                        involvedIndices.add(idx1);
                        involvedIndices.add(idx2);
                    }
                }
            }
        }
    }

    return { parent, involvedIndices };
}

function extractClusters(parent: Uint32Array, involvedIndices: Set<number>, candidates: GraphNode[], startId: number): { nearClusters: DuplicateCluster[], nextId: number } {
    const nearClusters: DuplicateCluster[] = [];
    let clusterCounter = startId;

    function find(i: number): number {
        let root = i;
        while (parent[root] !== root) {
            root = parent[root];
        }
        let curr = i;
        while (curr !== root) {
            const next = parent[curr];
            parent[curr] = root;
            curr = next;
        }
        return root;
    }

    // Compile clusters
    const clusterMap = new Map<number, number[]>();
    for (const idx of involvedIndices) {
        const root = find(idx);
        let group = clusterMap.get(root);
        if (!group) {
            group = [];
            clusterMap.set(root, group);
        }
        group.push(idx);
    }

    for (const groupIndices of clusterMap.values()) {
        if (groupIndices.length > 1) {
            const id = `cluster_near_${clusterCounter++}`;
            const groupNodes = groupIndices.map(idx => candidates[idx]);
            nearClusters.push({ id, type: 'near', nodes: groupNodes });
            for (const n of groupNodes) {
                n.duplicateClusterId = id;
                n.duplicateType = 'near';
            }
        }
    }

    return { nearClusters, nextId: clusterCounter };
}

function processClusters(clusters: DuplicateCluster[], graph: Graph, collapse: boolean) {
    for (const cluster of clusters) {
        processSingleCluster(cluster, graph, collapse);
    }
}

function processSingleCluster(cluster: DuplicateCluster, graph: Graph, collapse: boolean) {
    checkTemplateHeavy(cluster);
    cluster.severity = calculateSeverity(cluster);
    const representative = selectRepresentative(cluster);
    cluster.representative = representative.url;
    applyClusterToGraph(cluster, representative, graph, collapse);
}

function checkTemplateHeavy(cluster: DuplicateCluster) {
    const avgRatio = cluster.nodes.reduce((sum, n) => sum + (n.uniqueTokenRatio || 0), 0) / cluster.nodes.length;
    if (avgRatio < 0.3) {
        cluster.type = 'template_heavy';
        cluster.nodes.forEach(n => n.duplicateType = 'template_heavy');
    }
}

function calculateSeverity(cluster: DuplicateCluster): 'low' | 'medium' | 'high' {
    const canonicals = new Set<string>();
    let hasMissing = false;

    for (const n of cluster.nodes) {
        if (!n.canonical) hasMissing = true;
        else canonicals.add(n.canonical);
    }

    if (hasMissing || canonicals.size > 1) {
        return 'high';
    } else if (cluster.type === 'near') {
        return 'medium';
    } else {
        return 'low';
    }
}

function selectRepresentative(cluster: DuplicateCluster): GraphNode {
    const urlsInCluster = new Set(cluster.nodes.map(n => n.url));
    const validCanonicals = cluster.nodes.filter(n => n.canonical && urlsInCluster.has(n.canonical) && n.url === n.canonical);

    if (validCanonicals.length > 0) {
        return validCanonicals[0];
    }

    return cluster.nodes.reduce((best, current) => {
        if (current.inLinks > best.inLinks) return current;
        if (current.inLinks < best.inLinks) return best;
        if (current.url.length < best.url.length) return current;
        return best;
    });
}

function applyClusterToGraph(cluster: DuplicateCluster, representative: GraphNode, graph: Graph, collapse: boolean) {
    cluster.nodes.forEach(n => {
        n.isClusterPrimary = n.url === representative.url;
        n.isCollapsed = false;
        n.collapseInto = undefined;
    });

    graph.duplicateClusters.push({
        id: cluster.id,
        type: cluster.type,
        size: cluster.nodes.length,
        representative: representative.url,
        severity: cluster.severity!
    });

    if (collapse) {
        for (const n of cluster.nodes) {
            if (n.url !== representative.url) {
                n.isCollapsed = true;
                n.collapseInto = representative.url;
            }
        }
    }
}

function collapseEdges(graph: Graph) {
    const edges = graph.getEdges();
    const updatedEdges = new Map<string, number>();

    for (const edge of edges) {
        const sourceNode = graph.nodes.get(edge.source);
        const targetNode = graph.nodes.get(edge.target);

        if (!sourceNode || !targetNode) continue;

        const actualSource = edge.source;
        const actualTarget = targetNode.isCollapsed && targetNode.collapseInto ? targetNode.collapseInto : edge.target;

        if (actualSource === actualTarget) continue;

        const edgeKey = Graph.getEdgeKey(actualSource, actualTarget);
        const existingWeight = updatedEdges.get(edgeKey) || 0;
        updatedEdges.set(edgeKey, Math.max(existingWeight, edge.weight));
    }

    graph.edges = updatedEdges;

    // Re-calculate inLinks and outLinks based on collapsed edges
    for (const node of graph.getNodes()) {
        node.inLinks = 0;
        node.outLinks = 0;
    }
    for (const [edgeKey, _weight] of updatedEdges.entries()) {
        const { source: src, target: tgt } = Graph.parseEdgeKey(edgeKey);
        const sn = graph.nodes.get(src);
        const tn = graph.nodes.get(tgt);
        if (sn) sn.outLinks++;
        if (tn) tn.inLinks++;
    }
}
