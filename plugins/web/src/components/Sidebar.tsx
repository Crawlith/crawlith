import { LayoutDashboard, Network, FileText, Settings, Layers } from 'lucide-react';

export const Sidebar = () => {
  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen fixed left-0 top-0 pt-16 hidden md:flex transition-colors duration-200">
      <nav className="flex-1 px-4 py-6 space-y-1">
        <SidebarItem icon={LayoutDashboard} label="Overview" active />
        <SidebarItem icon={Network} label="Structure" />
        <SidebarItem icon={FileText} label="Content" />
        <SidebarItem icon={Settings} label="Technical" />
        <SidebarItem icon={Layers} label="Compare" />
      </nav>
      <div className="p-4 text-xs text-slate-500 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800">
        Crawlith v0.0.1
      </div>
    </aside>
  );
};

const SidebarItem = ({ icon: Icon, label, active }: any) => (
  <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    active
      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
  }`}>
    <Icon size={18} />
    {label}
  </button>
);
