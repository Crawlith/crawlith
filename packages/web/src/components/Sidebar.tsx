import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Network, Layers, ListTree, ChevronRight, X, Globe2, ChevronDown, Check } from 'lucide-react';
import * as API from '../api';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sites, setSites] = useState<API.SiteSummary[]>([]);
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);

  const currentPath = location.pathname;
  const currentSearch = new URLSearchParams(location.search);
  const currentSiteId = currentSearch.get('siteId') || '';
  const selectedSiteValue = currentSiteId || (sites[0] ? String(sites[0].id) : '');
  const selectedSite = sites.find((s) => String(s.id) === selectedSiteValue);

  const handleNavigation = (path: string) => {
    navigate({
      pathname: path,
      search: currentSearch.toString() ? `?${currentSearch.toString()}` : ''
    });
    setIsOpen(false);
  };

  const handleSiteSwitch = (nextSiteId: string) => {
    const next = new URLSearchParams(location.search);
    if (nextSiteId) next.set('siteId', nextSiteId);
    else next.delete('siteId');
    next.delete('snapshot');
    next.delete('pageSnapshot');
    const nextUrl = `/${next.toString() ? `?${next.toString()}` : ''}`;
    window.location.assign(nextUrl);
    setSiteDropdownOpen(false);
    setIsOpen(false);
  };

  useEffect(() => {
    API.fetchSites()
      .then((res) => setSites(res.results))
      .catch((err) => console.error('Failed to load sites', err));
  }, []);

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

        <div className="px-4 py-4 border-b border-slate-800">
          <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-3 relative">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Site Workspace</label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{sites.length}</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setSiteDropdownOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 bg-slate-900/80 text-slate-100 border border-slate-600 rounded-lg px-2.5 py-2 text-sm outline-none hover:border-slate-500 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Globe2 size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{selectedSite?.domain || 'Select site'}</span>
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${siteDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {siteDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 overflow-hidden z-50">
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    Available Sites
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {sites.map((s) => {
                      const isActive = String(s.id) === selectedSiteValue;
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleSiteSwitch(String(s.id))}
                          className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors ${
                            isActive
                              ? 'bg-blue-900/30 text-blue-300'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate pr-2">{s.domain}</span>
                          {isActive && <Check size={13} className="text-blue-300 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
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
              icon={ListTree}
              label="Depth Explorer"
              active={currentPath === '/depths'}
              onClick={() => handleNavigation('/depths')}
            />
          </SidebarGroup>

          <SidebarGroup title="Management">
            <SidebarItem
              icon={Layers}
              label="Crawl History"
              active={currentPath === '/history'}
              onClick={() => handleNavigation('/history')}
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
