import { useContext, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as API from '../api';
import { DashboardContext } from '../App';
import { withSiteId } from '../utils/siteQuery';

export const DepthExplorer = () => {
  const { currentSnapshot } = useContext(DashboardContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<API.DepthGroup[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!currentSnapshot) {
        setGroups([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await API.fetchDepthPages(currentSnapshot);
        if (!cancelled) setGroups(res.results || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load depth pages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [currentSnapshot]);

  const totalPages = useMemo(() => groups.reduce((sum, g) => sum + g.count, 0), [groups]);

  const openAll = (pages: API.DepthPage[]) => {
    for (const page of pages) {
      window.open(page.fullUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="max-w-[1920px] mx-auto p-4 md:p-8 space-y-6 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-slate-100">Depth Explorer</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Browse pages by crawl depth. Click a URL for page details or open all URLs in that depth.
        </p>
        <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Snapshot: <span className="font-mono">#{currentSnapshot ?? '-'}</span> · Total pages: <span className="font-semibold">{totalPages}</span>
        </div>
      </div>

      {loading && (
        <div className="text-slate-500 dark:text-slate-400">Loading depth pages...</div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="text-slate-500 dark:text-slate-400">No pages found for this snapshot.</div>
      )}

      {!loading && !error && groups.map((group) => (
        <section
          key={group.depth}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
        >
          <header className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Depth {group.depth}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{group.count} page{group.count === 1 ? '' : 's'}</p>
            </div>
            <button
              onClick={() => openAll(group.pages)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <FolderOpen size={14} /> Open All
            </button>
          </header>

          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {group.pages.map((page) => (
              <li key={`${group.depth}:${page.url}`} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={withSiteId('/page', {
                      url: page.url,
                      ...(currentSnapshot ? { snapshot: String(currentSnapshot) } : {})
                    })}
                    className="block truncate text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
                    title={page.fullUrl}
                  >
                    {page.url}
                  </Link>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Status {page.status || 0} · PageRank {Math.round(page.pageRankScore || 0)}
                  </div>
                </div>

                <a
                  href={page.fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300"
                  title={`Open ${page.fullUrl}`}
                >
                  Open <ExternalLink size={12} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
