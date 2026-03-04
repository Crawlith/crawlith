import { Moon, Sun, Clock, ChevronDown, Menu, ArrowLeft } from 'lucide-react';
import { useEffect, useState, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardContext } from '../App';

interface HeaderProps {
  toggleSidebar: () => void;
  showCompare: boolean;
  setShowCompare: (show: boolean) => void;
}

export const Header = ({ toggleSidebar, showCompare: _showCompare, setShowCompare: _setShowCompare }: HeaderProps) => {
  const { overview, currentSnapshot, snapshots, setSnapshot, domain } = useContext(DashboardContext);
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === '/';
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const currentSnapshotData = snapshots.find(s => s.id === currentSnapshot);

  return (
    <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 fixed top-0 right-0 left-0 md:left-64 z-50 transition-all duration-300">

      {/* Left Section: Domain & Context */}
      <div className="flex items-center gap-4 md:gap-6">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        >
          <Menu size={20} />
        </button>

        {!isDashboard && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          >
            <ArrowLeft size={14} />
            Back
          </button>
        )}

        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">
              {domain}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              Live
            </span>
          </div>

          {isDashboard && (
            <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <div className="flex items-center gap-1.5" title="Last Crawl Timestamp">
                <Clock size={12} />
                <span>{currentSnapshotData?.createdAt ? new Date(currentSnapshotData.createdAt).toLocaleString() : 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Section: Actions & Settings */}
      <div className="flex items-center gap-3 md:gap-4">

        {/* Snapshot Selector (Dashboard Only) */}
        {isDashboard && (
          <div className="relative hidden lg:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded shadow-sm hover:bg-white/90 transition-colors"
            >
              <span>Snapshot #{currentSnapshot}</span>
              <ChevronDown size={12} className={`opacity-50 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                  Audit History
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {snapshots.map(snap => (
                    <button
                      key={snap.id}
                      onClick={() => {
                        setSnapshot(snap.id);
                        setDropdownOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${currentSnapshot === snap.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>#{snap.id}</span>
                        <span className="text-[10px] opacity-60 font-mono">
                          {new Date(snap.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Backdrop to close dropdown */}
            {dropdownOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}></div>
            )}
          </div>
        )}

        {/* Health Delta Badge (Dashboard Only) */}
        {isDashboard && overview && (
          <div className="hidden md:flex flex-col items-end">
            <div className={`text-sm font-bold ${overview.health.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {overview.health.delta > 0 ? '+' : ''}{overview.health.delta}
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Health Delta</span>
          </div>
        )}

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>

        <button
          onClick={toggleTheme}
          className="p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
};
