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
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHistory([]);
    setTrends([]);
    setError(null);
    const loadData = async () => {
      try {
        const [historyRes, trendsRes] = await Promise.all([
          API.fetchHistory(),
          API.fetchHistoryTrends(),
        ]);
        if (!cancelled) {
          setHistory(historyRes.results);
          setTrends(trendsRes.results);
        }
      } catch (e) {
        if (!cancelled) {
          setHistory([]);
          setTrends([]);
          setError(e instanceof Error ? e.message : 'Failed to load history and trends.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [refreshVersion]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this snapshot? This action cannot be undone.')) {
      return;
    }
    try {
      await API.deleteSnapshot(id);
      setRefreshVersion(version => version + 1);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  // Compare the clicked snapshot (B) with the one just before it (A). History is newest first.
  const handleCompare = (snapshotId: number) => {
    const index = history.findIndex(h => h.id === snapshotId);
    const previous = index === -1 ? undefined : history[index + 1];
    if (!previous) return;
    setSelectedSnapshotA(previous.id);
    setSelectedSnapshotB(snapshotId);
    setCompareMode(true);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading History...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

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
