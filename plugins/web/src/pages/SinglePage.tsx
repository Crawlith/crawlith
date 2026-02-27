import { useEffect, useState, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardContext } from '../App';
import * as API from '../api';
import { HelpCircle, AlertTriangle, CheckCircle, AlertOctagon, Copy, CornerDownRight, Activity, Layers, Clock } from 'lucide-react';
import { ContentTab } from '../components/Tabs/ContentTab';
import { LinkingTab } from '../components/Tabs/LinkingTab';
import { ClusterTab } from '../components/Tabs/ClusterTab';
import { TechnicalTab } from '../components/Tabs/TechnicalTab';
import { GraphTab } from '../components/Tabs/GraphTab';

export const SinglePage = () => {
    const [searchParams] = useSearchParams();
    const url = searchParams.get('url');
    const { currentSnapshot, snapshots, setSnapshot } = useContext(DashboardContext);

    const [details, setDetails] = useState<API.PageDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCrawling, setIsCrawling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('content');

    const targetSnap = snapshots?.[0]?.id || currentSnapshot;

    useEffect(() => {
        if (!url || !targetSnap) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await API.fetchPageDetails(url, targetSnap);
                setDetails(data);
                setError(null);
            } catch (e: any) {
                setError(e.message || 'Failed to load page details.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        setActiveTab('content');
    }, [url, targetSnap]);

    const handleLiveCrawl = async () => {
        if (!url) return;
        setIsCrawling(true);
        try {
            const result = await API.crawlPage(url);
            if (result.success) {
                setSnapshot(result.snapshotId);
            }
        } catch (e: any) {
            alert(`Live crawl failed: ${e.message}`);
        } finally {
            setIsCrawling(false);
        }
    };

    if (!url) {
        return (
            <div className="p-8 md:p-12 text-center">
                <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-2xl inline-block mb-4">
                    <HelpCircle className="text-slate-400" size={48} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No URL Selected</h2>
                <p className="text-slate-500 max-w-sm mx-auto">Please select a page from the dashboard to view its detailed intelligence reports.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 space-y-8 animate-pulse">
                <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                    <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                    <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="p-8 flex items-center justify-center h-[60vh]">
                <div className="text-center max-w-md">
                    <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full inline-block mb-4">
                        <AlertOctagon className="text-red-500" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                        {error ? 'Data Fetch Error' : 'Page Not Found'}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-6 font-mono text-sm">
                        {error || `The URL "${url}" was not found in snapshot #${currentSnapshot}.`}
                    </p>
                    <div className="text-sm text-slate-500">
                        Suggestion: Try selecting a different snapshot or verifying the URL in the discovery list.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 md:p-8">
                <div className="max-w-[1920px] mx-auto">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                                <StatusBadge status={details.identity.status} />
                                <span className="text-sm font-mono text-slate-500 dark:text-slate-400 truncate max-w-xl" title={details.identity.canonical || ''}>
                                    {details.identity.canonical ? `Canonical: ${details.identity.canonical}` : 'Self-canonical'}
                                </span>
                            </div>
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 break-all font-mono leading-tight">
                                    {details.identity.url}
                                    <button
                                        onClick={() => navigator.clipboard.writeText(details.identity.url)}
                                        className="ml-3 inline-flex items-center p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Copy URL"
                                    >
                                        <Copy size={18} />
                                    </button>
                                </h1>
                                <button
                                    onClick={handleLiveCrawl}
                                    disabled={isCrawling}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${isCrawling
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                                        : 'text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 dark:bg-blue-900/10 dark:hover:bg-blue-600 border-blue-200 dark:border-blue-900/30'
                                        }`}
                                >
                                    <Activity size={14} className={isCrawling ? 'animate-spin' : ''} />
                                    {isCrawling ? 'Crawling...' : 'Fetch Again'}
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 mb-6 text-xs font-bold uppercase tracking-wider text-slate-400">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                                    <Layers size={12} />
                                    Snapshot #{details.snapshotId || currentSnapshot}
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                                    <Clock size={12} />
                                    Crawled: {details.identity.crawlDate ? new Date(details.identity.crawlDate).toLocaleString() : 'N/A'}
                                </div>
                            </div>

                            {details.identity.crawlError && (
                                <div className="mb-6 flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg text-red-700 dark:text-red-400">
                                    <AlertOctagon size={18} />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold uppercase tracking-wider opacity-70">Crawl Intelligence Error</span>
                                        <span className="text-sm font-semibold">{details.identity.crawlError}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-4 md:gap-8">
                                <MetricDisplay
                                    label="PageRank"
                                    value={(details.metrics.pageRank || 0).toFixed(1)}
                                    tooltip="Measures relative internal importance of this page within the site graph. Higher values indicate stronger internal equity flow."
                                />
                                <MetricDisplay
                                    label="Authority"
                                    value={(details.metrics.authority || 0).toFixed(1)}
                                    tooltip="Represents the page's ability to pass value to other pages (Hub score relationship)."
                                />
                                <MetricDisplay
                                    label="Hub Score"
                                    value={(details.metrics.hub || 0).toFixed(1)}
                                    tooltip="Indicates how well this page links to high-authority pages."
                                />
                                <MetricDisplay
                                    label="Crawl Depth"
                                    value={details.metrics.depth ?? 'N/A'}
                                    tooltip="Distance from the start URL (usually homepage). Lower is better for crawl budget."
                                />
                                <MetricDisplay
                                    label="Inlinks"
                                    value={details.metrics.inlinks ?? 0}
                                    tooltip="Number of unique internal pages linking to this URL."
                                />
                                <MetricDisplay
                                    label="Outlinks"
                                    value={details.metrics.outlinks ?? 0}
                                    tooltip="Number of unique internal pages this URL links to."
                                />
                            </div>
                        </div>

                        {/* Page Health Summary Panel */}
                        <div className="w-full md:w-80 flex-shrink-0">
                            <HealthPanel health={details.health} />
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 scrollbar-hide">
                        {['content', 'linking', 'cluster', 'technical', 'graph'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === tab
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
                                {tab === 'linking' && ' (Internal)'}
                                {tab === 'cluster' && ' & Duplication'}
                                {tab === 'graph' && ' Context'}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Tab Content */}
            <main className="max-w-[1920px] mx-auto px-6 md:px-8 pb-20">
                {activeTab === 'content' && <ContentTab details={details} />}
                {activeTab === 'linking' && <LinkingTab url={url} snapshotId={details.snapshotId || currentSnapshot || 0} />}
                {activeTab === 'cluster' && <ClusterTab url={url} snapshotId={details.snapshotId || currentSnapshot || 0} />}
                {activeTab === 'technical' && <TechnicalTab url={url} snapshotId={details.snapshotId || currentSnapshot || 0} />}
                {activeTab === 'graph' && <GraphTab url={url} snapshotId={details.snapshotId || currentSnapshot || 0} />}
            </main>
        </div>
    );
};

const MetricDisplay = ({ label, value, tooltip }: { label: string, value: string | number, tooltip: string }) => (
    <div className="group relative">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 cursor-help">
            {label}
            <HelpCircle size={12} className="opacity-40 group-hover:opacity-100 transition-opacity text-slate-400" />
            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                {tooltip}
                <div className="absolute bottom-[-2px] left-4 w-1.5 h-1.5 bg-slate-900 rotate-45"></div>
            </div>
        </div>
        <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {value}
        </div>
    </div>
);

const StatusBadge = ({ status }: { status: number }) => {
    let color = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    if (status >= 200 && status < 300) color = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30';
    if (status >= 300 && status < 400) color = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30';
    if (status >= 400 && status < 500) color = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30';
    if (status >= 500) color = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30';
    if (status === 0) color = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30';

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${color}`}>
            HTTP {status === 0 ? 'ERR' : status}
        </span>
    );
};

const HealthPanel = ({ health }: { health: API.PageDetails['health'] }) => {
    const isHealthy = health.status === 'Healthy';
    const isCritical = health.status === 'Critical';

    return (
        <div className={`rounded-xl border p-5 ${isCritical
            ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30'
            : isHealthy
                ? 'bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30'
                : 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30'
            }`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Page Health</h3>
                <span className={`px-2 py-1 rounded text-xs font-bold ${isCritical ? 'bg-red-200 text-red-800' : isHealthy ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>
                    {health.status}
                </span>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <AlertTriangle size={14} className={health.criticalCount > 0 ? 'text-red-500' : 'text-slate-300'} />
                        Critical Issues
                    </span>
                    <span className="font-mono font-bold">{health.criticalCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <AlertOctagon size={14} className={health.warningCount > 0 ? 'text-amber-500' : 'text-slate-300'} />
                        Warnings
                    </span>
                    <span className="font-mono font-bold">{health.warningCount}</span>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200/50 dark:border-slate-700/50 space-y-2">
                    {health.isThinContent && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 font-medium">
                            <CornerDownRight size={12} /> Thin Content Detected
                        </div>
                    )}
                    {health.isDuplicate && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 font-medium">
                            <CornerDownRight size={12} /> Duplicate Content
                        </div>
                    )}
                    {health.indexabilityRisk && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 font-medium">
                            <CornerDownRight size={12} /> Indexability Risk
                        </div>
                    )}
                    {!health.isThinContent && !health.isDuplicate && !health.indexabilityRisk && health.status === 'Healthy' && (
                        <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-2 font-medium">
                            <CheckCircle size={12} /> No major issues
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
