import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Network, FileText, Settings, Layers, ChevronRight, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen bg-slate-900 border-r border-slate-800
        transition-transform duration-300 ease-in-out w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Network className="text-white" size={18} />
            </div>
            <span>Crawlith</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <SidebarGroup title="Analytics">
            <SidebarItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={currentPath === '/'}
              onClick={() => handleNavigation('/')}
            />
            <SidebarItem
              icon={FileText}
              label="Content Audit"
              active={currentPath === '/audit'}
              onClick={() => handleNavigation('/audit')}
            />
          </SidebarGroup>

          <SidebarGroup title="Management">
            <SidebarItem
              icon={Layers}
              label="Crawl History"
              active={currentPath === '/history'}
              onClick={() => handleNavigation('/history')}
            />
            <SidebarItem
              icon={Settings}
              label="Configuration"
              active={currentPath === '/settings'}
              onClick={() => handleNavigation('/settings')}
            />
          </SidebarGroup>
        </nav>

      </aside>
    </>
  );
};

const SidebarGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-6 last:mb-0">
    <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
      {title}
    </h3>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group ${active
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}>
    <div className="flex items-center gap-3">
      <Icon size={18} className={active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
      {label}
    </div>
    {active && <ChevronRight size={14} className="opacity-50" />}
  </button>
);
