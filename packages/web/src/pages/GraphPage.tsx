import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardContext } from '../App';
import * as API from '../api';

interface RenderNode extends API.SnapshotGraphNode {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface RenderEdge extends API.SnapshotGraphEdge {
  sourceNode: RenderNode;
  targetNode: RenderNode;
}

/**
 * Optimized canvas-based structure graph explorer for large snapshots.
 */
export function GraphPage() {
  const { currentSnapshot } = useContext(DashboardContext);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragLastRef = useRef({ x: 0, y: 0 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<RenderNode | null>(null);

  const [minPageRank, setMinPageRank] = useState(0);
  const [minInlinks, setMinInlinks] = useState(0);
  const [minOutlinks, setMinOutlinks] = useState(0);
  const [search, setSearch] = useState('');
  const [maxNodes, setMaxNodes] = useState(10000);

  const [rawGraph, setRawGraph] = useState<API.SnapshotGraphResponse | null>(null);

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    if (!currentSnapshot) return;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const graph = await API.fetchSnapshotGraph({
          snapshotId: currentSnapshot,
          maxNodes,
          maxEdges: maxNodes * 4,
          minPageRank,
          minInlinks,
          minOutlinks,
          search: search || undefined,
        });

        if (!controller.signal.aborted) {
          setRawGraph(graph);
          setCamera({ x: 0, y: 0, zoom: 1 });
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError('Failed to load structure graph.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [currentSnapshot, maxNodes, minInlinks, minOutlinks, minPageRank, search]);

  const renderData = useMemo(() => {
    if (!rawGraph || rawGraph.nodes.length === 0) {
      return { nodes: [] as RenderNode[], edges: [] as RenderEdge[] };
    }

    const maxDepth = Math.max(...rawGraph.nodes.map((n) => n.depth), 1);
    const ringStep = 110;
    const depthGroups = new Map<number, API.SnapshotGraphNode[]>();

    for (const node of rawGraph.nodes) {
      const depth = Number.isFinite(node.depth) ? node.depth : 0;
      if (!depthGroups.has(depth)) depthGroups.set(depth, []);
      depthGroups.get(depth)!.push(node);
    }

    const computedNodes: RenderNode[] = [];
    const colorPalette = ['#38bdf8', '#60a5fa', '#8b5cf6', '#22c55e', '#f59e0b', '#f43f5e'];

    const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);
    for (const depth of sortedDepths) {
      const group = depthGroups.get(depth)!;
      const radiusBase = 30 + depth * ringStep;
      const angleStep = (Math.PI * 2) / Math.max(group.length, 1);

      group.forEach((node, idx) => {
        const angle = idx * angleStep;
        const jitter = (idx % 7) * 3;
        const x = Math.cos(angle) * (radiusBase + jitter);
        const y = Math.sin(angle) * (radiusBase + jitter);
        computedNodes.push({
          ...node,
          x,
          y,
          radius: 1.5 + Math.min(5, node.pageRankScore / 20),
          color: colorPalette[Math.min(colorPalette.length - 1, Math.floor((depth / maxDepth) * (colorPalette.length - 1)))],
        });
      });
    }

    const nodeMap = new Map(computedNodes.map((n) => [n.id, n]));

    const computedEdges: RenderEdge[] = rawGraph.edges
      .map((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) return null;
        return {
          ...edge,
          sourceNode,
          targetNode,
        };
      })
      .filter(Boolean) as RenderEdge[];

    return { nodes: computedNodes, edges: computedEdges };
  }, [rawGraph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

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

    const centerX = width / 2 + camera.x;
    const centerY = height / 2 + camera.y;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(camera.zoom, camera.zoom);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 0.7 / camera.zoom;
    ctx.beginPath();
    for (const edge of renderData.edges) {
      ctx.moveTo(edge.sourceNode.x, edge.sourceNode.y);
      ctx.lineTo(edge.targetNode.x, edge.targetNode.y);
    }
    ctx.stroke();

    for (const node of renderData.nodes) {
      ctx.beginPath();
      ctx.fillStyle = node.color;
      ctx.globalAlpha = hoveredNode && hoveredNode.id !== node.id ? 0.4 : 0.95;
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [camera, hoveredNode, renderData.edges, renderData.nodes]);

  useEffect(() => {
    const raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  const toWorldPoint = useCallback((clientX: number, clientY: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: 0, y: 0 };
    const rect = wrapper.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - (rect.width / 2 + camera.x)) / camera.zoom;
    const worldY = (localY - (rect.height / 2 + camera.y)) / camera.zoom;
    return { x: worldX, y: worldY };
  }, [camera.x, camera.y, camera.zoom]);

  const hitTest = useCallback((x: number, y: number) => {
    for (let i = renderData.nodes.length - 1; i >= 0; i -= 1) {
      const node = renderData.nodes[i];
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= Math.max(node.radius + 2 / camera.zoom, 5 / camera.zoom) ** 2) {
        return node;
      }
    }
    return null;
  }, [camera.zoom, renderData.nodes]);

  return (
    <div className="max-w-[1920px] mx-auto p-4 md:p-8 space-y-6 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-6 space-y-4">
        <h1 className="text-xl font-semibold">Snapshot Structure Graph</h1>
        <p className="text-sm text-slate-500">Pan, zoom, and filter internal link topology. Optimized canvas rendering for up to 10k nodes.</p>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <label className="text-xs text-slate-500 flex flex-col gap-1">Search URL
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" placeholder="/blog" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Min PageRank
            <input type="number" value={minPageRank} min={0} onChange={(e) => setMinPageRank(Number(e.target.value) || 0)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Min Inlinks
            <input type="number" value={minInlinks} min={0} onChange={(e) => setMinInlinks(Number(e.target.value) || 0)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Min Outlinks
            <input type="number" value={minOutlinks} min={0} onChange={(e) => setMinOutlinks(Number(e.target.value) || 0)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Max Nodes
            <input type="number" value={maxNodes} min={500} max={10000} step={500} onChange={(e) => setMaxNodes(Math.min(10000, Math.max(500, Number(e.target.value) || 10000)))} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
          </label>
          <div className="text-xs text-slate-500 flex flex-col justify-end">
            <div>Nodes: <span className="text-slate-200">{rawGraph?.nodes.length ?? 0}</span></div>
            <div>Edges: <span className="text-slate-200">{rawGraph?.edges.length ?? 0}</span></div>
          </div>
        </div>

        {error && <div className="text-sm text-rose-500">{error}</div>}

        <div
          ref={wrapperRef}
          className="relative h-[72vh] min-h-[520px] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950"
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.92 : 1.08;
            setCamera((prev) => ({ ...prev, zoom: Math.max(0.15, Math.min(4.5, prev.zoom * delta)) }));
          }}
          onPointerDown={(e) => {
            isDraggingRef.current = true;
            dragLastRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (isDraggingRef.current) {
              const dx = e.clientX - dragLastRef.current.x;
              const dy = e.clientY - dragLastRef.current.y;
              dragLastRef.current = { x: e.clientX, y: e.clientY };
              setCamera((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
              return;
            }

            const world = toWorldPoint(e.clientX, e.clientY);
            setHoveredNode(hitTest(world.x, world.y));
          }}
          onPointerUp={() => {
            isDraggingRef.current = false;
          }}
          onPointerLeave={() => {
            isDraggingRef.current = false;
            setHoveredNode(null);
          }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />

          {loading && (
            <div className="absolute top-3 right-3 rounded-md bg-slate-900/90 text-xs px-3 py-2 text-slate-300 border border-slate-700">
              Loading graph...
            </div>
          )}

          {hoveredNode && (
            <div className="absolute bottom-3 left-3 rounded-md bg-slate-900/90 text-xs px-3 py-2 text-slate-200 border border-slate-700 max-w-[420px]">
              <div className="font-medium truncate">{hoveredNode.url}</div>
              <div>Depth: {hoveredNode.depth} · PR: {hoveredNode.pageRankScore.toFixed(2)} · In: {hoveredNode.inlinks} · Out: {hoveredNode.outlinks}</div>
            </div>
          )}
        </div>

        {rawGraph?.meta.truncated && (
          <div className="text-xs text-amber-400">Edge list truncated for rendering performance. Tighten filters for focused analysis.</div>
        )}
      </div>
    </div>
  );
}
