import React from 'react';
import { graphIntelligence } from '../../data';

export const LinkDistributionChart = () => {
  const { internalLinkDistribution } = graphIntelligence;
  const maxCount = Math.max(...internalLinkDistribution.map(d => d.count));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm h-full flex flex-col">
      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-4">Internal Link Distribution</h3>

      <div className="flex-1 flex flex-col justify-center gap-4">
        {internalLinkDistribution.map((item) => {
          const widthPercent = (item.count / maxCount) * 100;
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
