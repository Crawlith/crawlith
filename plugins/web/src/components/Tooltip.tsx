import React from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
    content: React.ReactNode;
    children?: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    return (
        <div className="relative flex items-center group cursor-help ml-2">
            {children || <Info size={14} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" />}

            {/* Tooltip Content */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-48 p-2.5 bg-slate-800 dark:bg-slate-700 text-white text-xs font-normal rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                {content}
                {/* Triangle pointer */}
                <div className="absolute top-full left-1/2 -ml-1.5 border-[6px] border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
            </div>
        </div>
    );
};
