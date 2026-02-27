import { useState, useEffect } from 'react';
import * as API from '../../api';
import { ArrowRight, Server, Activity } from 'lucide-react';

export const TechnicalTab = ({ url, snapshotId }: { url: string; snapshotId: number }) => {
    const [data, setData] = useState<API.TechnicalSignals | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!snapshotId) return;
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await API.fetchPageTechnical(url, snapshotId);
                setData(res);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [url, snapshotId]);

    if (!data && loading) return <div className="p-8 text-center animate-pulse text-slate-400">Loading Technical Signals...</div>;
    if (!data) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Redirect Chain */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <Activity size={18} className="text-blue-500" />
                    Redirect Chain
                </h2>

                {data.redirectChain && data.redirectChain.length > 0 ? (
                    <div className="space-y-4">
                        {data.redirectChain.map((hop, index) => (
                            <div key={index} className="relative pl-6 pb-6 border-l-2 border-slate-200 dark:border-slate-700 last:border-0 last:pb-0">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white dark:border-slate-900"></div>
                                <div className="text-xs text-slate-500 font-bold uppercase mb-1">Hop {index + 1}</div>
                                <div className="font-mono text-sm text-slate-700 dark:text-slate-300 break-all bg-slate-50 dark:bg-slate-800 p-2 rounded">
                                    {hop}
                                </div>
                                {index < (data.redirectChain?.length || 0) - 1 && (
                                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                                        <ArrowRight size={12} /> 301 Moved Permanently
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-slate-500 text-sm">No redirects detected. This URL resolves directly (200 OK).</div>
                )}
            </div>

            {/* Server & Response */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <Server size={18} className="text-purple-500" />
                    Response & Headers
                </h2>

                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                        <span className="text-sm text-slate-500">Content Type</span>
                        <span className="font-mono text-sm font-medium">{data.contentType}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                        <span className="text-sm text-slate-500">Page Size</span>
                        <span className="font-mono text-sm font-medium">{(data.contentSize / 1024).toFixed(2)} KB</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                        <span className="text-sm text-slate-500">Response Time</span>
                        <span className="font-mono text-sm font-medium">{data.responseTime ? `${data.responseTime}ms` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3">
                        <span className="text-sm text-slate-500">Server Status</span>
                        <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${data.status >= 400 || data.status === 0 ? 'bg-red-100 text-red-700' : data.status >= 300 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {data.status === 0 ? 'Network Error' : `${data.status} ${data.status < 300 ? 'OK' : data.status < 400 ? 'Redirect' : 'Error'}`}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
