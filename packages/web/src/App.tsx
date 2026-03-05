import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import * as API from './api';
import { Dashboard } from './pages/Dashboard';
import { SinglePage } from './pages/SinglePage';
import { DepthExplorer } from './pages/DepthExplorer';
import { HistoryView } from './components/History/HistoryView';

export const DashboardContext = React.createContext<{
  overview: API.OverviewData | null;
  currentSnapshot: number | null;
  snapshots: API.Snapshot[];
  setSnapshot: (id: number) => void;
  setSnapshots: (snaps: API.Snapshot[]) => void;
  setOverview: (ov: API.OverviewData | null) => void;
  domain: string;
}>({
  overview: null,
  currentSnapshot: null,
  snapshots: [],
  setSnapshot: () => { },
  setSnapshots: () => { },
  setOverview: () => { },
  domain: ''
});

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  // Data State
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [context, setContext] = useState<{ siteId: number, snapshotId: number, domain: string } | null>(null);
  const [snapshots, setSnapshots] = useState<API.Snapshot[]>([]);
  const [currentSnapshotId, setCurrentSnapshotId] = useState<number | null>(null);
  const [overview, setOverview] = useState<API.OverviewData | null>(null);

  // Initial Boot: Only get domain and site ID
  useEffect(() => {
    const init = async () => {
      try {
        const ctx = await API.fetchContext();
        setContext(ctx);

        // Default Boot
        setCurrentSnapshotId(ctx.latestSnapshotId);
      } catch (e) {
        setError('Failed to initialize dashboard. Is the server running?');
        console.error(e);
      } finally {
        setIsBooting(false);
      }
    };
    init();
  }, []);

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

  if (isBooting) {
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
      setSnapshots: setSnapshots,
      setOverview: setOverview,
      domain: context?.domain || 'Loading...'
    }}>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30">
        <BrowserRouter>
          <Sidebar
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
          />
          <Header
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            showCompare={showCompare}
            setShowCompare={setShowCompare}
          />
          <main className="md:pl-64 pt-20 transition-all duration-300">
            <Routes>
              <Route path="/" element={<Dashboard showCompare={showCompare} />} />
              <Route path="/history" element={
                <div className="max-w-[1920px] mx-auto p-4 md:p-8 space-y-8 pb-20">
                  <HistoryView />
                </div>
              } />
              <Route path="/depths" element={<DepthExplorer />} />
              <Route path="/page" element={<SinglePage />} />
            </Routes>
          </main>
        </BrowserRouter>
      </div>
    </DashboardContext.Provider>
  );
}

export default App;
