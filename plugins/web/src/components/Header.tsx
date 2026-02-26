import { Moon, Sun, Clock, ChevronDown, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { crawlInfo } from '../data';

interface HeaderProps {
  toggleSidebar: () => void;
  showCompare: boolean;
  setShowCompare: (show: boolean) => void;
}

export const Header = ({ toggleSidebar, showCompare, setShowCompare }: HeaderProps) => {
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
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 fixed top-0 right-0 left-0 md:left-64 z-30 transition-all duration-300">

      {/* Left Section: Domain & Context */}
      <div className="flex items-center gap-4 md:gap-6">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        >
          <Menu size={20} />
        </button>

        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">
              {crawlInfo.domain}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              Live
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <div className="flex items-center gap-1.5" title="Last Crawl Timestamp">
              <Clock size={12} />
              <span>{crawlInfo.timestamp}</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-1.5 font-mono">
               <span>D:{crawlInfo.config.depth}</span>
               <span className="text-slate-300 dark:text-slate-700">·</span>
               <span>L:{crawlInfo.config.limit}</span>
               <span className="text-slate-300 dark:text-slate-700">·</span>
               <span>C:{crawlInfo.config.concurrency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section: Actions & Settings */}
      <div className="flex items-center gap-3 md:gap-4">

        {/* Snapshot Selector */}
        <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded shadow-sm">
            <span>Snapshot {crawlInfo.snapshotId}</span>
            <ChevronDown size={12} className="opacity-50" />
          </button>

          <button
            onClick={() => setShowCompare(!showCompare)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded transition-colors ml-1
              ${showCompare
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}
            `}
          >
            Compare {crawlInfo.previousSnapshotId}
          </button>
        </div>

        {/* Health Delta Badge (Mobile/Tablet Compact) */}
        <div className="hidden md:flex flex-col items-end">
          <div className={`text-sm font-bold ${crawlInfo.healthDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {crawlInfo.healthDelta > 0 ? '+' : ''}{crawlInfo.healthDelta}
          </div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Health Delta</span>
        </div>

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
