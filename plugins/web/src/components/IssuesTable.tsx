import React, { useState, useMemo } from 'react';
import { issues, Issue } from '../data';
import { AlertTriangle, AlertCircle, Info, ChevronRight, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { IssueDrawer } from './Issues/IssueDrawer';

export const IssuesTable = () => {
  const [filter, setFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'All' | 'Critical' | 'Warning' | 'Info'>('All');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Issue, direction: 'asc' | 'desc' } | null>({ key: 'impactScore', direction: 'desc' });
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const filteredIssues = useMemo(() => {
    return issues.filter(i => {
      const matchesSearch = i.url.toLowerCase().includes(filter.toLowerCase()) || i.type.toLowerCase().includes(filter.toLowerCase());
      const matchesSeverity = severityFilter === 'All' || i.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    }).sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;

      // Handle special sorting for impactScore (numeric) vs others (string)
      if (key === 'impactScore' || key === 'pageRank') {
         // @ts-expect-error - Types are loosely defined for dynamic sorting keys
         return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
      }

      // @ts-expect-error - Types are loosely defined for dynamic sorting keys
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      // @ts-expect-error - Types are loosely defined for dynamic sorting keys
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filter, severityFilter, sortConfig]);

  const handleSort = (key: keyof Issue) => {
    let direction: 'asc' | 'desc' = 'desc'; // Default to desc for metrics usually
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col h-[800px] shadow-sm">

        {/* Header Controls */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Issues Detected <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2.5 py-0.5 rounded-full font-mono">{filteredIssues.length}</span>
            </h3>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search URL or Issue Type..."
                className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-slate-200 transition-all"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['All', 'Critical', 'Warning', 'Info'] as const).map((severity) => (
              <button
                key={severity}
                onClick={() => setSeverityFilter(severity)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  severityFilter === severity
                    ? severity === 'All' ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900' :
                      severity === 'Critical' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/30' :
                      severity === 'Warning' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/30' :
                      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/30'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
              <tr>
                <SortableHeader label="URL" sortKey="url" currentSort={sortConfig} onSort={handleSort} className="pl-6 w-1/3" />
                <SortableHeader label="Issue Type" sortKey="type" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Severity" sortKey="severity" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label="Impact" sortKey="impactScore" currentSort={sortConfig} onSort={handleSort} align="right" />
                <SortableHeader label="Last Seen" sortKey="lastSeen" currentSort={sortConfig} onSort={handleSort} align="right" />
                <th className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredIssues.map((issue) => (
                <tr
                  key={issue.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
                  onClick={() => setSelectedIssue(issue)}
                >
                  <td className="px-6 py-3 font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs" title={issue.url}>
                    {issue.url}
                  </td>
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-300 font-medium">{issue.type}</td>
                  <td className="px-6 py-3">
                    <SeverityBadge severity={issue.severity} />
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="inline-flex items-center justify-end font-mono font-medium text-slate-700 dark:text-slate-300">
                      {issue.impactScore}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-500 tabular-nums text-right text-xs">
                    {issue.lastSeen}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <button className="p-1 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                       <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <IssueDrawer
        issue={selectedIssue}
        isOpen={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />
    </>
  );
};

const SortableHeader = ({ label, sortKey, currentSort, onSort, className = "", align = "left" }: any) => {
  const isActive = currentSort?.key === sortKey;

  return (
    <th
      className={`px-6 py-3 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {label}
        {isActive && (
          currentSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        )}
      </div>
    </th>
  );
};

const SeverityBadge = ({ severity }: { severity: Issue['severity'] }) => {
  const styles = {
    Critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30',
    Warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30',
    Info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30',
  };

  const Icons = {
    Critical: AlertTriangle,
    Warning: AlertCircle,
    Info: Info,
  };

  const Icon = Icons[severity];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${styles[severity]}`}>
      <Icon size={12} />
      {severity}
    </span>
  );
};
