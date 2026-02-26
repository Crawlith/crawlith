import React, { useEffect, useState, useContext } from 'react';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { DashboardContext } from '../../App';
import * as API from '../../api';

export const PageRankTable = () => {
  const { currentSnapshot } = useContext(DashboardContext);
  const [topPages, setTopPages] = useState<API.TopPage[]>([]);

  useEffect(() => {
    if (!currentSnapshot) return;
    const fetchData = async () => {
      try {
        const data = await API.fetchTopPages(currentSnapshot);
        setTopPages(data.results);
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [currentSnapshot]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-500" />
          Top Pages by PageRank
        </h3>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">URL</th>
              <th className="px-4 py-2 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-right">PR</th>
              <th className="px-4 py-2 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-right">Auth.</th>
              <th className="px-4 py-2 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-right">Hub</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {topPages.map((page, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={page.url}>
                  <div className="flex items-center gap-2">
                    <span className="truncate">{page.url}</span>
                    <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-blue-500">
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </td>
                <td className="px-4 py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                    {page.pageRank ? page.pageRank.toFixed(4) : '-'}
                </td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">
                    {page.authorityScore ? page.authorityScore.toFixed(2) : '-'}
                </td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">
                    {page.hubScore ? page.hubScore.toFixed(2) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
