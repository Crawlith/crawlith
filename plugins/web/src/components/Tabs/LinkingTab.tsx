import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import * as API from '../../api';

export const LinkingTab = ({ url, snapshotId }: { url: string; snapshotId: number }) => {
    const [subTab, setSubTab] = useState<'inlinks' | 'outlinks'>('inlinks');

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[800px]">
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setSubTab('inlinks')}
                    className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${subTab === 'inlinks' ? 'bg-slate-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                    Inbound Links (Internal)
                </button>
                <button
                    onClick={() => setSubTab('outlinks')}
                    className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${subTab === 'outlinks' ? 'bg-slate-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                    Outbound Links
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {subTab === 'inlinks' ? <InlinksTable url={url} snapshotId={snapshotId} /> : <OutlinksTable url={url} snapshotId={snapshotId} />}
            </div>
        </div>
    );
};

const InlinksTable = ({ url, snapshotId }: { url: string; snapshotId: number }) => {
    const [data, setData] = useState<API.InlinksResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (!snapshotId) return;
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await API.fetchPageInlinks(url, page, snapshotId);
                setData(res);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [url, page, snapshotId]);

    if (!data && loading) return <div className="p-8 text-center animate-pulse text-slate-400">Loading Inlinks...</div>;
    if (!data) return <div className="p-8 text-center text-slate-400">No data available</div>;

    return (
        <div className="flex flex-col h-full">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400 w-1/2">Source URL</th>
                            <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Source PageRank</th>
                            <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Link Type</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {data.results.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 truncate max-w-xs" title={row.sourceUrl}>
                                    <Link to={`/page?url=${encodeURIComponent(row.sourceUrl)}`} className="hover:underline flex items-center gap-2">
                                        <ArrowDownLeft size={12} className="text-slate-400" />
                                        {row.sourceUrl}
                                    </Link>
                                </td>
                                <td className="px-6 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                    {Math.round(row.sourcePageRank)}
                                </td>
                                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                                        {row.linkType}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination total={data.total} pageSize={data.pageSize} page={page} setPage={setPage} loading={loading} />
        </div>
    );
};

const OutlinksTable = ({ url, snapshotId }: { url: string; snapshotId: number }) => {
    const [data, setData] = useState<API.OutlinksResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (!snapshotId) return;
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await API.fetchPageOutlinks(url, page, snapshotId);
                setData(res);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [url, page, snapshotId]);

    if (!data && loading) return <div className="p-8 text-center animate-pulse text-slate-400">Loading Outlinks...</div>;
    if (!data) return <div className="p-8 text-center text-slate-400">No data available</div>;

    return (
        <div className="flex flex-col h-full">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400 w-1/2">Target URL</th>
                            <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
                            <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Type</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {data.results.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 truncate max-w-xs" title={row.targetUrl}>
                                    <Link to={`/page?url=${encodeURIComponent(row.targetUrl)}`} className="hover:underline flex items-center gap-2">
                                        <ArrowUpRight size={12} className="text-slate-400" />
                                        {row.targetUrl}
                                    </Link>
                                </td>
                                <td className="px-6 py-3">
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${row.status >= 200 && row.status < 300 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        row.status >= 300 && row.status < 400 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                                        {row.type}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination total={data.total} pageSize={data.pageSize} page={page} setPage={setPage} loading={loading} />
        </div>
    );
};

const Pagination = ({ total, pageSize, page, setPage, loading }: any) => {
    const totalPages = Math.ceil(total / pageSize);
    return (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
            <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                className="px-3 py-1 text-xs font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors text-slate-700 dark:text-slate-300"
            >
                Previous
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages} ({total} links)
            </span>
            <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 text-xs font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors text-slate-700 dark:text-slate-300"
            >
                Next
            </button>
        </div>
    );
};
