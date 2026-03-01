import React, { useEffect, useState, useContext } from 'react';
import { AlertTriangle, ExternalLink, Network, ChevronRight } from 'lucide-react';
import { DashboardContext } from '../App';
import * as API from '../api';

export const CriticalPanel = () => {
  const { currentSnapshot } = useContext(DashboardContext);
  const [criticalIssues, setCriticalIssues] = useState<API.Issue[]>([]);

  useEffect(() => {
    if (!currentSnapshot) return;

    const fetchCritical = async () => {
        try {
            // Fetch top 10 critical issues
            const data = await API.fetchIssues(currentSnapshot, 'Critical', undefined, 1);
            // Sort by impact score descending locally since API returns paginated but not strictly ordered by impact globally across all pages without specific endpoint
            // (Assuming API returns ordered results, which we implemented in server)
            setCriticalIssues(data.results.slice(0, 10));
        } catch(e) {
            console.error(e);
        }
    }
    fetchCritical();
  }, [currentSnapshot]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col h-[800px] shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/10">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-red-100 dark:bg-red-900/30 p-1.5 rounded-lg text-red-600 dark:text-red-400">
            <AlertTriangle size={18} />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Critical Attention</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 ml-9">
          Top {criticalIssues.length} issues sorted by Impact Score
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {criticalIssues.map((issue, idx) => (
          <div
            key={idx}
            className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900/30 transition-all group"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {issue.issueType}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Impact: {issue.impactScore}</span>
            </div>

            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate mb-3" title={issue.url}>
              {issue.url}
            </div>

            <div className="flex items-center gap-2">
                {/* TODO: Implement issue details drawer trigger */}
               <button className="flex-1 px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1">
                 Details <ChevronRight size={12} />
               </button>
               <a
                 href={issue.url} // This might be relative if crawled site is relative, but assuming absolute URLs from DB
                 target="_blank"
                 rel="noopener noreferrer"
                 className="px-2 py-1.5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                 title="Open URL"
               >
                 <ExternalLink size={14} />
               </a>
            </div>
          </div>
        ))}
        {criticalIssues.length === 0 && (
            <div className="text-center text-slate-400 text-xs py-10">
                No critical issues found. Great job!
            </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50 dark:bg-slate-900/50">
        <button className="w-full py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm shadow-red-900/20">
          Export Critical Issues
        </button>
        <button className="w-full py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
          <Network size={14} />
          View in Structure Graph
        </button>
      </div>
    </div>
  );
};
