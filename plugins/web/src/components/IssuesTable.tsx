import React, { useState, useEffect, useContext } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronRight, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { DashboardContext } from '../App';
import * as API from '../api';

export const IssuesTable = () => {
  const { currentSnapshot } = useContext(DashboardContext);

  const [issues, setIssues] = useState<API.Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'All' | 'Critical' | 'Warning' | 'Info'>('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Sort state is local for now as API sort isn't fully implemented in this iteration
  const [sortConfig, setSortConfig] = useState<{ key: keyof API.Issue, direction: 'asc' | 'desc' } | null>({ key: 'impactScore', direction: 'desc' });

  useEffect(() => {
    if (!currentSnapshot) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const severity = severityFilter === 'All' ? undefined : severityFilter;
        const search = filter || undefined;
        const data = await API.fetchIssues(currentSnapshot, severity, search, page);
        setIssues(data.results);
        setTotalPages(Math.ceil(data.total / data.pageSize));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchData, 300);
    return () => clearTimeout(debounce);
  }, [currentSnapshot, filter, severityFilter, page]);


  const handleSort = (key: keyof API.Issue) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });

    // Client-side sort for current page (since API sort is limited in this scope)
    const sorted = [...issues].sort((a, b) => {
        // @ts-expect-error - dynamic key access
        if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
        // @ts-expect-error - dynamic key access
        if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    setIssues(sorted);
  };

  // const Icon = Icons[severity]; // This was causing error because Icons wasn't defined in scope before usage in map loop if strict TS.

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col h-[800px] shadow-sm">

      {/* Header Controls */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Issues Detected
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2.5 py-0.5 rounded-full font-mono">
                {loading ? '...' : issues.length}
            </span>
          </h3>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search URL..."
              className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-slate-200 transition-all"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {['All', 'Critical', 'Warning', 'Info'].map((severity) => (
            <button
              key={severity}
              onClick={() => { setSeverityFilter(severity as any); setPage(1); }}
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
      <div className="overflow-auto flex-1 relative">
        {loading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center z-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        )}
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
            <tr>
              <SortableHeader label="URL" sortKey="url" currentSort={sortConfig} onSort={handleSort} className="pl-6 w-1/3" />
              <SortableHeader label="Issue Type" sortKey="issueType" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Severity" sortKey="severity" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Impact" sortKey="impactScore" currentSort={sortConfig} onSort={handleSort} align="right" />
              <SortableHeader label="PageRank" sortKey="pageRank" currentSort={sortConfig} onSort={handleSort} align="right" />
              <th className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {issues.map((issue, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-3 font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs" title={issue.url}>
                  {issue.url}
                </td>
                <td className="px-6 py-3 text-slate-700 dark:text-slate-300 font-medium">{issue.issueType}</td>
                <td className="px-6 py-3">
                  <SeverityBadge severity={issue.severity} />
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="inline-flex items-center justify-end font-mono font-medium text-slate-700 dark:text-slate-300">
                    {issue.impactScore}
                  </div>
                </td>
                <td className="px-6 py-3 text-slate-500 dark:text-slate-500 tabular-nums text-right text-xs">
                  {issue.pageRank ? issue.pageRank.toFixed(4) : '-'}
                </td>
                <td className="px-6 py-3 text-center">
                  <button className="p-1 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                     <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {issues.length === 0 && !loading && (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No issues found matching your filters.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1 text-sm rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-50"
          >
              Previous
          </button>
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1 text-sm rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-50"
          >
              Next
          </button>
      </div>
    </div>
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

const SeverityBadge = ({ severity }: { severity: API.Issue['severity'] }) => {
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
