import React, { useState, useEffect } from 'react';
import * as API from '../../api';
import { HistoryHeader } from './HistoryHeader';
import { TrendChart } from './TrendChart';
import { SnapshotTable } from './SnapshotTable';
import { ComparisonView } from './ComparisonView';

export const HistoryView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<API.Snapshot[]>([]);
  const [trends, setTrends] = useState<API.HistoryTrend[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedSnapshotA, setSelectedSnapshotA] = useState<number | null>(null);
  const [selectedSnapshotB, setSelectedSnapshotB] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const historyRes = await API.fetchHistory();
      setHistory(historyRes.results);
      const trendsRes = await API.fetchHistoryTrends();
      setTrends(trendsRes.results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this snapshot? This action cannot be undone.')) {
      return;
    }
    try {
      await API.deleteSnapshot(id);
      loadData();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleCompare = (snapshotId: number) => {
    if (selectedSnapshotA === null) {
      setSelectedSnapshotA(snapshotId);
      // If we have at least one previous snapshot, auto-select the immediate previous one for B?
      // Or just wait for user to select B.
      // Actually, UX: click 'Compare' on a row -> sets it as B (current/newer), then prompts to select A (baseline).
      // Let's assume the user clicked 'Compare' on the NEWER snapshot they want to analyze.
      // So set B = snapshotId.
      setSelectedSnapshotB(snapshotId);

      // Try to find the snapshot immediately before this one in the history list (history is sorted DESC)
      const currentIndex = history.findIndex(h => h.id === snapshotId);
      if (currentIndex !== -1 && currentIndex < history.length - 1) {
        setSelectedSnapshotA(history[currentIndex + 1].id);
      } else {
        // If it's the oldest, maybe clear A so they have to pick
        setSelectedSnapshotA(null);
      }
      setCompareMode(true);
    } else {
      // If already in compare mode, maybe just update one of them?
      // Let's keep it simple: Reset if they click compare again from the list, or handle inside ComparisonView.
      setSelectedSnapshotB(snapshotId);
      setCompareMode(true);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading History...</div>;

  if (compareMode && selectedSnapshotA && selectedSnapshotB) {
    return (
      <ComparisonView
        snapshotA={selectedSnapshotA}
        snapshotB={selectedSnapshotB}
        allSnapshots={history}
        onBack={() => setCompareMode(false)}
        onChangeA={setSelectedSnapshotA}
        onChangeB={setSelectedSnapshotB}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <HistoryHeader
        totalSnapshots={history.length}
        firstSnapshot={history[history.length - 1]}
        lastSnapshot={history[0]}
      />

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Total Pages</h3>
          <TrendChart data={trends} dataKey="pages" color="#3b82f6" label="" />
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Health Score</h3>
          <TrendChart data={trends} dataKey="health" color="#10b981" label="" />
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Broken Links</h3>
          <TrendChart data={trends} dataKey="brokenLinks" color="#ef4444" label="" />
        </div>
      </div>

      {/* Snapshots Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-semibold text-slate-800 dark:text-white">Snapshots</h2>
        </div>
        <SnapshotTable
          snapshots={history}
          onDelete={handleDelete}
          onCompare={handleCompare}
        />
      </div>
    </div>
  );
};
