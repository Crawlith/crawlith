import { Graph, SimHash, analyzeContent, analyzeH1, analyzeTitle } from '../index.js';

export interface ClusterInfo {
    id: number;
    count: number;
    primaryUrl: string;
    risk: 'low' | 'medium' | 'high';
    sharedPathPrefix?: string;
    nodes?: string[];
}

export interface ClusteringOptions {
    threshold?: number;
    minSize?: number;
}

export class ClusteringService {
    /**
     * Detects content clusters using 64-bit SimHash and Hamming Distance.
     * Uses band optimization to reduce O(n^2) comparisons.
     */
    public detectContentClusters(
        graph: Graph,
        threshold: number = 10,
        minSize: number = 3
    ): ClusterInfo[] {
        const nodes = graph.getNodes().filter(n => n.simhash && n.status === 200);
        if (nodes.length === 0) return [];

        const adjacency = new Map<string, Set<string>>();

        // Banding Optimization (4 bands of 16 bits)
        const buckets: Map<number, string[]>[] = Array.from({ length: SimHash.BANDS }, () => new Map());

        for (const node of nodes) {
            const hash = BigInt(node.simhash!);
            const bandValues = SimHash.getBands(hash);

            bandValues.forEach((bandValue, b) => {
                if (!buckets[b].has(bandValue)) {
                    buckets[b].set(bandValue, []);
                }
                buckets[b].get(bandValue)!.push(node.url);
            });
        }

        const checkedPairs = new Set<string>();

        for (let b = 0; b < SimHash.BANDS; b++) {
            for (const bucket of buckets[b].values()) {
                if (bucket.length < 2) continue;
                const bucketNodes = bucket;
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
            const aPrimary = this.selectPrimaryUrl(a, graph);
            const bPrimary = this.selectPrimaryUrl(b, graph);
            return aPrimary.localeCompare(bPrimary);
        });

        const clusterInfos: ClusterInfo[] = [];
        clusters.forEach((memberUrls, index) => {
            const clusterId = index + 1;
            const clusterNodes = memberUrls.map(url => graph.nodes.get(url)!);

            for (const node of clusterNodes) {
                (node as any).clusterId = clusterId;
            }

            const primaryUrl = this.selectPrimaryUrl(memberUrls, graph);
            const risk = this.calculateClusterRisk(clusterNodes);
            const sharedPathPrefix = this.findSharedPathPrefix(memberUrls);

            clusterInfos.push({
                id: clusterId,
                count: memberUrls.length,
                primaryUrl,
                risk,
                sharedPathPrefix,
                nodes: memberUrls
            });
        });

        return clusterInfos;
    }

    private selectPrimaryUrl(urls: string[], graph: Graph): string {
        return urls.reduce((best, current) => {
            const nBest = graph.nodes.get(best)!;
            const nCurrent = graph.nodes.get(current)!;

            if (nCurrent.inLinks > nBest.inLinks) return current;
            if (nCurrent.inLinks < nBest.inLinks) return best;

            if (current.length < best.length) return current;
            if (current.length > best.length) return best;

            return current.localeCompare(best) < 0 ? current : best;
        });
    }

    private calculateClusterRisk(nodes: any[]): 'low' | 'medium' | 'high' {
        if (nodes.length <= 1) return 'low';

        const titleCounts = new Map<string, number>();
        const h1Counts = new Map<string, number>();
        let processedCount = 0;

        for (const node of nodes) {
            if (!node.html) continue;

            const titleRes = analyzeTitle(node.html);
            const h1Res = analyzeH1(node.html, titleRes.value);
            const title = titleRes.value || '';
            const h1 = h1Res.value || '';

            if (title) {
                titleCounts.set(title.toLowerCase(), (titleCounts.get(title.toLowerCase()) || 0) + 1);
            }
            if (h1) {
                h1Counts.set(h1.toLowerCase(), (h1Counts.get(h1.toLowerCase()) || 0) + 1);
            }
            processedCount++;
        }

        if (processedCount < nodes.length * 0.5) {
            if (nodes.length > 5) return 'high';
            if (nodes.length > 2) return 'medium';
            return 'low';
        }

        let duplicateTitleCount = 0;
        let duplicateH1Count = 0;

        for (const count of titleCounts.values()) {
            if (count > 1) duplicateTitleCount += count;
        }
        for (const count of h1Counts.values()) {
            if (count > 1) duplicateH1Count += count;
        }

        const titleDupeRatio = duplicateTitleCount / nodes.length;
        const h1DupeRatio = duplicateH1Count / nodes.length;

        if (titleDupeRatio > 0.3 || h1DupeRatio > 0.3) {
            return 'high';
        }

        if (titleDupeRatio > 0 || h1DupeRatio > 0 || nodes.length > 10) {
            return 'medium';
        }

        return 'low';
    }

    private findSharedPathPrefix(urls: string[]): string | undefined {
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
}
