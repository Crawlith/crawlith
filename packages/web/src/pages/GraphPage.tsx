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
  Target,
  Command,
  ArrowRight
} from 'lucide-react';
import { DashboardContext } from '../App';
import * as API from '../api';
import * as d3 from 'd3-force';

interface SimulationNode extends API.SnapshotGraphNode, d3.SimulationNodeDatum {
  radius: number;
  color: string;
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: string | SimulationNode;
  target: string | SimulationNode;
}

/**
 * npmgraph-inspired Site Topology Explorer.
 * Strictly minimalist aesthetic, glassmorphism, and path tracing.
 */
export function GraphPage() {
  const { currentSnapshot } = useContext(DashboardContext);
  const navigate = useNavigate();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  
  // HUD States
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.8 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Data & Selection
  const [nodes, setNodes] = useState<SimulationNode[]>([]);
  const [links, setLinks] = useState<SimulationLink[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [shortestPath, setShortestPath] = useState<string[]>([]);
  const [neighborhood, setNeighborhood] = useState<{ nodes: API.SnapshotGraphNode[]; edges: API.SnapshotGraphEdge[] }>({ nodes: [], edges: [] });

  const draggingRef = useRef(false);
  const dragOriginRef = useRef({ x: 0, y: 0 });

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
        minPageRank: 0,
        search: search || undefined,
      });

      const simNodes: SimulationNode[] = data.nodes.map(n => ({
        ...n,
        radius: n.depth === 0 ? 12 : (4 + Math.sqrt(n.pageRankScore) * 2),
        color: n.health < 0.4 ? '#ef4444' : depthColors[Math.min(n.depth, depthColors.length - 1)],
        x: (Math.random() - 0.5) * 1000,
        y: (Math.random() - 0.5) * 1000
      }));

      setNodes(simNodes);
      setLinks((data.edges || []).map(e => ({ source: e.source, target: e.target })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentSnapshot, search]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  const calculatePathToRoot = useCallback((targetId: string) => {
    if (!nodes.length || !links.length) return [];
    const root = nodes.find(n => n.depth === 0);
    if (!root || root.id === targetId) return [targetId];

    const adj = new Map<string, string[]>();
    for (const l of links) {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      if (!adj.has(s)) adj.set(s, []);
      adj.get(s)!.push(t);
    }

    const queue: [string, string[]][] = [[root.id, [root.id]]];
    const visited = new Set<string>([root.id]);
    
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
    return [targetId];
  }, [nodes, links]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const sim = d3.forceSimulation<SimulationNode>(nodes)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(links).id(d => d.id).distance(50).strength(0.2))
      .force('charge', d3.forceManyBody().strength(-150).distanceMax(800))
      .force('collide', d3.forceCollide<SimulationNode>().radius(d => d.radius + 6))
      .force('radial', d3.forceRadial<SimulationNode>(d => d.depth * 200, 0, 0).strength(0.6))
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

    // Curved Links
    for (const link of links) {
      const s = link.source as SimulationNode;
      const t = link.target as SimulationNode;
      if (!s.x || !s.y || !t.x || !t.y) continue;

      const isPath = shortestPath.includes(s.id) && shortestPath.includes(t.id);
      const isSelected = s.id === selectedNodeId || t.id === selectedNodeId;

      ctx.beginPath();
      if (isPath) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2.5 / camera.zoom;
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 0.4;
        ctx.globalAlpha = selectedNodeId ? (isSelected ? 0.4 : 0.02) : 0.2;
      }

      const cp1x = s.x + (t.x - s.x) / 2;
      ctx.moveTo(s.x, s.y);
      ctx.bezierCurveTo(cp1x, s.y, cp1x, t.y, t.x, t.y);
      ctx.stroke();
    }

    // Nodes
    for (const node of nodes) {
      if (!node.x || !node.y) continue;
      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hoveredNodeId;
      const inPath = shortestPath.includes(node.id);
      const isNeighbor = neighborhood.nodes.some(n => n.id === node.id);

      ctx.globalAlpha = selectedNodeId ? (isSelected || isNeighbor || inPath ? 1 : 0.05) : (hoveredNodeId ? (isHovered ? 1 : 0.4) : 1);
      
      ctx.beginPath();
      ctx.fillStyle = node.color;
      if (isSelected || inPath) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = node.color;
      }
      const r = isSelected ? node.radius * 1.3 : (isHovered ? node.radius * 1.15 : node.radius);
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // npmgraph Label Style
      const showLabel = isSelected || isHovered || inPath || (camera.zoom > 1.2 && node.pageRankScore > 1.5);
      if (showLabel) {
        ctx.font = `600 ${Math.max(11/camera.zoom, 12)}px 'Inter', sans-serif`;
        const label = node.label.length > 30 ? node.label.substring(0, 27) + '...' : node.label;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
        ctx.fillRect(node.x - tw/2 - 4, node.y + r + 6, tw + 8, 16);
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
      setCamera({ x: -n.x! * 1.8, y: -n.y! * 1.8, zoom: 1.8 });
      onNodeSelect(n);
    }
  };

  const hitTest = (x: number, y: number) => {
    let closest = null, minD = Infinity;
    for (const n of nodes) {
      const d = Math.sqrt((n.x!-x)**2 + (n.y!-y)**2);
      if (d < n.radius + 15/camera.zoom && d < minD) { minD = d; closest = n; }
    }
    return closest;
  };

  return (
    <div className="fixed inset-0 bg-[#050505] overflow-hidden select-none font-sans text-slate-400">
      {/* HUD: SEARCH PILL */}
      <div className="absolute top-8 left-8 z-20 flex items-center gap-4">
        <div className="relative group overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={14} />
          <input 
            value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchGraph()}
            placeholder="Find page..." 
            className="relative w-64 pl-10 pr-4 py-3 bg-transparent text-[11px] font-bold focus:outline-none transition-all placeholder:text-slate-600"
          />
        </div>
        
        <div className="p-3 bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Live Architecture</span>
        </div>
      </div>

      {/* HUD: RIGHT CLOSE */}
      <div className="absolute top-8 right-8 z-20 flex items-center gap-2">
        <button onClick={() => navigate('/')} className="w-12 h-12 flex items-center justify-center bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
      </div>

      {/* MAIN CANVAS */}
      <div 
        ref={wrapperRef}
        className="w-full h-full relative cursor-crosshair"
        onWheel={e => { e.preventDefault(); const f = e.deltaY > 0 ? 0.92 : 1.08; setCamera(p => ({ ...p, zoom: Math.max(0.02, Math.min(12, p.zoom * f)) })); }}
        onPointerDown={e => { draggingRef.current = true; dragOriginRef.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={e => {
          if (draggingRef.current) {
            const dx = e.clientX - dragOriginRef.current.x, dy = e.clientY - dragOriginRef.current.y;
            setCamera(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            dragOriginRef.current = { x: e.clientX, y: e.clientY };
          } else {
            const rect = wrapperRef.current!.getBoundingClientRect();
            const p = { x: (e.clientX - rect.left - (rect.width/2 + camera.x)) / camera.zoom, y: (e.clientY - rect.top - (rect.height/2 + camera.y)) / camera.zoom };
            setHoveredNodeId(hitTest(p.x, p.y)?.id || null);
          }
        }}
        onPointerUp={e => {
          draggingRef.current = false;
          const rect = wrapperRef.current!.getBoundingClientRect();
          const p = { x: (e.clientX - rect.left - (rect.width/2 + camera.x)) / camera.zoom, y: (e.clientY - rect.top - (rect.height/2 + camera.y)) / camera.zoom };
          const node = hitTest(p.x, p.y);
          if (node) onNodeSelect(node);
          else { setSelectedNodeId(null); setShortestPath([]); }
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* HUD: BOTTOM LEGEND */}
        <div className="absolute bottom-8 left-8 flex items-end gap-4 pointer-events-none">
          <div className="p-4 bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 flex gap-2 pointer-events-auto">
            {depthColors.map((c, i) => (
              <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="px-5 py-4 bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 pointer-events-auto flex gap-6 font-mono text-[10px] font-black uppercase">
            <div className="flex flex-col"><span>Total discovery</span><span className="text-white text-xs mt-1">{nodes.length} nodes</span></div>
            <div className="flex flex-col"><span>Process latency</span><span className="text-blue-500 text-xs mt-1">0.2ms</span></div>
          </div>
        </div>

        {/* HUD: ZOOM HUD */}
        <div className="absolute bottom-8 right-8 flex flex-col gap-2">
          <button onClick={() => setCamera(p => ({ ...p, zoom: p.zoom * 1.5 }))} className="w-12 h-12 bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"><Maximize size={18} /></button>
          <button onClick={() => setCamera(p => ({ ...p, zoom: p.zoom / 1.5 }))} className="w-12 h-12 bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"><MousePointer2 size={18} /></button>
        </div>

        {/* INSPECTOR PANEL (Pure npmgraph style) */}
        {selectedNodeId && (
          <div className="absolute top-8 bottom-8 right-8 w-[420px] bg-slate-900/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl animate-in slide-in-from-right-8 duration-500 flex flex-col overflow-hidden">
            <div className="p-10 pb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                <Target size={10} className="text-blue-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Inspector</span>
              </div>
              <button onClick={() => setSelectedNodeId(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 pt-4 space-y-12 custom-scrollbar">
              <div className="space-y-6">
                <h2 className="text-3xl font-black text-white leading-tight tracking-tight break-all">{nodes.find(n => n.id === selectedNodeId)?.label}</h2>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(nodes.find(n => n.id === selectedNodeId)?.url || '')} className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Copy URI</button>
                  <a href={nodes.find(n => n.id === selectedNodeId)?.url} target="_blank" rel="noreferrer" className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg shadow-blue-500/20 transition-all">Visit Live</a>
                </div>
              </div>

              {/* DISCOVERY PATH TRACE */}
              <div className="space-y-6">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><GitBranch size={14} className="text-blue-500" /> Site Architecture Path</div>
                <div className="space-y-2 ml-1 pl-4 border-l border-white/10">
                  {shortestPath.map((id, i) => {
                    const n = nodes.find(x => x.id === id);
                    return (
                      <div key={id} onClick={() => jumpToNode(id)} className="group flex items-center gap-4 py-2 cursor-pointer transition-all hover:translate-x-1">
                        <div className={`w-2 h-2 rounded-full ${i === shortestPath.length-1 ? 'bg-blue-500 shadow-[0_0_12px_#3b82f6]' : 'bg-slate-700'}`} />
                        <div className="flex flex-col">
                          <span className={`text-[11px] font-black tracking-tight ${i === shortestPath.length-1 ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>{n?.label}</span>
                          <span className="text-[8px] font-bold text-slate-600 uppercase">Level {n?.depth}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 font-mono">
                <div className="p-8 bg-white/[0.03] rounded-3xl border border-white/5 flex flex-col gap-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Authority</span>
                  <span className="text-4xl font-black text-blue-500 leading-none tracking-tighter">{nodes.find(n => n.id === selectedNodeId)?.pageRankScore.toFixed(3)}</span>
                </div>
                <div className="p-8 bg-white/[0.03] rounded-3xl border border-white/5 flex flex-col gap-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inlinks</span>
                  <span className="text-4xl font-black text-white leading-none tracking-tighter">{nodes.find(n => n.id === selectedNodeId)?.inlinks}</span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center justify-between">
                  <span>Linked Neighborhood</span>
                  <span className="text-blue-500">{neighborhood.nodes.length} total</span>
                </div>
                <div className="space-y-3">
                  {neighborhood.nodes.slice(0, 6).map(n => (
                    <button key={n.id} onClick={() => jumpToNode(n.id)} className="w-full p-5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-2xl flex items-center justify-between transition-all group overflow-hidden">
                      <div className="flex flex-col text-left truncate pr-4">
                        <span className="text-[11px] font-bold text-slate-400 group-hover:text-white truncate">{n.label}</span>
                        <span className="text-[8px] font-black text-slate-600 uppercase mt-1">PR {n.pageRankScore.toFixed(2)}</span>
                      </div>
                      <ArrowRight size={16} className="text-slate-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => navigate(`/page?url=${encodeURIComponent(nodes.find(n => n.id === selectedNodeId)?.url || '')}`)}
                className="w-full py-6 bg-white text-black rounded-[2.5rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                Launch Deep Audit <Activity size={18} />
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]/90 backdrop-blur-2xl">
            <div className="flex flex-col items-center gap-8">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-2 border-blue-500/10 rounded-full" />
                <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <Activity size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" />
              </div>
              <span className="text-white font-black text-[11px] tracking-[0.6em] uppercase animate-pulse">Computing Site Graph</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
