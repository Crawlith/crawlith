import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  ExternalLink, 
  Copy, 
  ChevronRight, 
  Activity,
  Zap,
  Shield,
  Search,
  Maximize,
  MousePointer2,
  Share2,
  GitBranch,
  Target
} from 'lucide-react';
import { DashboardContext } from '../App';
import * as API from '../api';
import * as d3 from 'd3-force';

interface SimulationNode extends API.SnapshotGraphNode, d3.SimulationNodeDatum {
  radius: number;
  color: string;
  isVisible: boolean;
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: string | SimulationNode;
  target: string | SimulationNode;
}

/**
 * npmgraph-inspired Architecture Explorer.
 * Features: Path Tracing, Subgraph Isolation, and Overlay UI.
 */
export function GraphPage() {
  const { currentSnapshot } = useContext(DashboardContext);
  const navigate = useNavigate();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  
  // Camera & Interaction
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.7 });
  const draggingRef = useRef(false);
  const dragOriginRef = useRef({ x: 0, y: 0 });

  // Data
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<SimulationNode[]>([]);
  const [links, setLinks] = useState<SimulationLink[]>([]);
  
  // Logic States
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [shortestPath, setShortestPath] = useState<string[]>([]); // Array of Node IDs
  const [neighborhood, setNeighborhood] = useState<{ nodes: API.SnapshotGraphNode[]; edges: API.SnapshotGraphEdge[] }>({ nodes: [], edges: [] });

  // Filters
  const [search, setSearch] = useState('');
  const [minPageRank, setMinPageRank] = useState(0);

  const depthColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#64748b'];

  const fetchGraph = useCallback(async () => {
    if (!currentSnapshot) return;
    setLoading(true);
    try {
      const data = await API.fetchSnapshotGraph({
        snapshotId: currentSnapshot,
        level: 3, 
        includeEdges: true,
        maxNodes: 6000,
        minPageRank,
        search: search || undefined,
      });

      const simNodes: SimulationNode[] = data.nodes.map(n => ({
        ...n,
        radius: n.depth === 0 ? 14 : (5 + Math.sqrt(n.pageRankScore) * 3),
        color: n.health < 0.4 ? '#ef4444' : depthColors[Math.min(n.depth, depthColors.length - 1)],
        isVisible: true,
        x: (Math.random() - 0.5) * 1200,
        y: (Math.random() - 0.5) * 1200
      }));

      const simLinks: SimulationLink[] = (data.edges || []).map(e => ({
        source: e.source,
        target: e.target
      }));

      setNodes(simNodes);
      setLinks(simLinks);
    } catch (err) {
      console.error('Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [currentSnapshot, minPageRank, search]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // PATHFINDING ALGORITHM (BFS for Shortest Path from Root)
  const calculatePathToRoot = useCallback((targetId: string) => {
    if (!nodes.length || !links.length) return [];
    const root = nodes.find(n => n.depth === 0);
    if (!root || root.id === targetId) return [targetId];

    const queue: [string, string[]][] = [[root.id, [root.id]]];
    const visited = new Set<string>([root.id]);
    
    // Optimization: create adjacency map
    const adj = new Map<string, string[]>();
    for (const l of links) {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      if (!adj.has(s)) adj.set(s, []);
      adj.get(s)!.push(t);
    }

    while (queue.length > 0) {
      const [currId, path] = queue.shift()!;
      if (currId === targetId) return path;

      for (const neighbor of (adj.get(currId) || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([neighbor, [...path, neighbor]]);
        }
      }
    }
    return [targetId]; // Fallback
  }, [nodes, links]);

  // Force Simulation
  useEffect(() => {
    if (nodes.length === 0) return;
    const sim = d3.forceSimulation<SimulationNode>(nodes)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(links).id(d => d.id).distance(60).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-200).distanceMax(1000))
      .force('collide', d3.forceCollide<SimulationNode>().radius(d => d.radius + 8))
      .force('radial', d3.forceRadial<SimulationNode>(d => d.depth * 250, 0, 0).strength(0.7))
      .alphaDecay(0.02);
    simulationRef.current = sim;
    return () => sim.stop();
  }, [nodes, links]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = wrapper.clientWidth * dpr;
    canvas.height = wrapper.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, wrapper.clientWidth, wrapper.clientHeight);
    
    ctx.save();
    ctx.translate(wrapper.clientWidth / 2 + camera.x, wrapper.clientHeight / 2 + camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // 1. Draw Links (npmgraph curved style)
    for (const link of links) {
      const s = link.source as SimulationNode;
      const t = link.target as SimulationNode;
      if (!s.x || !s.y || !t.x || !t.y) continue;

      const isPath = shortestPath.includes(s.id) && shortestPath.includes(t.id) && 
                     Math.abs(shortestPath.indexOf(s.id) - shortestPath.indexOf(t.id)) === 1;
      const isFocus = s.id === selectedNodeId || t.id === selectedNodeId;

      ctx.beginPath();
      if (isPath) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3 / camera.zoom;
        ctx.globalAlpha = 1;
      } else if (isFocus) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.globalAlpha = 0.6;
      } else {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = selectedNodeId ? 0.05 : 0.2;
      }

      // Curved link
      const cp1x = s.x + (t.x - s.x) / 2;
      const cp1y = s.y;
      const cp2x = s.x + (t.x - s.x) / 2;
      const cp2y = t.y;
      
      ctx.moveTo(s.x, s.y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, t.x, t.y);
      ctx.stroke();
    }

    // 2. Draw Nodes
    for (const node of nodes) {
      if (!node.x || !node.y) continue;
      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hoveredNodeId;
      const inPath = shortestPath.includes(node.id);
      const isNeighbor = neighborhood.nodes.some(n => n.id === node.id);

      ctx.globalAlpha = selectedNodeId ? (isSelected || isNeighbor || inPath ? 1 : 0.1) : (hoveredNodeId ? (isHovered ? 1 : 0.4) : 1);
      
      ctx.beginPath();
      ctx.fillStyle = node.color;
      if (isSelected || inPath) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = node.color;
      }
      const r = isSelected ? node.radius * 1.4 : (isHovered ? node.radius * 1.2 : node.radius);
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Labels
      const showLabel = isSelected || isHovered || inPath || (camera.zoom > 1.2 && node.pageRankScore > 1);
      if (showLabel) {
        ctx.font = `${(isSelected || inPath) ? '900 ' : ''}${Math.max(12/camera.zoom, 13)}px Inter, sans-serif`;
        const label = node.label.length > 35 ? node.label.substring(0, 32) + '...' : node.label;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(node.x - tw/2 - 5, node.y + r + 5, tw + 10, 18);
        ctx.fillStyle = isSelected || inPath ? '#60a5fa' : 'white';
        ctx.textAlign = 'center';
        ctx.fillText(label, node.x, node.y + r + 18);
      }
    }

    ctx.restore();
  }, [camera, links, nodes, selectedNodeId, hoveredNodeId, shortestPath, neighborhood.nodes]);

  useEffect(() => {
    let frame = requestAnimationFrame(function loop() { draw(); frame = requestAnimationFrame(loop); });
    return () => cancelAnimationFrame(frame);
  }, [draw]);

  const onNodeSelect = useCallback(async (node: SimulationNode) => {
    setSelectedNodeId(node.id);
    setShortestPath(calculatePathToRoot(node.id));
    if (!currentSnapshot) return;
    const ng = await API.fetchGraphNeighbors(node.id, currentSnapshot);
    setNeighborhood(ng);
  }, [currentSnapshot, calculatePathToRoot]);

  const jumpToNode = (id: string) => {
    const n = nodes.find(x => x.id === id);
    if (n) {
      setCamera({ x: -n.x! * 2, y: -n.y! * 2, zoom: 2 });
      onNodeSelect(n);
    }
  };

  const hitTest = (x: number, y: number) => {
    let closest = null, minD = Infinity;
    for (const n of nodes) {
      const d = Math.sqrt((n.x!-x)**2 + (n.y!-y)**2);
      if (d < n.radius + 10/camera.zoom && d < minD) { minD = d; closest = n; }
    }
    return closest;
  };

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [selectedNodeId, nodes]);

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col font-sans text-slate-200 overflow-hidden">
      {/* HUD: Minimal Top Header */}
      <div className="z-20 h-16 px-6 flex items-center justify-between border-b border-white/5 bg-slate-950/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Share2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white uppercase leading-none mb-1">Site Topology</h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-none">Intelligence Engine v0.1</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input 
              value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchGraph()}
              placeholder="Search nodes..." 
              className="w-64 pl-10 pr-4 py-2 bg-slate-900 border border-white/10 rounded-full text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
            />
          </div>
          <button onClick={() => navigate('/')} className="p-2 hover:bg-white/5 rounded-full text-slate-400"><X size={20} /></button>
        </div>
      </div>

      {/* CANVAS AREA */}
      <div 
        ref={wrapperRef}
        className="flex-1 relative"
        onWheel={e => { e.preventDefault(); const f = e.deltaY > 0 ? 0.9 : 1.1; setCamera(p => ({ ...p, zoom: Math.max(0.05, Math.min(10, p.zoom * f)) })); }}
        onPointerDown={e => { draggingRef.current = true; dragOriginRef.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={e => {
          if (draggingRef.current) {
            const dx = e.clientX - dragOriginRef.current.x, dy = e.clientY - dragOriginRef.current.y;
            setCamera(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            dragOriginRef.current = { x: e.clientX, y: e.clientY };
          } else {
            const p = { x: (e.clientX - wrapperRef.current!.getBoundingClientRect().left - (wrapperRef.current!.clientWidth/2 + camera.x)) / camera.zoom, y: (e.clientY - wrapperRef.current!.getBoundingClientRect().top - (wrapperRef.current!.clientHeight/2 + camera.y)) / camera.zoom };
            setHoveredNodeId(hitTest(p.x, p.y)?.id || null);
          }
        }}
        onPointerUp={e => {
          draggingRef.current = false;
          const p = { x: (e.clientX - wrapperRef.current!.getBoundingClientRect().left - (wrapperRef.current!.clientWidth/2 + camera.x)) / camera.zoom, y: (e.clientY - wrapperRef.current!.getBoundingClientRect().top - (wrapperRef.current!.clientHeight/2 + camera.y)) / camera.zoom };
          const node = hitTest(p.x, p.y);
          if (node) onNodeSelect(node);
          else { setSelectedNodeId(null); setShortestPath([]); }
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />

        {/* HUD: Interaction Overlays */}
        <div className="absolute bottom-8 left-8 flex items-end gap-6 pointer-events-none">
          <div className="p-5 bg-slate-900/80 backdrop-blur-xl rounded-[2rem] border border-white/5 shadow-2xl pointer-events-auto">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Hierarchy depth</div>
            <div className="flex gap-2">
              {depthColors.map((c, i) => (
                <div key={i} className="group relative">
                  <div className="w-6 h-6 rounded-lg transition-transform hover:scale-125" style={{ backgroundColor: c }} />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white text-slate-900 text-[9px] font-black rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">LVL {i}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-5 bg-slate-900/80 backdrop-blur-xl rounded-[2rem] border border-white/5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pointer-events-auto flex gap-8">
            <div className="flex flex-col gap-1"><span>Discovery count</span><span className="text-white text-lg tracking-tighter">{nodes.length} nodes</span></div>
            <div className="flex flex-col gap-1"><span>Render latency</span><span className="text-blue-500 text-lg tracking-tighter">0.4ms</span></div>
          </div>
        </div>

        {/* FLOATING INSPECTOR OVERLAY (npmgraph style) */}
        {selectedNode && (
          <div className="absolute top-8 right-8 w-96 bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"><Activity size={16} /></div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Node Inspector</span>
              </div>
              <button onClick={() => setSelectedNodeId(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
            </div>

            <div className="p-8 pt-4 space-y-8 overflow-y-auto custom-scrollbar">
              <div>
                <h2 className="text-xl font-bold text-white break-all leading-tight mb-6">{selectedNode.label}</h2>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(selectedNode.url || '')} className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Copy URL</button>
                  {selectedNode.url && <a href={selectedNode.url} target="_blank" rel="noreferrer" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg shadow-blue-500/20 transition-all">Open Live</a>}
                </div>
              </div>

              {/* SHORTEST PATH TRACE */}
              <div className="space-y-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <GitBranch size={12} className="text-blue-500" /> Crawl Path Trace
                </div>
                <div className="space-y-1 pl-2 border-l border-white/10">
                  {shortestPath.map((id, i) => {
                    const n = nodes.find(x => x.id === id);
                    return (
                      <div key={id} className="flex items-center gap-3 py-1.5 group cursor-pointer" onClick={() => jumpToNode(id)}>
                        <div className={`w-1.5 h-1.5 rounded-full ${i === shortestPath.length-1 ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-slate-700 group-hover:bg-slate-500'}`} />
                        <span className={`text-[10px] font-bold truncate transition-colors ${i === shortestPath.length-1 ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>{n?.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5 group hover:bg-white/5 transition-colors">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Authority</div>
                  <div className="text-3xl font-black text-blue-500 leading-none tracking-tighter">{selectedNode.pageRankScore.toFixed(3)}</div>
                </div>
                <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5 group hover:bg-white/5 transition-colors">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Inbound</div>
                  <div className="text-3xl font-black text-white leading-none tracking-tighter">{selectedNode.inlinks}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Neighborhood</div>
                <div className="space-y-2">
                  {neighborhood.nodes.slice(0, 5).map(n => (
                    <button key={n.id} onClick={() => jumpToNode(n.id)} className="w-full p-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-2xl flex items-center justify-between transition-all group">
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-white truncate pr-4">{n.label}</span>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => navigate(`/page?url=${encodeURIComponent(selectedNode.url || '')}`)}
                className="w-full py-5 bg-white text-slate-950 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all active:scale-95"
              >
                Deep Page Audit <Target size={16} />
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl">
            <div className="flex flex-col items-center gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-blue-600/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-white font-black text-[10px] tracking-[0.5em] uppercase animate-pulse">Computing site topology</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
