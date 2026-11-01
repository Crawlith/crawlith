import { useContext, useEffect, useState } from 'react';
import { DashboardContext } from '../App';
import * as API from '../api';
import { HealthScoreCard } from '../components/Metrics/HealthScoreCard';
import { CriticalIssuesCard } from '../components/Metrics/CriticalIssuesCard';
import { IndexabilityRiskCard } from '../components/Metrics/IndexabilityRiskCard';
import { SecondaryMetricCard } from '../components/Metrics/SecondaryMetricCard';
import { IssuesTable } from '../components/IssuesTable';
import { CriticalPanel } from '../components/CriticalPanel';
import { GraphIntelligenceSection } from '../components/GraphIntelligenceSection';

interface DashboardProps {
    showCompare: boolean;
}

export function Dashboard({ showCompare }: DashboardProps) {
    const { currentSnapshot, overview, setOverview, snapshots, setSnapshots } = useContext(DashboardContext);
    const [localLoading, setLocalLoading] = useState(false);
    const [snapshotError, setSnapshotError] = useState<string | null>(null);
    const [overviewError, setOverviewError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (snapshots.length === 0) {
            setSnapshotError(null);
            const loadSnapshots = async () => {
                try {
                    const res = await API.fetchSnapshots();
                    if (!cancelled) setSnapshots(res.results);
                } catch (e) {
                    if (!cancelled) setSnapshotError(e instanceof Error ? e.message : 'Failed to load snapshots.');
                }
            };
            loadSnapshots();
        }
        return () => { cancelled = true; };
    }, [snapshots.length, setSnapshots]);

    useEffect(() => {
        let cancelled = false;
        setOverview(null);
        setOverviewError(null);
        setLocalLoading(Boolean(currentSnapshot));
        if (!currentSnapshot) return () => { cancelled = true; };

        const loadData = async () => {
            try {
                const ov = await API.fetchOverview(currentSnapshot);
                if (!cancelled) setOverview({ ...ov, snapshotId: currentSnapshot });
            } catch (e) {
                if (!cancelled) {
                    setOverview(null);
                    setOverviewError(e instanceof Error ? e.message : 'Failed to load dashboard overview.');
                }
            } finally {
                if (!cancelled) setLocalLoading(false);
            }
        };

        loadData();
        return () => { cancelled = true; };
    }, [currentSnapshot, setOverview]);

    if (overviewError || snapshotError) {
        return <div className="p-8 text-center text-red-500">{overviewError || snapshotError}</div>;
    }

    if (!currentSnapshot) {
        return <div className="p-8 text-center text-slate-500">Select a snapshot to view the dashboard.</div>;
    }

    if (!overview || overview.snapshotId !== currentSnapshot || localLoading) {
        return (
            <div className="max-w-[1920px] mx-auto p-4 md:p-8 space-y-8 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800"></div>
                    ))}
                </div>
                <div className="text-center py-20 text-slate-400">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                    <p className="text-sm font-medium">Calculating site-wide intelligence...</p>
                </div>
            </div>
        );
    }

    const secondaryMetrics = [
        { label: 'Pages Discovered', value: overview.totals.discovered, delta: 0, tooltip: 'Total raw URLs found during the crawl (includes blocked or broken links).' },
        { label: 'Successfully Crawled', value: overview.totals.crawled, delta: 0, tooltip: 'Pages that returned a successful 200 OK status.' },
        { label: 'Duplicate Clusters', value: overview.totals.duplicateClusters, delta: 0, tooltip: 'Groups of pages with highly identical content.' },
        { label: 'Thin Content', value: overview.totals.thinContent, delta: 0, tooltip: 'Pages with very little text (often under 300 words).' },
        { label: 'Crawl Efficiency', value: overview.crawl.efficiency, unit: '%', delta: 0, tooltip: 'Percentage of discovered URLs that were successfully fetched.' },
        { label: 'Internal Links', value: overview.totals.internalLinks, delta: 0, tooltip: 'Total number of valid internal hyperlinks found.' },
    ];

    return (
        <div className="max-w-[1920px] mx-auto p-4 md:p-8 space-y-8 pb-20">
            {/* Primary Metrics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <HealthScoreCard showCompare={showCompare} />
                <CriticalIssuesCard showCompare={showCompare} />
                <IndexabilityRiskCard showCompare={showCompare} />
            </div>

            {/* Secondary Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {secondaryMetrics.map((metric, index) => (
                    <SecondaryMetricCard
                        key={index}
                        label={metric.label}
                        value={metric.value}
                        tooltip={metric.tooltip}
                        unit={metric.unit}
                        delta={metric.delta}
                        showCompare={showCompare}
                    />
                ))}
            </div>

            {/* Main Section */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full">
                <div className="xl:col-span-3 h-full">
                    <IssuesTable />
                </div>
                <div className="xl:col-span-1 h-full">
                    <CriticalPanel />
                </div>
            </div>

            {/* Lower Section: Graph Intelligence */}
            <GraphIntelligenceSection />
        </div>
    );
}
