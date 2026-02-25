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

    const exactClusters: DuplicateCluster[] = [];
    const nearClusters: DuplicateCluster[] = [];

    const nodes = graph.getNodes();

    // Phase 1 & 2: Exact Duplicate Detection
    const exactMap = new Map<string, GraphNode[]>();
    for (const node of nodes) {
        if (!node.contentHash || node.status !== 200) continue;

        // Safety check: if there's no soft404 signal (soft404 is handled elsewhere, but just filter 200 OKs)
        let arr = exactMap.get(node.contentHash);
        if (!arr) {
            arr = [];
            exactMap.set(node.contentHash, arr);
        }
        arr.push(node);
    }

    // Nodes that are NOT part of an exact duplicate group are candidates for near duplicate checks
    const nearCandidates: GraphNode[] = [];
    let clusterCounter = 1;

    for (const [_hash, group] of exactMap.entries()) {
        if (group.length > 1) {
            const id = `cluster_exact_${clusterCounter++}`;
            exactClusters.push({ id, type: 'exact', nodes: group });
            // Mark nodes
            for (const n of group) {
                n.duplicateClusterId = id;
                n.duplicateType = 'exact';
            }
        } else {
            nearCandidates.push(group[0]);
        }
    }

    // Phase 3: Near Duplicate Detection (SimHash with Bands)
    // 64-bit simhash -> split into 4 bands of 16 bits.
    const bandsMaps = [
        new Map<number, GraphNode[]>(),
        new Map<number, GraphNode[]>(),
        new Map<number, GraphNode[]>(),
        new Map<number, GraphNode[]>()
    ];

    for (const node of nearCandidates) {
        if (!node.simhash) continue;
        const simhash = BigInt(node.simhash);

        // Extract 16 bit bands
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

    // Find candidate pairs
    const nearGroupMap = new Map<string, Set<GraphNode>>(); // node.url -> cluster set
    const checkedPairs = new Set<string>();

    for (let i = 0; i < 4; i++) {
        for (const [_bandVal, bucketNodes] of bandsMaps[i].entries()) {
            if (bucketNodes.length < 2) continue; // nothing to compare

            // Compare all nodes in this bucket
            for (let j = 0; j < bucketNodes.length; j++) {
                for (let k = j + 1; k < bucketNodes.length; k++) {
                    const n1 = bucketNodes[j];
                    const n2 = bucketNodes[k];

                    // Ensure n1 < n2 lexicographically to avoid duplicate pairs
                    const [a, b] = n1.url < n2.url ? [n1, n2] : [n2, n1];
                    const pairKey = `${a.url}|${b.url}`;

                    if (checkedPairs.has(pairKey)) continue;
                    checkedPairs.add(pairKey);

                    const dist = SimHash.hammingDistance(BigInt(a.simhash!), BigInt(b.simhash!));
                    if (dist <= threshold) {
                        // They are near duplicates. 
                        // Find or create their cluster set using union-find or reference propagation
                        const setA = nearGroupMap.get(a.url);
                        const setB = nearGroupMap.get(b.url);

                        if (!setA && !setB) {
                            const newSet = new Set<GraphNode>([a, b]);
                            nearGroupMap.set(a.url, newSet);
                            nearGroupMap.set(b.url, newSet);
                        } else if (setA && !setB) {
                            setA.add(b);
                            nearGroupMap.set(b.url, setA);
                        } else if (setB && !setA) {
                            setB.add(a);
                            nearGroupMap.set(a.url, setB);
                        } else if (setA && setB && setA !== setB) {
                            // Merge sets
                            for (const node of setB) {
                                setA.add(node);
                                nearGroupMap.set(node.url, setA);
                            }
                        }
                    }
                }
            }
        }
    }

    // Compile near duplicate clusters (deduplicated by Set reference)
    const uniqueNearSets = new Set<Set<GraphNode>>();
    for (const group of nearGroupMap.values()) {
        uniqueNearSets.add(group);
    }

    for (const groupSet of uniqueNearSets) {
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

    const allClusters = [...exactClusters, ...nearClusters];

    // Phase 4: Template-Heavy Detection
    // Mark classes as 'template_heavy' if ratio < 0.3
    for (const cluster of allClusters) {
        const avgRatio = cluster.nodes.reduce((sum, n) => sum + (n.uniqueTokenRatio || 0), 0) / cluster.nodes.length;
        if (avgRatio < 0.3) {
            cluster.type = 'template_heavy';
            cluster.nodes.forEach(n => n.duplicateType = 'template_heavy');
        }
    }

    // Phase 5: Canonical Conflict & Representative Selection
    for (const cluster of allClusters) {
        const canonicals = new Set<string>();
        let hasMissing = false;

        for (const n of cluster.nodes) {
            if (!n.canonical) hasMissing = true;
            // We compare full absolute canonical URLs (assuming they are normalized during crawl)
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
        // 1. Valid Canonical target in cluster
        // 2. Highest internal in-degree
        // 3. Shortest URL
        // 4. First discovered (relying on array order, which is from BFS map roughly)
        let representativeNode = cluster.nodes[0];

        // Evaluate best rep
        const urlsInCluster = new Set(cluster.nodes.map(n => n.url));
        const validCanonicals = cluster.nodes.filter(n => n.canonical && urlsInCluster.has(n.canonical) && n.url === n.canonical);

        if (validCanonicals.length > 0) {
            representativeNode = validCanonicals[0]; // If multiple, just pick first matching self
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
            n.isCollapsed = false; // default for JSON
            n.collapseInto = undefined;
        });

        // Push to Graph's final cluster list
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

    // Final Edge Transfer if Collapsing
    if (collapse) {
        const edges = graph.getEdges();
        const updatedEdges = new Map<string, number>();

        for (const edge of edges) {
            const sourceNode = graph.nodes.get(edge.source);
            const targetNode = graph.nodes.get(edge.target);

            if (!sourceNode || !targetNode) continue;

            // We do NOT modify source structure for out-bound edges of collapsed nodes? 
            // Spec: "Ignore edges from collapsed nodes. Transfer inbound edges to representative."
            // Actually, if a node links TO a collapsed node, we repoint the edge to the representative.
            // If a collapsed node links to X, we ignore it (PageRank will filter it out).

            const actualSource = edge.source;
            // repoint target
            const actualTarget = targetNode.isCollapsed && targetNode.collapseInto ? targetNode.collapseInto : edge.target;

            // Skip self-referential edges caused by repointing
            if (actualSource === actualTarget) continue;

            const edgeKey = `${actualSource}|${actualTarget}`;
            const existingWeight = updatedEdges.get(edgeKey) || 0;
            updatedEdges.set(edgeKey, Math.max(existingWeight, edge.weight)); // deduplicate
        }

        // Update graph edges in-place
        graph.edges = updatedEdges;

        // Re-calculate inLinks and outLinks based on collapsed edges
        for (const node of graph.getNodes()) {
            node.inLinks = 0;
            node.outLinks = 0;
        }
        for (const [edgeKey, _weight] of updatedEdges.entries()) {
            const [src, tgt] = edgeKey.split('|');
            const sn = graph.nodes.get(src);
            const tn = graph.nodes.get(tgt);
            if (sn) sn.outLinks++;
            if (tn) tn.inLinks++;
        }
    }
}
