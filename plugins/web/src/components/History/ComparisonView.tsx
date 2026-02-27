import React, { useEffect, useState } from 'react';
import * as API from '../../api';
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle, FilePlus, FileMinus } from 'lucide-react';

interface ComparisonViewProps {
  snapshotA: number;
  snapshotB: number;
  allSnapshots: API.Snapshot[];
  onBack: () => void;
  onChangeA: (id: number) => void;
  onChangeB: (id: number) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ snapshotA, snapshotB, allSnapshots, onBack, onChangeA, onChangeB }) => {
  const [data, setData] = useState<API.SnapshotComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await API.fetchSnapshotComparison(snapshotA, snapshotB);
        setData(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (snapshotA && snapshotB) fetch();
  }, [snapshotA, snapshotB]);

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Analyzing differences...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load comparison.</div>;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      {/* Header / Controls */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium">
          <ArrowLeft size={18} /> Back to History
        </button>

        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Baseline (A)</span>
            <select
              value={snapshotA}
              onChange={(e) => onChangeA(Number(e.target.value))}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {allSnapshots.map(s => <option key={s.id} value={s.id}>#{s.id} ({new Date(s.createdAt).toLocaleDateString()})</option>)}
            </select>
          </div>
          <ArrowRight size={16} className="text-slate-400" />
          <div className="flex items-center gap-2">
             <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Comparison (B)</span>
             <select
              value={snapshotB}
              onChange={(e) => onChangeB(Number(e.target.value))}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {allSnapshots.map(s => <option key={s.id} value={s.id}>#{s.id} ({new Date(s.createdAt).toLocaleDateString()})</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
           <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
               <FilePlus size={20} />
             </div>
             <span className="text-sm font-medium text-slate-500">Pages Added</span>
           </div>
           <span className="text-3xl font-bold text-slate-800 dark:text-white">+{data.diff.pagesAdded}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
           <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg">
               <FileMinus size={20} />
             </div>
             <span className="text-sm font-medium text-slate-500">Pages Removed</span>
           </div>
           <span className="text-3xl font-bold text-slate-800 dark:text-white">-{data.diff.pagesRemoved}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
           <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
               <AlertTriangle size={20} />
             </div>
             <span className="text-sm font-medium text-slate-500">New Issues</span>
           </div>
           <span className="text-3xl font-bold text-red-600 dark:text-red-400">
             {data.diff.newIssues.brokenLinks.length}
           </span>
           <span className="text-xs text-slate-400 ml-2">Broken Links</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
           <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
               <CheckCircle size={20} />
             </div>
             <span className="text-sm font-medium text-slate-500">Health Delta</span>
           </div>
           <div className="flex items-baseline gap-2">
             <span className={`text-3xl font-bold ${data.diff.healthDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
               {data.diff.healthDelta > 0 ? '+' : ''}{data.diff.healthDelta.toFixed(1)}
             </span>
             <span className="text-sm text-slate-400">points</span>
           </div>
        </div>
      </div>

      {/* Detailed Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New Issues List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" /> New Broken Links
            </h3>
            <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">
              {data.diff.newIssues.brokenLinks.length} found
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.diff.newIssues.brokenLinks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No new broken links detected.</div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.diff.newIssues.brokenLinks.map((issue, i) => (
                  <li key={i} className="px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm truncate text-red-600 dark:text-red-400">
                    {issue.normalized_url}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Resolved Issues List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" /> Resolved Broken Links
            </h3>
            <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">
              {data.diff.resolvedIssues.brokenLinks.length} fixed
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.diff.resolvedIssues.brokenLinks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No resolved issues found.</div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.diff.resolvedIssues.brokenLinks.map((issue, i) => (
                  <li key={i} className="px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm truncate text-green-600 dark:text-green-400">
                    {issue.normalized_url}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
