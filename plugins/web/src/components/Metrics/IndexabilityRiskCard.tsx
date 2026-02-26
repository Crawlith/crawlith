import React from 'react';
import { Search, Info } from 'lucide-react';
import { primaryMetrics } from '../../data';

interface IndexabilityRiskCardProps {
  showCompare: boolean;
}

export const IndexabilityRiskCard = ({ showCompare }: IndexabilityRiskCardProps) => {
  const { total, breakdown } = primaryMetrics.indexabilityRisk;

  // Calculate percentages for the mini chart
  const totalBreakdown = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const getPercent = (val: number) => (val / totalBreakdown) * 100;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-amber-500/30 transition-all duration-300 relative overflow-hidden">
      <div className="z-10">
        <h3 className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1 uppercase tracking-wider flex items-center gap-2">
          <Search size={14} className="text-amber-500" />
          Indexability Risk
        </h3>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-4xl font-bold text-slate-900 dark:text-white">{total}</span>
          <span className="text-xs text-slate-400 font-medium">Pages at risk</span>
        </div>

        {/* Mini Stacked Bar Chart */}
        <div className="h-2 w-full flex rounded-full overflow-hidden mb-4 bg-slate-100 dark:bg-slate-800">
          <div style={{ width: `${getPercent(breakdown.orphanPages)}%` }} className="bg-orange-500" title="Orphan Pages" />
          <div style={{ width: `${getPercent(breakdown.noindexPages)}%` }} className="bg-slate-500" title="Noindex" />
          <div style={{ width: `${getPercent(breakdown.canonicalIssues)}%` }} className="bg-amber-400" title="Canonical Issues" />
          <div style={{ width: `${getPercent(breakdown.lowInternalLinks)}%` }} className="bg-blue-400" title="Low Internal Links" />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <RiskItem label="Orphan Pages" value={breakdown.orphanPages} color="bg-orange-500" />
          <RiskItem label="Noindex" value={breakdown.noindexPages} color="bg-slate-500" />
          <RiskItem label="Canonical Issues" value={breakdown.canonicalIssues} color="bg-amber-400" />
          <RiskItem label="Low Internal Links" value={breakdown.lowInternalLinks} color="bg-blue-400" />
        </div>
      </div>

       {/* Decorative background */}
       <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl"></div>
    </div>
  );
};

const RiskItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="flex items-center justify-between text-xs">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`}></div>
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
    </div>
    <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{value}</span>
  </div>
);
