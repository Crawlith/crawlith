import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface GraphSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export const GraphSearch = ({ onSearch, placeholder = 'Search nodes by URL…' }: GraphSearchProps) => {
  const [value, setValue] = useState('');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setValue(q);
      onSearch(q);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setValue('');
    onSearch('');
  }, [onSearch]);

  return (
    <div className="relative flex items-center w-full max-w-sm">
      <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700
                   bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200
                   placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};
