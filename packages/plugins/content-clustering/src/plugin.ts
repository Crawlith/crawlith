import { PluginContext, Graph } from '@crawlith/core';
import { ClusteringService } from './Service.js';

const service = new ClusteringService();

export const ClusteringHooks = {
    /**
     * On metrics, we compute the clusters and store them.
     */
    onMetrics: async (ctx: PluginContext, graph: Graph) => {
        const threshold = Number(ctx.flags?.clusterThreshold ?? 10);
        const minSize = Number(ctx.flags?.minClusterSize ?? 3);

        ctx.logger?.info(`Detecting content clusters (threshold=${threshold}, minSize=${minSize})...`);
        const clusters = service.detectContentClusters(graph, threshold, minSize);
        ctx.logger?.info(`Found ${clusters.length} content clusters.`);

        // Store per-page cluster IDs
        if (ctx.db) {
            const nodes = graph.getNodes();
            for (const node of nodes) {
                if ((node as any).clusterId) {
                    ctx.db.data.save({
                        url: node.url,
                        data: {
                            cluster_id: (node as any).clusterId
                        }
                    });
                }
            }

            // Store cluster summary in the report context for the onReport hook
            ctx.metadata = ctx.metadata || {};
            ctx.metadata.clusters = clusters;

            // Also save to database report for persistence
            ctx.db.report.save({
                clusters
            });
        }
    },

    /**
     * Inject cluster info into the final report.
     */
    onReport: async (ctx: PluginContext, result: any) => {
        const clusters = ctx.metadata?.clusters;
        if (clusters) {
            result.plugins = result.plugins || {};
            result.plugins.clusters = clusters;
        }
    }
};
