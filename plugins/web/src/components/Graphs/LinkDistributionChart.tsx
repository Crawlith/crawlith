import React, { useContext } from 'react';
import { DashboardContext } from '../../App';

export const LinkDistributionChart = () => {
  // This data is not yet exposed by the API in this iteration (requires histogram computation on edge weights)
  // We will render a placeholder or minimal version
  const { overview } = useContext(DashboardContext);

  // Placeholder data
  const internalLinkDistribution = [
    { label: 'Total Links', count: overview?.totals.internalLinks || 0 },
    { label: 'Avg / Page', count: overview && overview.totals.discovered > 0 ? (overview.totals.internalLinks / overview.totals.discovered).toFixed(1) : 0 },
  ];

  // Simple bar for total links (always 100% relative to itself in this simplified view)
  // const maxCount = overview?.totals.internalLinks || 1; // Unused

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm h-full flex flex-col">
      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-4">Internal Links Overview</h3>

      <div className="flex-1 flex flex-col justify-center gap-4">
        {internalLinkDistribution.map((item) => {
          // Just visualize as full width for now as these are summary stats not distribution buckets
          // const val = Number(item.count); // Unused
          const widthPercent = 100;

          return (
            <div key={item.label} className="w-full group">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-500 dark:text-slate-400">{item.label}</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{item.count}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${widthPercent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
