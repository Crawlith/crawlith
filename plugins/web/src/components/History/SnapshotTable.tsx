import React from 'react';
import { Snapshot } from '../../api';
import { Trash2, GitCompare, ChevronRight } from 'lucide-react';

interface SnapshotTableProps {
  snapshots: Snapshot[];
  onDelete: (id: number) => void;
  onCompare: (id: number) => void;
}

export const SnapshotTable: React.FC<SnapshotTableProps> = ({ snapshots, onDelete, onCompare }) => {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-400">ID</th>
            <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-400">Date</th>
            <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 text-right">Pages</th>
            <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 text-right">Health</th>
            <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 text-right">Orphans</th>
            <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 text-right">Thin Content</th>
            <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {snapshots.map((snap) => (
            <tr key={snap.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-6 py-4 font-mono text-xs text-slate-500">#{snap.id}</td>
              <td className="px-6 py-4 text-slate-800 dark:text-slate-200">
                {new Date(snap.createdAt).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-right font-medium">{snap.pages}</td>
              <td className="px-6 py-4 text-right">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                  ${(snap.health || 0) > 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    (snap.health || 0) > 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {snap.health ?? '-'}
                </span>
              </td>
              <td className="px-6 py-4 text-right text-slate-500">{snap.orphanPages ?? '-'}</td>
              <td className="px-6 py-4 text-right text-slate-500">{snap.thinContent ?? '-'}</td>
              <td className="px-6 py-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => onCompare(snap.id)}
                  className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors group"
                  title="Compare with previous"
                >
                  <GitCompare size={16} />
                </button>
                <button
                  onClick={() => onDelete(snap.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete Snapshot"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {snapshots.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">
                No snapshots found. Run a crawl to generate history.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
