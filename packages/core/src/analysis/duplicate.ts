import { Graph, GraphNode, SimHash } from '../index.js';

export interface DuplicateOptions {
    collapse?: boolean;
    simhashThreshold?: number; // Hamming distance threshold (default: 3)
}

export interface DuplicateCluster {
    id: string;
    type: 'exact' | 'near' | 'template_heavy';
    nodes: GraphNode[];
    representative?: string;
    severity?: 'low' | 'medium' | 'high';
}

export class DuplicateService {
    /**
     * Detects exact and near duplicates, identifies canonical conflicts,
     * and performs non-destructive collapse of edges.
     */
    public detectDuplicates(graph: Graph, options: DuplicateOptions = {}): DuplicateCluster[] {
        const collapse = options.collapse !== false; // Default to true
        const threshold = options.simhashThreshold ?? 3;
        const nodes = graph.getNodes();
        let clusterCounter = 1;

        // Phase 1 & 2: Exact Duplicate Detection
        const { exactClusters, nearCandidates, nextId: nextId1 } = this.findExactDuplicates(nodes, clusterCounter);
        clusterCounter = nextId1;

        // Phase 3: Near Duplicate Detection
        const { nearClusters } = this.findNearDuplicates(nearCandidates, threshold, clusterCounter);

        const allClusters = [...exactClusters, ...nearClusters];

        // Phase 4, 5, 6: Process Clusters (Template-Heavy, Canonical, Representative)
        this.processClusters(allClusters, graph, collapse);

        // Final Edge Transfer if Collapsing
        if (collapse) {
            this.collapseEdges(graph);
        }

        return allClusters;
    }

    private findExactDuplicates(nodes: GraphNode[], startId: number): { exactClusters: DuplicateCluster[], nearCandidates: GraphNode[], nextId: number } {
        const exactMap = this.groupNodesByContentHash(nodes);
        return this.createExactClusters(exactMap, startId);
    }

    private groupNodesByContentHash(nodes: GraphNode[]): Map<string, GraphNode[]> {
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

    private createExactClusters(exactMap: Map<string, GraphNode[]>, startId: number): { exactClusters: DuplicateCluster[], nearCandidates: GraphNode[], nextId: number } {
        const exactClusters: DuplicateCluster[] = [];
        const nearCandidates: GraphNode[] = [];
        let clusterCounter = startId;

        for (const group of exactMap.values()) {
            if (group.length > 1) {
                const id = `cluster_exact_${clusterCounter++}`;
                exactClusters.push({ id, type: 'exact', nodes: group });
                for (const n of group) {
                    (n as any).duplicateClusterId = id;
                    (n as any).duplicateType = 'exact';
                }
            } else {
                nearCandidates.push(group[0]);
            }
        }

        return { exactClusters, nearCandidates, nextId: clusterCounter };
    }

    private findNearDuplicates(candidates: GraphNode[], threshold: number, startId: number): { nearClusters: DuplicateCluster[], nextId: number } {
        const { bandsMaps, simhashes } = this.buildSimHashBuckets(candidates);
        const { parent, involvedIndices } = this.findConnectedComponents(bandsMaps, simhashes, candidates.length, threshold);
        return this.extractClusters(parent, involvedIndices, candidates, startId);
    }

    private buildSimHashBuckets(candidates: GraphNode[]): { bandsMaps: Map<number, number[]>[], simhashes: BigUint64Array, validIndices: number[] } {
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

    private findConnectedComponents(bandsMaps: Map<number, number[]>[], simhashes: BigUint64Array, n: number, threshold: number): { parent: Uint32Array, involvedIndices: Set<number> } {
        const parent = new Uint32Array(n);
        const rank = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            parent[i] = i;
            rank[i] = 0;
        }

        const find = (i: number): number => {
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
        };

        const union = (i: number, j: number) => {
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
        };

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

                        if (root1 === root2) continue;

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

    private extractClusters(parent: Uint32Array, involvedIndices: Set<number>, candidates: GraphNode[], startId: number): { nearClusters: DuplicateCluster[], nextId: number } {
        const nearClusters: DuplicateCluster[] = [];
        let clusterCounter = startId;

        const find = (i: number): number => {
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
        };

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
                    (n as any).duplicateClusterId = id;
                    (n as any).duplicateType = 'near';
                }
            }
        }

        return { nearClusters, nextId: clusterCounter };
    }

    private processClusters(clusters: DuplicateCluster[], graph: Graph, collapse: boolean) {
        for (const cluster of clusters) {
            this.processSingleCluster(cluster, graph, collapse);
        }
    }

    private processSingleCluster(cluster: DuplicateCluster, graph: Graph, collapse: boolean) {
        this.checkTemplateHeavy(cluster);
        cluster.severity = this.calculateSeverity(cluster);
        const representative = this.selectRepresentative(cluster);
        cluster.representative = representative.url;
        this.applyClusterToGraph(cluster, representative, graph, collapse);
    }

    private checkTemplateHeavy(cluster: DuplicateCluster) {
        // @ts-ignore
        const avgRatio = cluster.nodes.reduce((sum, n) => sum + (n.uniqueTokenRatio || 0), 0) / cluster.nodes.length;
        if (avgRatio < 0.3) {
            cluster.type = 'template_heavy';
            cluster.nodes.forEach(n => (n as any).duplicateType = 'template_heavy');
        }
    }

    private calculateSeverity(cluster: DuplicateCluster): 'low' | 'medium' | 'high' {
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

    private selectRepresentative(cluster: DuplicateCluster): GraphNode {
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

    private applyClusterToGraph(cluster: DuplicateCluster, representative: GraphNode, graph: Graph, collapse: boolean) {
        cluster.nodes.forEach(n => {
            (n as any).isClusterPrimary = n.url === representative.url;
            (n as any).isCollapsed = false;
            (n as any).collapseInto = undefined;
        });

        if (!(graph as any).duplicateClusters) {
            (graph as any).duplicateClusters = [];
        }

        (graph as any).duplicateClusters.push({
            id: cluster.id,
            type: cluster.type,
            size: cluster.nodes.length,
            representative: representative.url,
            severity: cluster.severity!
        });

        if (collapse) {
            for (const n of cluster.nodes) {
                if (n.url !== representative.url) {
                    (n as any).isCollapsed = true;
                    (n as any).collapseInto = representative.url;
                }
            }
        }
    }

    private collapseEdges(graph: Graph) {
        const edges = graph.getEdges();
        const updatedEdges = new Map<string, number>();

        for (const edge of edges) {
            const targetNode = graph.nodes.get(edge.target);
            if (!targetNode) continue;

            const actualSource = edge.source;
            const actualTarget = (targetNode as any).isCollapsed && (targetNode as any).collapseInto ? (targetNode as any).collapseInto : edge.target;

            if (actualSource === actualTarget) continue;

            const edgeKey = Graph.getEdgeKey(actualSource, actualTarget);
            const existingWeight = updatedEdges.get(edgeKey) || 0;
            updatedEdges.set(edgeKey, Math.max(existingWeight, edge.weight));
        }

        graph.edges = updatedEdges;

        // Re-calculate inLinks and outLinks
        for (const node of graph.getNodes()) {
            node.inLinks = 0;
            node.outLinks = 0;
        }
        for (const edgeKey of updatedEdges.keys()) {
            const { source: src, target: tgt } = Graph.parseEdgeKey(edgeKey);
            const sn = graph.nodes.get(src);
            const tn = graph.nodes.get(tgt);
            if (sn) sn.outLinks++;
            if (tn) tn.inLinks++;
        }
    }
}
