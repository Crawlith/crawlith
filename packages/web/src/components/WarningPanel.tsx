import { criticalIssues } from '../data.js';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export const WarningPanel = () => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-red-600 dark:text-red-400">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Critical Attention</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">5 issues require immediate fix</p>
        </div>
      </div>

      <div className="space-y-3">
        {criticalIssues.map((issue) => (
          <div key={issue.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50 hover:border-red-200 dark:hover:border-red-900/30 transition-colors group cursor-pointer">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">{issue.type}</span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate">
              {issue.url}
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-dashed border-slate-200 dark:border-slate-700">
        View All Critical Issues
      </button>
    </div>
  );
};
