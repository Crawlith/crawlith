import { issues, Issue } from '../data.js';
import { useState, useMemo } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export const IssuesTable = () => {
  const [filter, setFilter] = useState('');

  const filteredIssues = useMemo(() => {
    return issues.filter(i =>
      i.url.toLowerCase().includes(filter.toLowerCase()) ||
      i.type.toLowerCase().includes(filter.toLowerCase())
    );
  }, [filter]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          Issues Detected <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full">{issues.length}</span>
        </h3>
        <input
          type="text"
          placeholder="Filter URL or Issue Type..."
          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-blue-500 dark:text-slate-200"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">URL</th>
              <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">Issue Type</th>
              <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">Severity</th>
              <th className="px-6 py-3 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {filteredIssues.map((issue) => (
              <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-3 font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer" title={issue.url}>
                  {issue.url}
                </td>
                <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{issue.type}</td>
                <td className="px-6 py-3">
                  <SeverityBadge severity={issue.severity} />
                </td>
                <td className="px-6 py-3 text-slate-500 dark:text-slate-500 tabular-nums">{issue.lastSeen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SeverityBadge = ({ severity }: { severity: Issue['severity'] }) => {
  const styles = {
    Critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30',
    Warning: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/30',
    Info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30',
  };

  const Icons = {
    Critical: AlertTriangle,
    Warning: AlertCircle,
    Info: Info,
  };

  const Icon = Icons[severity];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[severity]}`}>
      <Icon size={12} />
      {severity}
    </span>
  );
};
