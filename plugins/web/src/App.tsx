import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HealthScoreCard } from './components/Metrics/HealthScoreCard';
import { CriticalIssuesCard } from './components/Metrics/CriticalIssuesCard';
import { IndexabilityRiskCard } from './components/Metrics/IndexabilityRiskCard';
import { SecondaryMetricCard } from './components/Metrics/SecondaryMetricCard';
import { IssuesTable } from './components/IssuesTable';
import { CriticalPanel } from './components/CriticalPanel';
import { GraphIntelligenceSection } from './components/GraphIntelligenceSection';
import { secondaryMetrics } from './data';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  return (
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
  );
}

export default App;
