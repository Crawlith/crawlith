import { useEffect, useState } from 'react';
import * as API from '../../api';
import { Activity, Clock, Zap, AlertTriangle } from 'lucide-react';

export const PerformanceTab = ({ url, snapshotId }: { url: string, snapshotId: number }) => {
    const [pluginsData, setPluginsData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlugins = async () => {
            setLoading(true);
            try {
                const data = await API.fetchPagePlugins(url, snapshotId);
                setPluginsData(data);
                setError(null);
            } catch (e: any) {
                setError(e.message || 'Failed to load plugin data.');
            } finally {
                setLoading(false);
            }
        };

        fetchPlugins();
    }, [url, snapshotId]);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading plugin data...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    }

    const pagespeedData = pluginsData['pagespeed'];

    if (!pagespeedData) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center hidden md:block">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">No Performance Data</h3>
                <p className="text-slate-500">Run a live crawl with the --pagespeed flag to fetch Google PageSpeed Insights data.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="text-yellow-500" />
                PageSpeed Insights (Mobile)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    title="Performance Score"
                    value={pagespeedData.performance_score}
                    max={100}
                    suffix="/100"
                    color={getScoreColor(pagespeedData.performance_score)}
                />
                <MetricCard
                    title="LCP (Largest Contentful Paint)"
                    value={pagespeedData.lcp}
                    suffix="s"
                    color={pagespeedData.lcp <= 2.5 ? 'green' : pagespeedData.lcp <= 4 ? 'amber' : 'red'}
                />
                <MetricCard
                    title="CLS (Cumulative Layout Shift)"
                    value={pagespeedData.cls}
                    color={pagespeedData.cls <= 0.1 ? 'green' : pagespeedData.cls <= 0.25 ? 'amber' : 'red'}
                />
                <MetricCard
                    title="TBT (Total Blocking Time)"
                    value={pagespeedData.tbt}
                    suffix="ms"
                    color={pagespeedData.tbt <= 200 ? 'green' : pagespeedData.tbt <= 600 ? 'amber' : 'red'}
                />
            </div>
        </div>
    );
};

const getScoreColor = (score: number) => {
    if (score >= 90) return 'green';
    if (score >= 50) return 'amber';
    return 'red';
};

const MetricCard = ({ title, value, suffix = '', max, color }: any) => {
    const colorClasses = {
        green: 'text-green-600 dark:text-green-400',
        amber: 'text-amber-600 dark:text-amber-400',
        red: 'text-red-600 dark:text-red-400',
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
                {title}
            </div>
            <div className={`text-3xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
                {value !== null && value !== undefined ? value : 'N/A'}{suffix}
            </div>
        </div>
    );
};
