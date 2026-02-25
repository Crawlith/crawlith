export const SITEGRAPH_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crawlith Site Graph</title>
  <style>
    :root {
      --bg-color: #121212;
      --text-color: #e0e0e0;
      --panel-bg: #1e1e1e;
      --border-color: #333;
      --accent-color: #4a90e2;
      --sidebar-width: 300px;
    }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg-color); color: var(--text-color); height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

    /* Layout */
    header { padding: 0 20px; background: var(--panel-bg); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; height: 60px; box-sizing: border-box; z-index: 10; }
    main { flex: 1; display: flex; overflow: hidden; position: relative; }
    #graph-container { flex: 1; position: relative; overflow: hidden; background: var(--bg-color); }
    #details-panel { width: var(--sidebar-width); background: var(--panel-bg); border-left: 1px solid var(--border-color); padding: 20px; overflow-y: auto; box-sizing: border-box; display: none; flex-direction: column; gap: 15px; }
    #details-panel.visible { display: flex; }
    footer { padding: 5px 20px; background: var(--panel-bg); border-top: 1px solid var(--border-color); font-size: 0.8rem; text-align: center; color: #666; height: 30px; display: flex; align-items: center; justify-content: center; }

    /* Header Components */
    .brand { font-weight: bold; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
    .brand span { color: var(--accent-color); }
    #metrics-summary { font-size: 0.9rem; color: #aaa; display: flex; gap: 20px; }
    .metric { display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
    .metric-value { font-weight: bold; color: var(--text-color); }
    .metric-label { font-size: 0.7rem; }

    #controls { display: flex; gap: 10px; align-items: center; }
    .btn-group { display: flex; background: #333; border-radius: 4px; overflow: hidden; }
    button { background: transparent; color: #aaa; border: none; padding: 6px 12px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; }
    button:hover { color: white; background: rgba(255,255,255,0.1); }
    button.active { background: var(--accent-color); color: white; }

    /* Search */
    #search-container { position: absolute; top: 15px; left: 15px; z-index: 5; }
    #search-input { background: rgba(30,30,30,0.9); border: 1px solid #444; color: white; padding: 8px 12px; border-radius: 20px; width: 200px; outline: none; transition: width 0.3s; }
    #search-input:focus { width: 280px; border-color: var(--accent-color); }

    /* Graph */
    svg { width: 100%; height: 100%; display: block; }
    .node { cursor: pointer; transition: stroke-width 0.1s; }
    .link { stroke: #555; stroke-opacity: 0.3; fill: none; pointer-events: none; }

    /* Interaction States */
    .node.highlight { stroke: #fff; stroke-width: 2px; }
    .link.highlight { stroke-opacity: 0.8; stroke: #999; }
    .node.faded { opacity: 0.1; }
    .link.faded { opacity: 0.05; }

    /* Details Panel Content */
    .detail-section { border-bottom: 1px solid #333; padding-bottom: 10px; }
    .detail-section:last-child { border-bottom: none; }
    .detail-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .detail-value { font-size: 0.95rem; word-break: break-all; }
    .detail-list { list-style: none; padding: 0; margin: 0; max-height: 150px; overflow-y: auto; font-size: 0.85rem; }
    .detail-list li { padding: 4px 0; border-bottom: 1px solid #2a2a2a; }
    .detail-list a { color: var(--accent-color); text-decoration: none; }
    .detail-list a:hover { text-decoration: underline; }

    .status-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; font-weight: bold; margin-top: 5px; }
    .status-ok { background: #2e7d32; color: white; }
    .status-warn { background: #f9a825; color: black; }
    .status-error { background: #c62828; color: white; }

    /* Tooltip */
    #tooltip { position: absolute; background: rgba(20,20,20,0.95); color: white; padding: 10px; border-radius: 6px; pointer-events: none; font-size: 12px; z-index: 100; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border: 1px solid #444; display: none; transform: translate(-50%, -100%); margin-top: -10px; white-space: nowrap; }

    /* Responsive Sidebar */
    @media (max-width: 768px) {
      #details-panel { position: absolute; right: 0; top: 0; bottom: 0; z-index: 20; box-shadow: -5px 0 15px rgba(0,0,0,0.5); transform: translateX(100%); transition: transform 0.3s ease; }
      #details-panel.visible { transform: translateX(0); }
      #metrics-summary { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand"><span>Crawlith</span> SiteGraph</div>

    <div id="metrics-summary">
      <div class="metric"><span class="metric-value" id="m-pages">-</span><span class="metric-label">Pages</span></div>
      <div class="metric"><span class="metric-value" id="m-depth">-</span><span class="metric-label">Max Depth</span></div>
      <div class="metric"><span class="metric-value" id="m-eff">-</span><span class="metric-label">Efficiency</span></div>
      <div class="metric"><span class="metric-value" id="m-orphan">-</span><span class="metric-label">Orphans</span></div>
    </div>

    <div id="controls">
      <div class="btn-group" style="margin-right: 15px;">
        <button id="btn-auth-pagerank" class="active" title="PageRank Authority">PageRank</button>
        <button id="btn-auth-structural" title="Structural Authority (In-Degree)">In-Degree</button>
      </div>
      <div class="btn-group">
        <button id="btn-hierarchical" class="active">Hierarchical</button>
        <button id="btn-radial">Radial</button>
      </div>
    </div>
  </header>

  <main>
    <div id="graph-container">
      <div id="search-container">
        <input type="text" id="search-input" placeholder="Search URL...">
      </div>
      <svg id="graph"></svg>
      <div id="tooltip"></div>
    </div>

    <aside id="details-panel">
      <div class="detail-section">
        <div class="detail-label">URL</div>
        <div class="detail-value" id="d-url">-</div>
        <div id="d-status"></div>
      </div>
      <div class="detail-section" style="display: flex; gap: 20px;">
        <div>
          <div class="detail-label">Depth</div>
          <div class="detail-value" id="d-depth">-</div>
        </div>
        <div>
          <div class="detail-label">Authority</div>
          <div class="detail-value" id="d-auth-container">-</div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">In-links (<span id="d-in-count">0</span>)</div>
         <!-- List could be populated here if we had the reverse index, for now just count -->
      </div>
      <div class="detail-section">
        <div class="detail-label">Out-links (<span id="d-out-count">0</span>)</div>
        <ul class="detail-list" id="d-out-list"></ul>
      </div>
    </aside>
  </main>

  <footer>
    Generated by Crawlith Crawler
  </footer>

  <!-- D3 from CDN -->
  <script src="https://d3js.org/d3.v7.min.js"></script>

  <script>
    // --- State ---
    const state = {
      nodes: [],
      links: [],
      metrics: {},
      adjacency: new Map(), // url -> { in: [], out: [] }
      simulation: null,
      width: 0,
      height: 0,
      transform: d3.zoomIdentity,
      activeNode: null,
      mode: 'hierarchical', // 'hierarchical' | 'radial'
      maxDepth: 0,
      maxInLinks: 0,
      nodeSelection: null,
      linkSelection: null,
      zoom: null
    };

    // --- DOM Elements ---
    const svg = d3.select("#graph");
    const container = svg.append("g");
    const linkGroup = container.append("g").attr("class", "links");
    const nodeGroup = container.append("g").attr("class", "nodes");
    const tooltip = d3.select("#tooltip");
    const detailsPanel = d3.select("#details-panel");

    // --- Initialization ---
    // --- Initialization ---
    async function init() {
      try {
        let graphData, metricsData;

        // 1. Try to use injected data (for file:// usage)
        // @ts-ignore
        if (window.GRAPH_DATA) graphData = window.GRAPH_DATA;
        // @ts-ignore
        if (window.METRICS_DATA) metricsData = window.METRICS_DATA;

        // 2. Fallback to fetching JSON files (for web server usage)
        if (!graphData || !metricsData) {
            try {
                const [graphRes, metricsRes] = await Promise.all([
                    fetch('graph.json'),
                    fetch('metrics.json')
                ]);
                if (graphRes.ok && metricsRes.ok) {
                    graphData = await graphRes.json();
                    metricsData = await metricsRes.json();
                }
            } catch (e) {
                console.warn("Fetch failed, possibly due to CORS or missing files.", e);
            }
        }

        if (!graphData || !metricsData) {
            throw new Error("No data available. Ensure graph.json exists or data is injected.");
        }

        state.metrics = metricsData;
        processData(graphData);
        updateMetricsUI();

        // Setup UI
        setupResize();
        setupInteractions();
        setupSearch();

        // Start Simulation
        initSimulation();

      } catch (err) {
        console.error(err);
        alert("Error loading visualization data: " + err.message);
      }
    }

    function processData(data) {
      // Create a map for fast lookup
      const nodeMap = new Map();

      data.nodes.forEach(n => {
        n.inLinks = n.inLinks || 0;
        n.outLinks = n.outLinks || 0;
        nodeMap.set(n.url, n);
      });

      // Filter valid links
      state.links = data.edges
        .map(e => ({ source: nodeMap.get(e.source), target: nodeMap.get(e.target) }))
        .filter(e => e.source && e.target);

      state.nodes = data.nodes;

      // Calculate Stats
      state.maxDepth = d3.max(state.nodes, d => d.depth) || 1;
      state.maxInLinks = d3.max(state.nodes, d => d.inLinks) || 1;

      // Calculate Authority & Enrich Nodes
      state.nodes.forEach(n => {
        // Structural Authority: log-scaled normalized 0-1 based on in-links
        n.structuralAuthority = Math.log(1 + n.inLinks) / Math.log(1 + state.maxInLinks);

        // PageRank Authority: normalized 0-1 from pageRankScore (0-100)
        if (typeof n.pageRankScore === 'number') {
          n.pageRankAuthority = n.pageRankScore / 100;
        } else {
          n.pageRankAuthority = n.structuralAuthority;
        }

        // Default authority to PageRank if available, else structural
        n.authority = n.pageRankAuthority;

        // Ensure x,y are initialized to avoid NaNs if D3 doesn't do it fast enough
        n.x = 0; n.y = 0;
      });

      // Build Adjacency Map
      state.nodes.forEach(n => state.adjacency.set(n.url, { in: [], out: [] }));
      state.links.forEach(l => {
        state.adjacency.get(l.source.url).out.push(l.target);
        state.adjacency.get(l.target.url).in.push(l.source);
      });
    }

    function updateMetricsUI() {
      document.getElementById('m-pages').textContent = state.metrics.totalPages;
      document.getElementById('m-depth').textContent = state.metrics.maxDepthFound;
      document.getElementById('m-eff').textContent = (state.metrics.crawlEfficiencyScore * 100).toFixed(1) + '%';
      document.getElementById('m-orphan').textContent = state.metrics.orphanPages.length;
    }

    // --- Simulation ---
    function initSimulation() {
      const { width, height } = getDimensions();
      state.width = width;
      state.height = height;

      // Safeguards
      const nodeCount = state.nodes.length;
      const enableCollision = nodeCount <= 1200;
      const alphaDecay = nodeCount > 1000 ? 0.05 : 0.02; // Faster decay for large graphs

      state.simulation = d3.forceSimulation(state.nodes)
        .alphaDecay(alphaDecay)
        .force("link", d3.forceLink(state.links).id(d => d.url).strength(0.5)) // Reduced strength for flexibility
        .force("charge", d3.forceManyBody().strength(nodeCount > 1000 ? -100 : -300))
        .force("center", d3.forceCenter(width / 2, height / 2));

      if (enableCollision) {
        state.simulation.force("collide", d3.forceCollide().radius(d => getNodeRadius(d) + 2).iterations(1));
      }

      // Apply Layout Mode
      applyLayoutMode(state.mode);

      // Rendering loop
      state.simulation.on("tick", ticked);

      // Render initial SVG elements
      render();
    }

    function applyLayoutMode(mode) {
      state.mode = mode;
      const { width, height } = state;
      const centerY = height / 2;
      const centerX = width / 2;

      // Remove conflicting forces
      state.simulation.force("y", null);
      state.simulation.force("radial", null);

      if (mode === 'hierarchical') {
        const depthSpacing = height / (state.maxDepth + 2);
        // Hierarchical: Nodes pushed to Y levels based on depth
        state.simulation.force("y", d3.forceY(d => {
           return (d.depth * depthSpacing) - (height/2) + 50; // Offset to start from top
        }).strength(1));
        // We rely on "center" force to keep X centered, but maybe add weak forceX?
        // Let's add weak forceX to prevent wide spread
        state.simulation.force("x", d3.forceX(0).strength(0.05));
        state.simulation.force("center", d3.forceCenter(width/2, height/2)); // Recenter

      } else if (mode === 'radial') {
        const maxRadius = Math.min(width, height) / 2 - 50;
        const ringSpacing = maxRadius / (state.maxDepth + 1);

        state.simulation.force("radial", d3.forceRadial(
          d => d.depth * ringSpacing,
          width / 2,
          height / 2
        ).strength(0.8));

        state.simulation.force("x", null); // Remove X constraint
      }

      state.simulation.alpha(1).restart();
    }

    function getNodeRadius(d) {
      // 5 + authority * 15
      return 5 + (d.authority * 15);
    }

    function getNodeColor(d) {
      // Depth-based sequential color (Blue -> Purple -> Pink)
      const t = d.depth / (state.maxDepth || 1);
      return d3.interpolateViridis(1 - t); // Invert Viridis for better contrast on dark
    }

    function render() {
      // Links
      state.linkSelection = linkGroup.selectAll("line")
        .data(state.links)
        .join("line")
        .attr("class", "link")
        .attr("stroke-width", 0.5);

      // Nodes
      state.nodeSelection = nodeGroup.selectAll("circle")
        .data(state.nodes)
        .join("circle")
        .attr("class", "node")
        .attr("r", d => getNodeRadius(d))
        .attr("fill", d => getNodeColor(d))
        .attr("stroke", d => d.status >= 400 ? "#ff4444" : null) // Red stroke for errors
        .on("mouseover", (event, d) => {
          if (state.activeNode) return;
          highlightNode(d);
          showTooltip(event, d);
        })
        .on("mouseout", () => {
          if (state.activeNode) return;
          resetHighlight();
          hideTooltip();
        })
        .on("click", (event, d) => {
          event.stopPropagation();
          selectNode(d);
        })
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

      // Zoom
      state.zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          state.transform = event.transform;
          container.attr("transform", event.transform);
        });

      svg.call(state.zoom)
         .call(state.zoom.transform, d3.zoomIdentity.translate(state.width/2, state.height/2).scale(0.8).translate(-state.width/2, -state.height/2)); // Initial zoom out
    }

    function ticked() {
      if (state.linkSelection) {
        state.linkSelection
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);
      }

      if (state.nodeSelection) {
        state.nodeSelection
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);
      }
    }

    // --- Interactions ---

    function setupInteractions() {
      // Background click to clear selection
      svg.on("click", () => {
        state.activeNode = null;
        resetHighlight();
        detailsPanel.classed("visible", false);
      });

      // Layout Toggle
      d3.select("#btn-hierarchical").on("click", function() {
        setMode('hierarchical', this);
      });
      d3.select("#btn-radial").on("click", function() {
        setMode('radial', this);
      });

      // Authority Toggle
      d3.select("#btn-auth-pagerank").on("click", function() {
        setAuthorityMode('pagerank', this);
      });
      d3.select("#btn-auth-structural").on("click", function() {
        setAuthorityMode('structural', this);
      });
    }

    function setAuthorityMode(mode, btn) {
      d3.select("#btn-auth-pagerank").classed("active", false);
      d3.select("#btn-auth-structural").classed("active", false);
      d3.select(btn).classed("active", true);

      state.nodes.forEach(n => {
        n.authority = mode === 'pagerank' ? n.pageRankAuthority : n.structuralAuthority;
      });

      // Update Visuals
      nodeGroup.selectAll("circle")
        .transition().duration(500)
        .attr("r", d => getNodeRadius(d));

      // Update collision force if enabled
      if (state.simulation.force("collide")) {
        state.simulation.force("collide", d3.forceCollide().radius(d => getNodeRadius(d) + 2).iterations(1));
        state.simulation.alpha(0.3).restart();
      }
    }

    function setMode(mode, btn) {
      d3.selectAll("#controls button").classed("active", false);
      d3.select(btn).classed("active", true);
      applyLayoutMode(mode);
    }

    function highlightNode(d) {
      const neighbors = new Set();
      const adj = state.adjacency.get(d.url);
      if (adj) {
        adj.in.forEach(n => neighbors.add(n.url));
        adj.out.forEach(n => neighbors.add(n.url));
      }
      neighbors.add(d.url);

      nodeGroup.selectAll("circle").classed("faded", n => !neighbors.has(n.url));
      nodeGroup.selectAll("circle").classed("highlight", n => n.url === d.url);

      linkGroup.selectAll("line").classed("faded", l =>
        l.source.url !== d.url && l.target.url !== d.url
      );
      linkGroup.selectAll("line").classed("highlight", l =>
        l.source.url === d.url || l.target.url === d.url
      );
    }

    function resetHighlight() {
      nodeGroup.selectAll("circle").classed("faded", false).classed("highlight", false);
      linkGroup.selectAll("line").classed("faded", false).classed("highlight", false);
    }

    function selectNode(d) {
      state.activeNode = d;
      highlightNode(d);
      showDetails(d);
    }

    function showTooltip(event, d) {
      // If we are transforming the container, we need to map coordinates correctly or just use pageX/Y
      tooltip.style("display", "block")
        .html(\`<strong>\${new URL(d.url).pathname}</strong><br>Auth: \${(d.authority * 10).toFixed(1)}\`)
        .style("left", (event.pageX) + "px")
        .style("top", (event.pageY - 10) + "px");
    }

    function hideTooltip() {
      tooltip.style("display", "none");
    }

    function showDetails(d) {
      detailsPanel.classed("visible", true);
      d3.select("#d-url").text(d.url);
      d3.select("#d-depth").text(d.depth);

      const authContainer = d3.select("#d-auth-container");
      authContainer.html("");
      const prVal = (d.pageRankAuthority * 100).toFixed(1);
      const structVal = d.structuralAuthority.toFixed(3);
      authContainer.append("div").html(\`PR: <strong>\${prVal}</strong>\`);
      authContainer.append("div").style("color", "#888").style("font-size", "0.8em").text(\`In-Degree: \${structVal}\`);

      d3.select("#d-in-count").text(d.inLinks);
      d3.select("#d-out-count").text(d.outLinks);

      // Status badge
      const statusDiv = d3.select("#d-status");
      statusDiv.html("");
      let sClass = "status-ok";
      if (d.status >= 400) sClass = "status-error";
      else if (d.status >= 300) sClass = "status-warn";
      statusDiv.append("span").attr("class", "status-badge " + sClass).text(d.status);

      // Outlinks list (limit to 20)
      const list = d3.select("#d-out-list");
      list.html("");
      const adj = state.adjacency.get(d.url);
      if (adj && adj.out.length > 0) {
        adj.out.slice(0, 50).forEach(target => {
          list.append("li").append("a")
            .attr("href", target.url)
            .attr("target", "_blank")
            .text(new URL(target.url).pathname);
        });
        if (adj.out.length > 50) {
            list.append("li").text(\`...and \${adj.out.length - 50} more\`);
        }
      } else {
        list.append("li").text("No outgoing links");
      }
    }

    // --- Search ---
    function setupSearch() {
      const input = document.getElementById('search-input');
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = input.value.trim().toLowerCase();
          if (!val) return;

          const found = state.nodes.find(n => n.url.toLowerCase().includes(val));
          if (found) {
            selectNode(found);
            // Center view on node
            const transform = d3.zoomIdentity
              .translate(state.width/2, state.height/2)
              .scale(2)
              .translate(-found.x, -found.y);

            svg.transition().duration(750).call(state.zoom.transform, transform);
          }
        }
      });
    }

    function setupResize() {
      window.addEventListener("resize", () => {
        const { width, height } = getDimensions();
        state.width = width;
        state.height = height;
        state.simulation.force("center", d3.forceCenter(width / 2, height / 2));
        if (state.mode === 'hierarchical') {
            // Re-evaluate Y force if needed, but usually center is enough
        }
        state.simulation.alpha(0.3).restart();
      });
    }

    function getDimensions() {
      const rect = document.getElementById("graph-container").getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }

    // --- Dragging ---
    function dragstarted(event, d) {
      if (!event.active) state.simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) state.simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
  </script>
</body>
</html>
`;
