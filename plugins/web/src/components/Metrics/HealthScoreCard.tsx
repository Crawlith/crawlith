import { useContext } from 'react';
import { DashboardContext } from '../../App';
import { Tooltip } from '../Tooltip';

interface HealthScoreCardProps {
  showCompare: boolean;
}

export const HealthScoreCard = ({ showCompare }: HealthScoreCardProps) => {
  const { overview } = useContext(DashboardContext);

  if (!overview) return <div className="animate-pulse bg-slate-100 h-48 rounded-2xl"></div>;

  const { score: value, delta, status } = overview.health;

  // Determine color based on score
  const getColor = (score: number) => {
    if (score >= 80) return 'text-green-500 stroke-green-500';
    if (score >= 50) return 'text-amber-500 stroke-amber-500';
    return 'text-red-500 stroke-red-500';
  };

  const colorClass = getColor(value);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between relative group hover:border-blue-500/30 transition-all duration-300">
      <div className="z-10 relative">
        <div className="flex items-center">
          <h3 className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1 uppercase tracking-wider">Health Score</h3>
          <Tooltip content="Penalty-based score out of 100. Points are deducted based on the severity of issues found across all crawled pages." />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${colorClass.split(' ')[0]}`}>{value ? value.toFixed(0) : 0}</span>
          <span className="text-slate-400 dark:text-slate-600 text-lg">/100</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${status === 'Good' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
            status === 'Warning' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
              'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
            }`}>
            {status}
          </span>
          {showCompare && delta !== undefined && Math.abs(delta) > 0.01 && (
            <span className={`text-xs font-semibold ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)} vs prev
            </span>
          )}
        </div>
      </div>

      <div className="relative w-24 h-24 flex items-center justify-center z-10">
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-slate-100 dark:text-slate-800"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${colorClass.split(' ')[1]} transition-all duration-1000 ease-out`}
          />
        </svg>
      </div>

      {/* Background decoration container */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-50 to-transparent dark:from-slate-800/20 dark:to-transparent rounded-bl-full -z-0 opacity-50"></div>
      </div>
    </div>
  );
};
