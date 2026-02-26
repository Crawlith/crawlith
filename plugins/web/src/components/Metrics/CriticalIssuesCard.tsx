import React, { useContext } from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { DashboardContext } from '../../App';

interface CriticalIssuesCardProps {
  showCompare: boolean;
}

export const CriticalIssuesCard = ({ showCompare }: CriticalIssuesCardProps) => {
  const { overview } = useContext(DashboardContext);

  if (!overview) return <div className="animate-pulse bg-slate-100 h-48 rounded-2xl"></div>;

  const { brokenLinks, redirectChains } = overview.totals;
  // TODO: Add metrics for 5xx errors and canonical conflicts once available in API
  const serverErrors = 0;
  const canonicalConflicts = 0;

  const total = brokenLinks + redirectChains + serverErrors + canonicalConflicts;
  const delta = 0; // TODO: Calculate delta

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-red-500/30 transition-all duration-300 relative overflow-hidden">
      <div className="flex justify-between items-start z-10">
        <div>
          <h3 className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500" />
            Critical Issues
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-slate-900 dark:text-white">{total}</span>
            {showCompare && (
              <span className={`text-sm font-semibold flex items-center ${delta > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {delta > 0 ? '+' : ''}{delta}%
                <TrendingDown size={14} className={`ml-1 ${delta > 0 ? 'transform rotate-180' : ''}`} />
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
             {/* Placeholder for "affects high PR pages" metric */}
           <div className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-900/30">
             Needs Attention
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 z-10">
        <MetricItem label="Broken Links" value={brokenLinks} />
        <MetricItem label="5xx Errors" value={serverErrors} />
        <MetricItem label="Redirect Chains" value={redirectChains} />
        <MetricItem label="Canonical Conflicts" value={canonicalConflicts} />
      </div>

      {/* Decorative background */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-red-500/5 rounded-full blur-xl"></div>
    </div>
  );
};

const MetricItem = ({ label, value }: { label: string, value: number }) => (
  <div className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-800 pb-1 last:border-0 last:pb-0">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{value}</span>
  </div>
);
