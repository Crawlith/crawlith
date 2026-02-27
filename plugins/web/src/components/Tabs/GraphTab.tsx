import React, { useState, useEffect, useContext } from 'react';
import { DashboardContext } from '../../App';
import * as API from '../../api';
import { Share2, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const GraphTab = ({ url }: { url: string }) => {
    const { currentSnapshot } = useContext(DashboardContext);
    const [data, setData] = useState<API.GraphContext | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!currentSnapshot) return;
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await API.fetchPageGraphContext(url, currentSnapshot);
                setData(res);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [url, currentSnapshot]);

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
                         <div className="group">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Centrality Score</span>
                                <HelpCircle size={12} className="text-slate-400" title="Relative importance in the graph" />
                            </div>
                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                                {data.centrality.toFixed(2)}
                            </div>
                        </div>

                        <div className="group">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Equity Ratio (In/Out)</span>
                                <HelpCircle size={12} className="text-slate-400" title="Compares incoming internal equity to outgoing distribution. High imbalance may indicate poor structural support." />
                            </div>
                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                                {data.equityRatio.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visualization Column */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
                <div className="absolute top-4 left-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Immediate Neighbors (Depth 1)</div>

                {/* SVG Visualization */}
                <svg width="100%" height="350" viewBox="-200 -150 400 300" className="max-w-xl">
                    {/* Central Node */}
                    <circle cx="0" cy="0" r="20" fill="#3b82f6" className="animate-pulse" />

                    {/* Incoming Nodes (Left) */}
                    {data.incoming.map((node, i) => {
                        const angle = (Math.PI / (data.incoming.length + 1)) * (i + 1) - Math.PI / 2;
                        const x = -150;
                        const y = (i - (data.incoming.length - 1) / 2) * 40;
                        return (
                            <g key={`in-${i}`}>
                                <line x1={x} y1={y} x2="-25" y2="0" stroke="#94a3b8" strokeWidth="1" opacity="0.5" markerEnd="url(#arrowhead)" />
                                <circle cx={x} cy={y} r="6" fill="#10b981" />
                            </g>
                        );
                    })}

                    {/* Outgoing Nodes (Right) */}
                    {data.outgoing.map((node, i) => {
                        const x = 150;
                        const y = (i - (data.outgoing.length - 1) / 2) * 40;
                         return (
                            <g key={`out-${i}`}>
                                <line x1="25" y1="0" x2={x} y2={y} stroke="#94a3b8" strokeWidth="1" opacity="0.5" markerEnd="url(#arrowhead)" />
                                <circle cx={x} cy={y} r="6" fill="#f59e0b" />
                            </g>
                        );
                    })}

                     <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" opacity="0.5" />
                        </marker>
                    </defs>
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
