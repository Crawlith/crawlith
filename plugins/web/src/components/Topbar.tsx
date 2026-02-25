import { Moon, Sun, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

export const Topbar = () => {
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
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-10 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <div className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
          <span className="text-blue-600 dark:text-blue-500">Crawlith</span> Console
        </div>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800/50">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          Healthy
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
          JD
        </div>
      </div>
    </header>
  );
};
