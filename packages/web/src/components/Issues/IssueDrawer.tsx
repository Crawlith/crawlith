import { X, ExternalLink, Link, AlertTriangle } from 'lucide-react';
import * as API from '../../api';

interface IssueDrawerProps {
  issue: API.Issue | null;
  onClose: () => void;
  isOpen: boolean;
}

export const IssueDrawer = ({ issue, onClose, isOpen }: IssueDrawerProps) => {
  if (!issue) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`
        fixed top-0 right-0 h-full w-full md:w-[600px] bg-white dark:bg-slate-900
        shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                  issue.severity === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  issue.severity === 'Warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {issue.severity}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Impact Score: {issue.impactScore}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {issue.type}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">

            {/* URL Info */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Affected URL</label>
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 group">
                <code className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all">{issue.url}</code>
                <a href={issue.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-slate-400 hover:text-blue-500 transition-colors">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">PageRank</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{issue.pageRank}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">Inlinks</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{issue.internalLinksCount}</div>
              </div>
            </div>

            {/* Description & Fix */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-slate-400" />
                  What is this?
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {issue.description}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Why it matters</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {issue.whyItMatters}
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-2">How to fix</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                  {issue.howToFix}
                </p>
              </div>
            </div>

            {/* Cluster Info (if applicable) */}
            {issue.clusterId && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Duplicate Cluster</label>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Link size={16} />
                  <span>Part of cluster: </span>
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-900 dark:text-slate-200">
                    {issue.clusterId}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
            <button
               onClick={onClose}
               className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Close
            </button>
            <button className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors">
              Mark as Fixed
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
