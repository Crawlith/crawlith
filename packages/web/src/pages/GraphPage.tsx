import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardContext } from '../App';
import * as API from '../api';

type ZoomLevel = 1 | 2 | 3;

interface RenderNode extends API.SnapshotGraphNode {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

/**
 * Cluster-first structure graph explorer with radial depth layout,
 * progressive zoom levels and interaction-only edge rendering.
 */
export function GraphPage() {
  const { currentSnapshot } = useContext(DashboardContext);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const dragOriginRef = useRef({ x: 0, y: 0 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.9 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState<{ nodes: API.SnapshotGraphNode[]; edges: API.SnapshotGraphEdge[] }>({ nodes: [], edges: [] });

  const [minPageRank, setMinPageRank] = useState(0);
  const [minInlinks, setMinInlinks] = useState(0);
  const [minOutlinks, setMinOutlinks] = useState(0);
  const [search, setSearch] = useState('');
  const [maxNodes, setMaxNodes] = useState(10000);

  const zoomLevel: ZoomLevel = useMemo(() => {
    if (camera.zoom < 0.95) return 1;
    if (camera.zoom < 1.9) return 2;
    return 3;
  }, [camera.zoom]);

  const [graphByLevel, setGraphByLevel] = useState<Partial<Record<ZoomLevel, API.SnapshotGraphResponse>>>({});

  const fetchLevel = useCallback(async (level: ZoomLevel) => {
    if (!currentSnapshot) return;
    const graph = await API.fetchSnapshotGraph({
      snapshotId: currentSnapshot,
      level,
      includeEdges: false,
      maxNodes,
      minInlinks,
      minOutlinks,
      minPageRank,
      search: search || undefined,
    });

    setGraphByLevel((prev) => ({ ...prev, [level]: graph }));
  }, [currentSnapshot, maxNodes, minInlinks, minOutlinks, minPageRank, search]);

  useEffect(() => {
    if (!currentSnapshot) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedNodeId(null);
    setNeighborhood({ nodes: [], edges: [] });

    const timeout = setTimeout(async () => {
      try {
        await Promise.all(([1, 2, 3] as ZoomLevel[]).map((level) => fetchLevel(level)));
      } catch {
        if (!cancelled) setError('Failed to load hierarchical graph model.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [currentSnapshot, fetchLevel]);

  const activeGraph = graphByLevel[zoomLevel] || null;

  const renderNodes = useMemo(() => {
    const graph = activeGraph;
    if (!graph?.nodes?.length) return [] as RenderNode[];

    const maxDepth = Math.max(...graph.nodes.map((node) => node.depth), 1);
    const groups = new Map<number, API.SnapshotGraphNode[]>();
    for (const node of graph.nodes) {
      const d = Math.max(0, Number.isFinite(node.depth) ? node.depth : 0);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(node);
    }

    const orderedDepths = Array.from(groups.keys()).sort((a, b) => a - b);
    const placed: RenderNode[] = [];

    for (const depth of orderedDepths) {
      const nodes = groups.get(depth)!;
      const ringRadius = 45 + (depth / Math.max(maxDepth, 1)) * 560;
      const step = (Math.PI * 2) / Math.max(nodes.length, 1);

      nodes.forEach((node, idx) => {
        const angle = idx * step;
        const jitter = ((idx % 11) - 5) * 2;
        const x = Math.cos(angle) * (ringRadius + jitter);
        const y = Math.sin(angle) * (ringRadius + jitter);

        const baseRadius = zoomLevel === 1
          ? 3.2 + Math.min(25, Math.sqrt(Math.max(node.size, 1)))
          : zoomLevel === 2
            ? 2.2 + Math.min(18, Math.sqrt(Math.max(node.size, 1)))
            : 1.8 + Math.min(7, Math.max(node.pageRankScore, 0) / 12);

        const active = !selectedNodeId || node.id === selectedNodeId || neighborhood.nodes.some((n) => n.id === node.id);

        placed.push({
          ...node,
          x,
          y,
          radius: baseRadius,
          opacity: active ? 0.95 : 0.14,
        });
      });
    }

    return placed;
  }, [activeGraph, neighborhood.nodes, selectedNodeId, zoomLevel]);

  const heatOverlay = useMemo(() => {
    const graph = activeGraph;
    if (!graph?.nodes?.length) return { degree: [], authority: [], orphan: [] };

    const slices = 24;
    const degree = new Array(slices).fill(0);
    const authority = new Array(slices).fill(0);
    const orphan = new Array(slices).fill(0);

    const maxDepth = Math.max(...graph.nodes.map((node) => Math.max(1, node.depth)), 1);

    for (const node of graph.nodes) {
      const idx = Math.min(slices - 1, Math.floor((Math.max(node.depth, 0) / maxDepth) * slices));
      degree[idx] += node.inlinks + node.outlinks;
      authority[idx] += node.pageRankScore;
      if ((node.role || '').toLowerCase() === 'orphan') orphan[idx] += 1;
    }

    const norm = (arr: number[]) => {
      const max = Math.max(...arr, 1);
      return arr.map((v) => v / max);
    };

    return {
      degree: norm(degree),
      authority: norm(authority),
      orphan: norm(orphan),
    };
  }, [activeGraph]);

  const colorForNode = (node: RenderNode): string => {
    if (node.nodeType === 'section') return '#38bdf8';
    if (node.clusterType === 'duplicate') return '#f97316';
    if (node.clusterType === 'content_group') return '#22c55e';
    if (node.clusterType === 'template') return '#a855f7';
    return node.health < 0.5 ? '#ef4444' : '#60a5fa';
  };

  const draw = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2 + camera.x;
    const cy = height / 2 + camera.y;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(camera.zoom, camera.zoom);

    const drawHeatRing = (values: number[], radius: number, color: string) => {
      const slices = values.length;
      for (let i = 0; i < slices; i += 1) {
        const v = values[i];
        if (v <= 0.02) continue;
        const start = (Math.PI * 2 * i) / slices;
        const end = (Math.PI * 2 * (i + 1)) / slices;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.08 + v * 0.35;
        ctx.lineWidth = 18;
        ctx.arc(0, 0, radius, start, end);
        ctx.stroke();
      }
    };

    drawHeatRing(heatOverlay.degree, 240, '#38bdf8');
    drawHeatRing(heatOverlay.authority, 270, '#a78bfa');
    drawHeatRing(heatOverlay.orphan, 300, '#fb7185');

    // Non-negotiable: hide edges under zoom threshold and render only on selection.
    const shouldRenderEdges = camera.zoom >= 1.15 && selectedNodeId && neighborhood.edges.length > 0;
    if (shouldRenderEdges) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 0.8 / camera.zoom;
      const nodeMap = new Map(renderNodes.map((node) => [node.id, node]));
      for (const edge of neighborhood.edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
      }
      ctx.stroke();
    }

    for (const node of renderNodes) {
      ctx.beginPath();
      ctx.fillStyle = colorForNode(node);
      ctx.globalAlpha = node.id === hoveredNodeId ? 1 : node.opacity;
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [camera, heatOverlay.authority, heatOverlay.degree, heatOverlay.orphan, hoveredNodeId, neighborhood.edges, renderNodes, selectedNodeId]);

  useEffect(() => {
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [draw]);

  const worldPoint = useCallback((clientX: number, clientY: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: 0, y: 0 };
    const rect = wrapper.getBoundingClientRect();
    return {
      x: (clientX - rect.left - (rect.width / 2 + camera.x)) / camera.zoom,
      y: (clientY - rect.top - (rect.height / 2 + camera.y)) / camera.zoom,
    };
  }, [camera.x, camera.y, camera.zoom]);

  const hitNode = useCallback((x: number, y: number) => {
    for (let i = renderNodes.length - 1; i >= 0; i -= 1) {
      const n = renderNodes[i];
      const dx = n.x - x;
      const dy = n.y - y;
      const hitR = Math.max(6 / camera.zoom, n.radius + 2 / camera.zoom);
      if ((dx * dx) + (dy * dy) <= hitR * hitR) return n;
    }
    return null;
  }, [camera.zoom, renderNodes]);

  const hoveredNode = useMemo(() => renderNodes.find((n) => n.id === hoveredNodeId) || null, [hoveredNodeId, renderNodes]);

  const onNodeSelect = useCallback(async (node: RenderNode) => {
    setSelectedNodeId(node.id);

    if (node.nodeType !== 'url' || !currentSnapshot) {
      setNeighborhood({ nodes: [], edges: [] });
      return;
    }

    try {
      const ng = await API.fetchGraphNeighbors(node.id, currentSnapshot);
      setNeighborhood(ng);
    } catch {
      setNeighborhood({ nodes: [], edges: [] });
    }
  }, [currentSnapshot]);

  return (
    <div className="max-w-[1920px] mx-auto p-4 md:p-8 space-y-6 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-6 space-y-4">
        <h1 className="text-xl font-semibold">Structure Graph · Cluster-first Explorer</h1>
        <p className="text-sm text-slate-500">Level 1 sections → Level 2 URL clusters → Level 3 individual URLs. Nodes only by default; edges appear on node selection.</p>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <label className="text-xs text-slate-500 flex flex-col gap-1">Search URL
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" placeholder="/blog" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Min PageRank
            <input type="number" min={0} value={minPageRank} onChange={(e) => setMinPageRank(Number(e.target.value) || 0)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Min Inlinks
            <input type="number" min={0} value={minInlinks} onChange={(e) => setMinInlinks(Number(e.target.value) || 0)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Min Outlinks
            <input type="number" min={0} value={minOutlinks} onChange={(e) => setMinOutlinks(Number(e.target.value) || 0)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Max Nodes
            <input type="number" min={1000} max={10000} step={500} value={maxNodes} onChange={(e) => setMaxNodes(Math.max(1000, Math.min(10000, Number(e.target.value) || 10000)))} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
          </label>
          <div className="text-xs text-slate-500 flex flex-col justify-end">
            <div>Zoom LOD: <span className="text-slate-200">L{zoomLevel}</span></div>
            <div>Nodes: <span className="text-slate-200">{activeGraph?.nodes.length ?? 0}</span></div>
          </div>
        </div>

        {error && <div className="text-sm text-rose-500">{error}</div>}

        <div
          ref={wrapperRef}
          className="relative h-[72vh] min-h-[520px] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950"
          onWheel={(e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.92 : 1.08;
            setCamera((prev) => ({ ...prev, zoom: Math.max(0.45, Math.min(4, prev.zoom * factor)) }));
          }}
          onPointerDown={(e) => {
            draggingRef.current = true;
            movedRef.current = false;
            dragOriginRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) {
              const dx = e.clientX - dragOriginRef.current.x;
              const dy = e.clientY - dragOriginRef.current.y;
              dragOriginRef.current = { x: e.clientX, y: e.clientY };
              if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;
              setCamera((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
              return;
            }

            const point = worldPoint(e.clientX, e.clientY);
            const hit = hitNode(point.x, point.y);
            setHoveredNodeId(hit?.id || null);
          }}
          onPointerUp={(e) => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            if (movedRef.current) return;

            const point = worldPoint(e.clientX, e.clientY);
            const hit = hitNode(point.x, point.y);
            if (hit) {
              onNodeSelect(hit);
            } else {
              setSelectedNodeId(null);
              setNeighborhood({ nodes: [], edges: [] });
            }
          }}
          onPointerLeave={() => {
            draggingRef.current = false;
            setHoveredNodeId(null);
          }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />

          {loading && <div className="absolute top-3 right-3 rounded bg-slate-900/90 px-3 py-2 text-xs text-slate-300 border border-slate-700">Stabilizing radial model…</div>}

          {hoveredNode && (
            <div className="absolute bottom-3 left-3 rounded bg-slate-900/90 px-3 py-2 text-xs text-slate-200 border border-slate-700 max-w-[520px]">
              <div className="font-medium truncate">{hoveredNode.label}</div>
              <div>Type: {hoveredNode.nodeType} · Cluster: {hoveredNode.clusterType} · Size: {hoveredNode.size}</div>
              <div>Depth: {hoveredNode.depth} · PR: {hoveredNode.pageRankScore.toFixed(2)} · In: {hoveredNode.inlinks} · Out: {hoveredNode.outlinks}</div>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 grid md:grid-cols-3 gap-2">
          <div><span className="inline-block w-3 h-3 rounded-full bg-sky-400 mr-2" />In-degree density ring</div>
          <div><span className="inline-block w-3 h-3 rounded-full bg-violet-400 mr-2" />Authority density ring</div>
          <div><span className="inline-block w-3 h-3 rounded-full bg-rose-400 mr-2" />Orphan concentration ring</div>
        </div>
      </div>
    </div>
  );
}
