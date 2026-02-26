import React from 'react';
import { graphIntelligence } from '../../data';

export const DuplicateClusterChart = () => {
  const { duplicateClusterSizeDistribution } = graphIntelligence;
  const maxCount = Math.max(...duplicateClusterSizeDistribution.map(d => d.count));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm h-full flex flex-col">
      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-4">Duplicate Cluster Sizes</h3>

      <div className="flex-1 flex items-end justify-between gap-4 px-2 pb-2">
        {duplicateClusterSizeDistribution.map((item) => {
          const heightPercent = (item.count / maxCount) * 100;
          return (
            <div key={item.size} className="flex flex-col items-center gap-2 flex-1 group">
              <div className="relative w-full flex items-end justify-center h-32">
                <div
                  className="w-full bg-amber-100 dark:bg-amber-900/20 rounded-t-sm group-hover:bg-amber-200 dark:group-hover:bg-amber-800/40 transition-colors relative"
                  style={{ height: `${heightPercent}%` }}
                >
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-[10px] font-bold text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                     {item.count}
                   </div>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.size} pages</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
