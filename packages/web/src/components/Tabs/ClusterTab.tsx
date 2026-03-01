import { useState, useEffect } from 'react';
import * as API from '../../api';
import { Layers } from 'lucide-react';

export const ClusterTab = ({ url, snapshotId }: { url: string; snapshotId: number }) => {
    const [data, setData] = useState<API.ClusterInfo | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!snapshotId) return;
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await API.fetchPageCluster(url, snapshotId);
                setData(res);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [url, snapshotId]);

    if (!data && loading) return <div className="p-8 text-center animate-pulse text-slate-400">Loading Cluster Info...</div>;
    if (!data) return null;

    if (!data.hasCluster) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-full inline-block mb-4">
                    <Layers className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">No significant similarity detected.</h3>
                <p className="text-slate-500 max-w-md mx-auto">This page appears unique within the current crawl snapshot and does not belong to any duplicate content clusters.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Layers size={18} className="text-amber-500" />
                    Duplicate Cluster Found
                </h2>
                <div className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30 rounded-full text-xs font-bold uppercase">
                    Risk: High
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <div className="mb-6">
                        <div className="text-sm font-medium text-slate-500 mb-2">Cluster Details</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Cluster Size</div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{data.clusterSize} Pages</div>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Similarity</div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{data.similarity}</div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="text-sm font-medium text-slate-500 mb-2">Representative URL</div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-mono text-xs break-all">
                            {data.representative}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                            The canonical or highest-authority version of this content.
                        </div>
                    </div>
                </div>

                <div>
                    <div className="text-sm font-medium text-slate-500 mb-2">Similar URLs in Cluster</div>
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                            {data.similarUrls?.map((simUrl, idx) => (
                                <li key={idx} className="p-3 text-xs font-mono text-slate-600 dark:text-slate-400 break-all hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                    {simUrl}
                                </li>
                            ))}
                            {data.similarUrls && data.similarUrls.length >= 10 && (
                                <li className="p-3 text-xs text-center text-slate-500 italic">
                                    + {data.clusterSize ? data.clusterSize - 10 : 'more'} others...
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
