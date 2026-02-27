import { ChevronRight } from 'lucide-react';
import { Tooltip } from '../Tooltip';

interface SecondaryMetricCardProps {
  label: string;
  value: number | string;
  delta?: number;
  unit?: string;
  showCompare: boolean;
  tooltip?: string;
}

export const SecondaryMetricCard = ({ label, value, delta, unit, showCompare, tooltip }: SecondaryMetricCardProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-blue-500/30 transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
          <h3 className="text-slate-500 dark:text-slate-400 font-medium text-xs uppercase tracking-wider">{label}</h3>
          {tooltip && <Tooltip content={tooltip} />}
        </div>
        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity -mr-1" />
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900 dark:text-white truncate" title={String(value)}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-slate-500 text-sm font-medium">{unit}</span>}
      </div>

      {showCompare && delta !== undefined && (
        <div className={`text-xs font-semibold mt-1 ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {delta > 0 ? '+' : ''}{delta} vs prev
        </div>
      )}
    </div>
  );
};
