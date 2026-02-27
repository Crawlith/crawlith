import { useState, useEffect } from 'react';
import * as API from '../../api';
import { Share2, HelpCircle } from 'lucide-react';

export const GraphTab = ({ url, snapshotId }: { url: string; snapshotId: number }) => {
    const [data, setData] = useState<API.GraphContext | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!snapshotId) return;
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await API.fetchPageGraphContext(url, snapshotId);
                setData(res);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [url, snapshotId]);

    if (!data && loading) return <div className="p-8 text-center animate-pulse text-slate-400">Loading Graph Context...</div>;
    if (!data) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Metrics Column */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <Share2 size={18} className="text-indigo-500" />
                        Node Centrality
                    </h2>

                    <div className="space-y-6">
                        <div className="group relative">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Centrality Score</span>
                                <div className="cursor-help text-slate-400 group relative">
                                    <HelpCircle size={12} />
                                    <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 font-normal">
                                        Eigenvector centrality of the node within the internal sitewide link graph.
                                    </div>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                                {data.centrality.toFixed(2)}
                            </div>
                        </div>

                        <div className="group relative">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Equity Ratio (In/Out)</span>
                                <div className="cursor-help text-slate-400 group relative">
                                    <HelpCircle size={12} />
                                    <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 font-normal">
                                        Ratio of inbound links to outbound links. Helps identify "sink" nodes vs "hub" nodes.
                                    </div>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                                {data.equityRatio.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visualization Column */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
                <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Immediate Neighbors (Depth 1)</span>
                    <div className="group/help relative cursor-help">
                        <HelpCircle size={12} className="text-slate-300" />
                        <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/help:opacity-100 transition-opacity z-50 leading-relaxed font-normal">
                            This visualization shows internal pages linking directly to this page (Green) and pages this page links to (Amber). Node size indicates logical importance.
                        </div>
                    </div>
                </div>

                {/* SVG Visualization */}
                <svg width="100%" height="450" viewBox="-200 -225 400 450" className="max-w-xl overflow-visible">
                    {/* Central Node */}
                    <g>
                        <circle cx="0" cy="0" r="20" fill="#3b82f6" className="animate-pulse" />
                        <text x="0" y="35" textAnchor="middle" className="text-[10px] font-bold fill-slate-500 dark:fill-slate-400 pointer-events-none">Current Node</text>
                    </g>

                    {/* Incoming Nodes (Left) */}
                    {data.incoming.map((node, i) => {
                        const x = -150;
                        const y = (i - (data.incoming.length - 1) / 2) * 45;
                        const shortUrl = node.normalized_url.split('/').pop() || '/';
                        return (
                            <g key={`in-${i}`} className="group/node cursor-pointer">
                                <line x1={x} y1={y} x2="-25" y2="0" stroke="#10b981" strokeWidth="1" strokeDasharray="4" opacity="0.4" />
                                <circle cx={x} cy={y} r="8" fill="#10b981" className="transition-transform group-hover/node:scale-150" />
                                <text x={x - 12} y={y + 4} textAnchor="end" className="text-[9px] fill-slate-400 font-mono opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none">
                                    {shortUrl}
                                </text>
                                <title>{node.normalized_url} (PR: {node.pagerank_score.toFixed(1)})</title>
                            </g>
                        );
                    })}

                    {/* Outgoing Nodes (Right) */}
                    {data.outgoing.map((node, i) => {
                        const x = 150;
                        const y = (i - (data.outgoing.length - 1) / 2) * 45;
                        const shortUrl = node.normalized_url.split('/').pop() || '/';
                        return (
                            <g key={`out-${i}`} className="group/node cursor-pointer">
                                <line x1="25" y1="0" x2={x} y2={y} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4" opacity="0.4" />
                                <circle cx={x} cy={y} r="8" fill="#f59e0b" className="transition-transform group-hover/node:scale-150" />
                                <text x={x + 12} y={y + 4} textAnchor="start" className="text-[9px] fill-slate-400 font-mono opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none">
                                    {shortUrl}
                                </text>
                                <title>{node.normalized_url} (PR: {node.pagerank_score.toFixed(1)})</title>
                            </g>
                        );
                    })}
                </svg>

                <div className="flex gap-6 mt-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Incoming Sources</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Current Page</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Outgoing Targets</div>
                </div>
            </div>
        </div>
    );
};
