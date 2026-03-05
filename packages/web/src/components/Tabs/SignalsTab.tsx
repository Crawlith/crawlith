import { useEffect, useState } from 'react';
import * as API from '../../api';
import { Share2, Globe, Braces, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export const SignalsTab = ({ url, snapshotId }: { url: string, snapshotId: number }) => {
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

    const signalsData = pluginsData['signals'];

    if (!signalsData) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center hidden md:block">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">No Signals Data</h3>
                <p className="text-slate-500">Run a live crawl with the --signals flag to fetch structured signals and metadata.</p>
            </div>
        );
    }

    const parsedSignals = signalsData.signals_json;

    return (
        <div className="space-y-6 mt-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Share2 className="text-blue-500" />
                Signals & Metadata
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    title="Score"
                    value={signalsData.score}
                    max={100}
                    suffix="/100"
                    color={getScoreColor(signalsData.score)}
                />
                <StatusCard
                    title="Open Graph"
                    status={parsedSignals.hasOg ? 'PASS' : 'FAIL'}
                />
                <StatusCard
                    title="Language Tags"
                    status={parsedSignals.hasLang ? 'PASS' : 'FAIL'}
                />
                <StatusCard
                    title="Structured Data (JSON-LD)"
                    status={parsedSignals.hasJsonld ? (parsedSignals.brokenJsonld ? 'WARNING' : 'PASS') : 'FAIL'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                        <Share2 className="text-blue-500" size={20} />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Social Tags (OG & Twitter)</h3>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 space-y-4">
                        <DataRow label="OG Title" value={parsedSignals.ogTitle} />
                        <DataRow label="OG Description" value={parsedSignals.ogDescription} />
                        <DataRow label="OG Image" value={parsedSignals.ogImage} />
                        <DataRow label="OG URL" value={parsedSignals.ogUrl} />
                        <DataRow label="Twitter Title" value={parsedSignals.twitterTitle} />
                        <DataRow label="Twitter Description" value={parsedSignals.twitterDescription} />
                        <DataRow label="Twitter Image" value={parsedSignals.twitterImage} />
                        <DataRow label="Twitter Card" value={parsedSignals.twitterCard} />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                            <Globe className="text-indigo-500" size={20} />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Localization</h3>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 space-y-4">
                            <DataRow label="HTML Lang" value={parsedSignals.lang} />
                            <DataRow label="Base Lang" value={parsedSignals.langBase} />
                            <DataRow label="Hreflang Count" value={parsedSignals.hreflangCount?.toString()} />
                            <DataRow label="Canonical URL" value={parsedSignals.canonicalUrl} />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                            <Braces className="text-emerald-500" size={20} />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Structured Data</h3>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 space-y-4">
                            <DataRow label="JSON-LD Count" value={parsedSignals.jsonldCount?.toString()} />
                            <DataRow label="Broken JSON-LD" value={parsedSignals.brokenJsonld?.toString()} highlight={parsedSignals.brokenJsonld > 0 ? "text-red-500" : undefined} />
                            <DataRow label="Primary Schema Type" value={parsedSignals.primarySchemaType} />
                            <DataRow label="Schema Types" value={parsedSignals.schemaTypes?.join(', ')} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getScoreColor = (score: number) => {
    if (score >= 90) return 'green';
    if (score >= 50) return 'amber';
    return 'red';
};

const MetricCard = ({ title, value, suffix = '', _max, color }: any) => {
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

const StatusCard = ({ title, status }: { title: string, status: string }) => {
    const isPass = status === 'PASS';
    const isWarning = status === 'WARNING';
    const Icon = isPass ? CheckCircle : isWarning ? AlertTriangle : XCircle;
    const colorClass = isPass ? 'text-green-500' : isWarning ? 'text-amber-500' : 'text-red-500';

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
                {title}
            </div>
            <div className={`text-xl font-bold flex items-center justify-center gap-2 ${colorClass}`}>
                <Icon size={20} />
                {status}
            </div>
        </div>
    );
};

const DataRow = ({ label, value, highlight }: { label: string, value: string | null | undefined, highlight?: string }) => (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-slate-200 dark:border-slate-800 pb-2 last:border-0 last:pb-0">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 w-32 shrink-0">{label}:</div>
        <div className={`text-sm font-mono text-slate-900 dark:text-slate-100 break-all ${highlight || ''}`}>
            {value || <span className="opacity-40 italic">None</span>}
        </div>
    </div>
);
