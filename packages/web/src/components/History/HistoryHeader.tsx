import React from 'react';
import { Snapshot } from '../../api';
import { Calendar, Layers, Clock } from 'lucide-react';

interface HistoryHeaderProps {
  totalSnapshots: number;
  firstSnapshot?: Snapshot;
  lastSnapshot?: Snapshot;
}

export const HistoryHeader: React.FC<HistoryHeaderProps> = ({ totalSnapshots, firstSnapshot, lastSnapshot }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="text-blue-500" />
            Crawl History
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Track structural evolution, compare snapshots, and analyze trends over time.
          </p>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col">
            <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider">Total Snapshots</span>
            <span className="font-bold text-slate-900 dark:text-white text-lg">{totalSnapshots}</span>
          </div>

          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block" />

          <div className="flex flex-col">
            <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1">
              <Clock size={10} /> First Crawl
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {firstSnapshot ? new Date(firstSnapshot.createdAt).toLocaleDateString() : '-'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1">
              <Calendar size={10} /> Latest Crawl
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {lastSnapshot ? new Date(lastSnapshot.createdAt).toLocaleDateString() : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
