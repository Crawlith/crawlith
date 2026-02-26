import React from 'react';

interface SecondaryMetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  delta?: number;
  showCompare: boolean;
}

export const SecondaryMetricCard = ({ label, value, unit, delta, showCompare }: SecondaryMetricCardProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors group">
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
          {label}
        </span>

        {showCompare && delta !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            delta > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
            delta < 0 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
            'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-xs text-slate-400 font-medium">{unit}</span>}
      </div>
    </div>
  );
};
