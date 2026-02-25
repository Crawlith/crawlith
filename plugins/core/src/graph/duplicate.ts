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
 * Union-Find (Disjoint Set Union) data structure with path compression and union by rank.
 */
class UnionFind<T> {
    private parent: Map<T, T>;
    private rank: Map<T, number>;

    constructor() {
        this.parent = new Map();
        this.rank = new Map();
    }

    find(item: T): T {
        if (!this.parent.has(item)) {
            this.parent.set(item, item);
            this.rank.set(item, 0);
            return item;
        }

        let root = item;
        while (this.parent.get(root) !== root) {
            root = this.parent.get(root)!;
        }

        // Path compression
        let curr = item;
        while (curr !== root) {
            const next = this.parent.get(curr)!;
            this.parent.set(curr, root);
            curr = next;
        }

        return root;
    }

    union(item1: T, item2: T): void {
        const root1 = this.find(item1);
        const root2 = this.find(item2);

        if (root1 !== root2) {
            const rank1 = this.rank.get(root1) || 0;
            const rank2 = this.rank.get(root2) || 0;

            if (rank1 < rank2) {
                this.parent.set(root1, root2);
            } else if (rank1 > rank2) {
                this.parent.set(root2, root1);
            } else {
                this.parent.set(root2, root1);
                this.rank.set(root1, rank1 + 1);
            }
        }
    }
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
    const exactClusters: DuplicateCluster[] = [];
    const nearCandidates: GraphNode[] = [];
    const exactMap = new Map<string, GraphNode[]>();
    let clusterCounter = startId;

    for (const node of nodes) {
        if (!node.contentHash || node.status !== 200) continue;
        let arr = exactMap.get(node.contentHash);
        if (!arr) {
            arr = [];
            exactMap.set(node.contentHash, arr);
        }
        arr.push(node);
    }

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
    const nearClusters: DuplicateCluster[] = [];
    let clusterCounter = startId;

    const bandsMaps = [
        new Map<number, GraphNode[]>(),
        new Map<number, GraphNode[]>(),
        new Map<number, GraphNode[]>(),
        new Map<number, GraphNode[]>()
    ];

    for (const node of candidates) {
        if (!node.simhash) continue;
        const simhash = BigInt(node.simhash);

        const b0 = Number(simhash & 0xFFFFn);
        const b1 = Number((simhash >> 16n) & 0xFFFFn);
        const b2 = Number((simhash >> 32n) & 0xFFFFn);
        const b3 = Number((simhash >> 48n) & 0xFFFFn);

        const bands = [b0, b1, b2, b3];
        for (let i = 0; i < 4; i++) {
            let arr = bandsMaps[i].get(bands[i]);
            if (!arr) {
                arr = [];
                bandsMaps[i].set(bands[i], arr);
            }
            arr.push(node);
        }
    }

    // Use Union-Find to track connected components of near-duplicates
    const uf = new UnionFind<string>();
    const involvedNodes = new Set<GraphNode>();
    const checkedPairs = new Set<string>();

    for (let i = 0; i < 4; i++) {
        for (const [_bandVal, bucketNodes] of bandsMaps[i].entries()) {
            if (bucketNodes.length < 2) continue;

            for (let j = 0; j < bucketNodes.length; j++) {
                for (let k = j + 1; k < bucketNodes.length; k++) {
                    const n1 = bucketNodes[j];
                    const n2 = bucketNodes[k];

                    const [a, b] = n1.url < n2.url ? [n1, n2] : [n2, n1];
                    const pairKey = Graph.getEdgeKey(a.url, b.url);

                    if (checkedPairs.has(pairKey)) continue;
                    checkedPairs.add(pairKey);

                    const dist = SimHash.hammingDistance(BigInt(a.simhash!), BigInt(b.simhash!));
                    if (dist <= threshold) {
                        uf.union(a.url, b.url);
                        involvedNodes.add(a);
                        involvedNodes.add(b);
                    }
                }
            }
        }
    }

    // Compile clusters from Union-Find roots
    const clusterMap = new Map<string, Set<GraphNode>>();
    for (const node of involvedNodes) {
        const root = uf.find(node.url);
        let group = clusterMap.get(root);
        if (!group) {
            group = new Set();
            clusterMap.set(root, group);
        }
        group.add(node);
    }

    for (const groupSet of clusterMap.values()) {
        if (groupSet.size > 1) {
            const id = `cluster_near_${clusterCounter++}`;
            const groupArr = Array.from(groupSet);
            nearClusters.push({ id, type: 'near', nodes: groupArr });
            for (const n of groupArr) {
                n.duplicateClusterId = id;
                n.duplicateType = 'near';
            }
        }
    }

    return { nearClusters, nextId: clusterCounter };
}

function processClusters(clusters: DuplicateCluster[], graph: Graph, collapse: boolean) {
    // Phase 4: Template-Heavy Detection
    for (const cluster of clusters) {
        const avgRatio = cluster.nodes.reduce((sum, n) => sum + (n.uniqueTokenRatio || 0), 0) / cluster.nodes.length;
        if (avgRatio < 0.3) {
            cluster.type = 'template_heavy';
            cluster.nodes.forEach(n => n.duplicateType = 'template_heavy');
        }
    }

    // Phase 5: Canonical Conflict & Representative Selection
    for (const cluster of clusters) {
        const canonicals = new Set<string>();
        let hasMissing = false;

        for (const n of cluster.nodes) {
            if (!n.canonical) hasMissing = true;
            else canonicals.add(n.canonical);
        }

        if (hasMissing || canonicals.size > 1) {
            cluster.severity = 'high';
        } else if (cluster.type === 'near') {
            cluster.severity = 'medium';
        } else {
            cluster.severity = 'low';
        }

        // Phase 6: Select Representative
        let representativeNode = cluster.nodes[0];
        const urlsInCluster = new Set(cluster.nodes.map(n => n.url));
        const validCanonicals = cluster.nodes.filter(n => n.canonical && urlsInCluster.has(n.canonical) && n.url === n.canonical);

        if (validCanonicals.length > 0) {
            representativeNode = validCanonicals[0];
        } else {
            representativeNode = cluster.nodes.reduce((best, current) => {
                if (current.inLinks > best.inLinks) return current;
                if (current.inLinks < best.inLinks) return best;
                if (current.url.length < best.url.length) return current;
                return best;
            });
        }

        cluster.representative = representativeNode.url;

        cluster.nodes.forEach(n => {
            n.isClusterPrimary = n.url === representativeNode.url;
            n.isCollapsed = false;
            n.collapseInto = undefined;
        });

        graph.duplicateClusters.push({
            id: cluster.id,
            type: cluster.type,
            size: cluster.nodes.length,
            representative: representativeNode.url,
            severity: cluster.severity!
        });

        // Controlled Collapse
        if (collapse) {
            for (const n of cluster.nodes) {
                if (n.url !== representativeNode.url) {
                    n.isCollapsed = true;
                    n.collapseInto = representativeNode.url;
                }
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
