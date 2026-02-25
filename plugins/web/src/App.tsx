import React from 'react';
import { Sidebar } from './components/Sidebar.js';
import { Topbar } from './components/Topbar.js';
import { HealthSnapshot } from './components/HealthSnapshot.js';
import { IssuesTable } from './components/IssuesTable.js';
import { WarningPanel } from './components/WarningPanel.js';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30">
      <Topbar />
      <Sidebar />

      <main className="md:pl-64 pt-20 pb-10 px-6">
        <div className="max-w-[1600px] mx-auto">
          <HealthSnapshot />

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3">
              <IssuesTable />
            </div>
            <div className="xl:col-span-1">
              <WarningPanel />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
