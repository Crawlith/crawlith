import { useEffect, useState, useContext } from 'react';
import { DashboardContext } from '../../App';
import * as API from '../../api';
import { Tooltip } from '../Tooltip';

export const SimpleBarChart = () => {
  const { currentSnapshot } = useContext(DashboardContext);
  const [data, setData] = useState<API.MetricBucket[]>([]);

  useEffect(() => {
    if (!currentSnapshot) return;
    API.fetchDepthDistribution(currentSnapshot).then(res => setData(res.buckets));
  }, [currentSnapshot]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center mb-4">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Crawl Depth Distribution</h3>
        <Tooltip content="Shows how many clicks away pages are from the start URL. Pages deeper than depth 4 may be harder for search engines to discover." />
      </div>

      <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2 overflow-x-auto">
        {data.map((item) => {
          const heightPercent = (item.count / maxCount) * 100;
          return (
            <div key={item.depth} className="flex flex-col items-center gap-2 flex-1 group min-w-[30px]">
              <div className="relative w-full flex items-end justify-center h-32">
                <div
                  className="w-full bg-blue-100 dark:bg-blue-900/20 rounded-t-sm group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors relative"
                  style={{ height: `${heightPercent}%` }}
                >
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-[10px] font-bold text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white dark:bg-slate-800 px-1 rounded border dark:border-slate-700 z-10">
                    {item.count}
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">D{item.depth}</span>
            </div>
          );
        })}
        {data.length === 0 && <div className="text-xs text-slate-400 m-auto">No depth data available</div>}
      </div>
    </div>
  );
};
