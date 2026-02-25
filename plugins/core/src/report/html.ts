import { Metrics } from '../graph/metrics.js';

function safeJson(data: any): string {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function generateHtml(graphData: any, metrics: Metrics): string {
    const graphJson = safeJson(graphData);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crawlith Site Graph</title>
    <style>
        body { margin: 0; overflow: hidden; font-family: sans-serif; }
        #graph { width: 100vw; height: 100vh; background: #f0f0f0; }
        .tooltip {
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            padding: 10px;
            pointer-events: none;
            font-size: 12px;
            box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
            display: none;
        }
        #metrics {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.9);
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            max-width: 320px;
            max-height: 90vh;
            overflow-y: auto;
            z-index: 100;
        }
        h1 { font-size: 18px; margin-top: 0; }
        h2 { font-size: 14px; margin: 15px 0 5px; border-bottom: 1px solid #ddd; }
        ul { padding-left: 20px; margin: 5px 0; }
        .legend { margin-top: 10px; font-size: 11px; }
        .legend-item { display: flex; align-items: center; margin-bottom: 3px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
        .stat-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 3px; }
        .stat-label { color: #666; }
        .stat-value { font-weight: bold; }
    </style>
</head>
<body>
    <div id="metrics">
        <h1>Crawlith Site Graph</h1>
        
        <div class="stat-row">
            <span class="stat-label">Discovered Pages:</span>
            <span class="stat-value">${metrics.totalPages}</span>
        </div>
        ${metrics.sessionStats ? `
        <div class="stat-row">
            <span class="stat-label">Session Crawl:</span>
            <span class="stat-value">${metrics.sessionStats.pagesFetched} pages</span>
        </div>
        ${metrics.sessionStats.pagesCached > 0 ? `
        <div class="stat-row" style="font-size: 11px; margin-top: -3px;">
            <span class="stat-label" style="padding-left: 10px;">- Reuse Cached:</span>
            <span class="stat-value">${metrics.sessionStats.pagesCached}</span>
        </div>` : ''}
        ` : ''}
        <div class="stat-row">
            <span class="stat-label">Total Edges:</span>
            <span class="stat-value">${metrics.totalEdges}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Max Depth:</span>
            <span class="stat-value">${metrics.maxDepthFound}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Avg Out-Degree:</span>
            <span class="stat-value">${metrics.averageOutDegree.toFixed(2)}</span>
        </div>

        <div class="legend">
            <div class="legend-item"><div class="dot" style="background: red;"></div>Orphan (In-Links: 0)</div>
            <div class="legend-item"><div class="dot" style="background: orange;"></div>Deep (Depth >= 4)</div>
            <div class="legend-item"><div class="dot" style="background: blue;"></div>Normal</div>
        </div>

        ${metrics.topAuthorityPages.length > 0 ? `
        <h3>Top Authority</h3>
        <ul>
            ${metrics.topAuthorityPages.map(p => `<li><a href="${p.url}" target="_blank">${new URL(p.url).pathname}</a> (${p.authority.toFixed(2)})</li>`).join('')}
        </ul>
        ` : ''}

        ${metrics.orphanPages.length > 0 ? `
        <h3>Orphan Pages (${metrics.orphanPages.length})</h3>
        <details>
            <summary>Show list</summary>
            <ul>
                ${metrics.orphanPages.slice(0, 20).map(url => `<li><a href="${url}" target="_blank">${url}</a></li>`).join('')}
                ${metrics.orphanPages.length > 20 ? `<li>... and ${metrics.orphanPages.length - 20} more</li>` : ''}
            </ul>
        </details>
        ` : ''}
    </div>
    <div id="graph"></div>
    <div class="tooltip" id="tooltip"></div>

    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script>
        // Make data available globally
        window.GRAPH_DATA = ${graphJson};
        
        const data = window.GRAPH_DATA;
        const width = window.innerWidth;
        const height = window.innerHeight;

        const svg = d3.select("#graph").append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(d3.zoom().on("zoom", (event) => {
                g.attr("transform", event.transform);
            }));

        const g = svg.append("g");
        
        // Define arrow marker
        svg.append("defs").selectAll("marker")
            .data(["arrow"])
            .enter().append("marker")
            .attr("id", d => d)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 15)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#999");

        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.edges).id(d => d.url).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(d => Math.sqrt((d.inLinks || 0) + 1) * 5 + 2));

        const link = g.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(data.edges)
            .join("line")
            .attr("stroke-width", 1)
            .attr("marker-end", "url(#arrow)");


        const node = g.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(data.nodes)
            .join("circle")
            .attr("r", d => Math.sqrt((d.inLinks || 0) + 1) * 3 + 2)
            .attr("fill", d => {
                if (d.inLinks === 0 && d.depth > 0) return "red";
                if (d.depth >= 4) return "orange";
                return "blue";
            })
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        const tooltip = d3.select("#tooltip");

        node.on("mouseover", (event, d) => {
            tooltip.style("display", "block")
                .html(\`
                    <strong>URL:</strong> \${d.url}<br>
                    <strong>Depth:</strong> \${d.depth}<br>
                    <strong>In-Links:</strong> \${d.inLinks}<br>
                    <strong>Out-Links:</strong> \${d.outLinks}<br>
                    <strong>Status:</strong> \${d.status}
                \`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("display", "none");
        });

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    </script>
</body>
</html>`;
}
