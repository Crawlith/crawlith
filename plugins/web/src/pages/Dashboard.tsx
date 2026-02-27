import { useContext, useState } from 'react';
import { DashboardContext } from '../App';
import { HealthScoreCard } from '../components/Metrics/HealthScoreCard';
import { CriticalIssuesCard } from '../components/Metrics/CriticalIssuesCard';
import { IndexabilityRiskCard } from '../components/Metrics/IndexabilityRiskCard';
import { SecondaryMetricCard } from '../components/Metrics/SecondaryMetricCard';
import { IssuesTable } from '../components/IssuesTable';
import { CriticalPanel } from '../components/CriticalPanel';
import { GraphIntelligenceSection } from '../components/GraphIntelligenceSection';
import { Header } from '../components/Header';

interface DashboardProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

export function Dashboard({ sidebarOpen, setSidebarOpen }: DashboardProps) {
    const { overview } = useContext(DashboardContext);
    const [showCompare, setShowCompare] = useState(false);

    const secondaryMetrics = overview ? [
        { label: 'Pages Discovered', value: overview.totals.discovered, delta: 0, tooltip: 'Total raw URLs found during the crawl (includes blocked or broken links).' },
        { label: 'Successfully Crawled', value: overview.totals.crawled, delta: 0, tooltip: 'Pages that returned a successful 200 OK status.' },
        { label: 'Duplicate Clusters', value: overview.totals.duplicateClusters, delta: 0, tooltip: 'Groups of pages with highly identical content.' },
        { label: 'Thin Content', value: overview.totals.thinContent, delta: 0, tooltip: 'Pages with very little text (often under 300 words).' },
        { label: 'Crawl Efficiency', value: overview.crawl.efficiency, unit: '%', delta: 0, tooltip: 'Percentage of discovered URLs that were successfully fetched.' },
        { label: 'Internal Links', value: overview.totals.internalLinks, delta: 0, tooltip: 'Total number of valid internal hyperlinks found.' },
    ] : [];

    return (
        <>
            <Header
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                showCompare={showCompare}
                setShowCompare={setShowCompare}
            />

            <main className="md:pl-64 pt-20 transition-all duration-300">
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
            </main>
        </>
    );
}
