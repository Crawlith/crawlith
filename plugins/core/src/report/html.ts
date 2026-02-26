import { Metrics } from '../graph/metrics.js';
import { SITEGRAPH_HTML } from './crawl_template.js';

function safeJson(data: any): string {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function generateHtml(graphData: any, metrics: Metrics): string {
    // Strip heavy HTML content from nodes to keep the report lightweight
    const vizGraphData = {
        ...graphData,
        nodes: graphData.nodes ? graphData.nodes.map((n: any) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { html, ...rest } = n;
            return rest;
        }) : []
    };

    const graphJson = safeJson(vizGraphData);
    const metricsJson = safeJson(metrics);

    return SITEGRAPH_HTML.replace('</body>', `<script>
        window.GRAPH_DATA = ${graphJson};
        window.METRICS_DATA = ${metricsJson};
    </script>
    </body>`);
}
