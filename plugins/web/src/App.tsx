import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HealthScoreCard } from './components/Metrics/HealthScoreCard';
import { CriticalIssuesCard } from './components/Metrics/CriticalIssuesCard';
import { IndexabilityRiskCard } from './components/Metrics/IndexabilityRiskCard';
import { SecondaryMetricCard } from './components/Metrics/SecondaryMetricCard';
import { IssuesTable } from './components/IssuesTable';
import { CriticalPanel } from './components/CriticalPanel';
import { GraphIntelligenceSection } from './components/GraphIntelligenceSection';
import * as API from './api';

export const DashboardContext = React.createContext<{
  overview: API.OverviewData | null;
  currentSnapshot: number | null;
  snapshots: API.Snapshot[];
  setSnapshot: (id: number) => void;
  domain: string;
}>({
  overview: null,
  currentSnapshot: null,
  snapshots: [],
  setSnapshot: () => { },
  domain: ''
});

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  // Data State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [context, setContext] = useState<{ siteId: number, snapshotId: number, domain: string } | null>(null);
  const [snapshots, setSnapshots] = useState<API.Snapshot[]>([]);
  const [currentSnapshotId, setCurrentSnapshotId] = useState<number | null>(null);
  const [overview, setOverview] = useState<API.OverviewData | null>(null);

  // Initial Boot
  useEffect(() => {
    const init = async () => {
      try {
        const ctx = await API.fetchContext();
        setContext(ctx);
        setCurrentSnapshotId(ctx.snapshotId);

        const snaps = await API.fetchSnapshots();
        setSnapshots(snaps.results);
      } catch (e) {
        setError('Failed to initialize dashboard. Is the server running?');
        console.error(e);
      }
    };
    init();
  }, []);

  // Fetch Data on Snapshot Change
  useEffect(() => {
    if (!currentSnapshotId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const ov = await API.fetchOverview(currentSnapshotId);
        setOverview(ov);
        setError(null);
      } catch (e) {
        setError('Failed to load snapshot data.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentSnapshotId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b1120] text-red-500">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Error Loading Dashboard</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (loading && !overview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b1120] text-slate-500">
        <div className="animate-pulse">Loading Crawlith Context...</div>
      </div>
    );
  }

  const secondaryMetrics = overview ? [
    { label: 'Pages Discovered', value: overview.totals.discovered, delta: 0 },
    { label: 'Successfully Crawled', value: overview.totals.crawled, delta: 0 },
    { label: 'Duplicate Clusters', value: overview.totals.duplicateClusters, delta: 0 },
    { label: 'Thin Content', value: overview.totals.thinContent, delta: 0 },
    { label: 'Crawl Efficiency', value: overview.crawl.efficiency, unit: '%', delta: 0 },
    { label: 'Internal Links', value: overview.totals.internalLinks, delta: 0 },
  ] : [];

  return (
    <DashboardContext.Provider value={{
      overview,
      currentSnapshot: currentSnapshotId,
      snapshots,
      setSnapshot: setCurrentSnapshotId,
      domain: context?.domain || 'Loading...'
    }}>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

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
      </div>
    </DashboardContext.Provider>
  );
}

export default App;
