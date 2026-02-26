import React from 'react';
import { criticalIssuesList } from '../data';
import { AlertTriangle, ExternalLink, Network, ChevronRight } from 'lucide-react';

export const CriticalPanel = () => {
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
          Top {criticalIssuesList.length} issues sorted by Impact Score
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {criticalIssuesList.map((issue) => (
          <div
            key={issue.id}
            className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900/30 transition-all group"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {issue.type}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Impact: {issue.impactScore}</span>
            </div>

            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate mb-3" title={issue.url}>
              {issue.url}
            </div>

            <div className="flex items-center gap-2">
               <button className="flex-1 px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1">
                 Details <ChevronRight size={12} />
               </button>
               <a
                 href={issue.url}
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
