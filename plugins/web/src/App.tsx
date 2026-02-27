import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import * as API from './api';
import { Dashboard } from './pages/Dashboard';
import { SinglePage } from './pages/SinglePage';
import { HistoryView } from './components/History/HistoryView';

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

  return (
    <DashboardContext.Provider value={{
      overview,
      currentSnapshot: currentSnapshotId,
      snapshots,
      setSnapshot: setCurrentSnapshotId,
      domain: context?.domain || 'Loading...'
    }}>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30">
        <BrowserRouter>
          <Sidebar
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
          />
          <Routes>
            <Route path="/" element={<Dashboard sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />} />
            <Route path="/history" element={
              <main className="md:pl-64 pt-20 transition-all duration-300">
                <div className="max-w-[1920px] mx-auto p-4 md:p-8 space-y-8 pb-20">
                  <HistoryView />
                </div>
              </main>
            } />
            <Route path="/page" element={
              <main className="md:pl-64 pt-20 transition-all duration-300">
                <SinglePage />
              </main>
            } />
          </Routes>
        </BrowserRouter>
      </div>
    </DashboardContext.Provider>
  );
}

export default App;
