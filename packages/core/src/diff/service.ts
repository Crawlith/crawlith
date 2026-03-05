import { Graph } from '../graph/graph.js';

export interface DiffOptions {
    onlyCritical?: boolean;
}

export interface SnapshotDiff {
    newPages: string[];
    removedPages: string[];
    changedPages: {
        url: string;
        changes: string[];
        severity: 'low' | 'medium' | 'high';
    }[];
}

export class DiffService {
    public compare(oldGraph: Graph | undefined, newGraph: Graph, _options: DiffOptions = {}): SnapshotDiff {
        if (!oldGraph) {
            return {
                newPages: Array.from(newGraph.nodes.keys()),
                removedPages: [],
                changedPages: []
            };
        }

        const oldUrls = new Set(oldGraph.nodes.keys());
        const newUrls = new Set(newGraph.nodes.keys());

        const newPages = Array.from(newUrls).filter(u => !oldUrls.has(u));
        const removedPages = Array.from(oldUrls).filter(u => !newUrls.has(u));
        const changedPages: SnapshotDiff['changedPages'] = [];

        for (const url of newUrls) {
            if (oldUrls.has(url)) {
                const oldNode = oldGraph.nodes.get(url)!;
                const newNode = newGraph.nodes.get(url)!;
                const changes: string[] = [];
                let severity: 'low' | 'medium' | 'high' = 'low';

                if (oldNode.status !== newNode.status) {
                    changes.push(`status: ${oldNode.status} -> ${newNode.status}`);
                    severity = 'high';
                }

                if (oldNode.contentHash !== newNode.contentHash) {
                    changes.push('content changed');
                    if (severity !== 'high') severity = 'medium';
                }

                if (oldNode.noindex !== newNode.noindex) {
                    changes.push(`noindex: ${oldNode.noindex} -> ${newNode.noindex}`);
                    severity = 'high';
                }

                if (changes.length > 0) {
                    changedPages.push({ url, changes, severity });
                }
            }
        }

        return { newPages, removedPages, changedPages };
    }
}
