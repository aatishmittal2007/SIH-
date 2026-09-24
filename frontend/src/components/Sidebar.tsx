import React from 'react';
import {
  Shield,
  LayoutDashboard,
  FolderKanban,
  FilePlus,
  Database,
  Upload,
  Users,
  GitMerge,
  Link2,
  Clock,
  Network,
  Activity,
  AlertTriangle,
  Layers,
  MapPin,
  GitBranch,
  Bell,
  FileCheck,
  Server,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

export type ViewType =
  | 'dashboard'
  | 'all_cases'
  | 'new_case'
  | 'evidence_upload'
  | 'evidence_repository'
  | 'entity_explorer'
  | 'entity_resolution'
  | 'correlations'
  | 'timeline'
  | 'network_analysis'
  | 'anomalies'
  | 'contradictions'
  | 'graph'
  | 'map'
  | 'path_finder'
  | 'alerts'
  | 'reports';

export interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    title: 'CORE SYSTEM',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'INVESTIGATIONS',
    items: [
      { id: 'all_cases', label: 'All Cases', icon: FolderKanban },
      { id: 'new_case', label: 'Create New Case', icon: FilePlus },
    ],
  },
  {
    title: 'EVIDENCE',
    items: [
      { id: 'evidence_repository', label: 'Evidence Repository', icon: Database },
      { id: 'evidence_upload', label: 'Upload Evidence', icon: Upload },
    ],
  },
  {
    title: 'ENTITIES',
    items: [
      { id: 'entity_explorer', label: 'Entity Explorer', icon: Users },
      { id: 'entity_resolution', label: 'Entity Resolution', icon: GitMerge },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { id: 'correlations', label: 'Cross-Case Correlation', icon: Link2 },
      { id: 'timeline', label: 'Temporal Analysis', icon: Clock },
      { id: 'network_analysis', label: 'Network Analysis', icon: Network },
      { id: 'anomalies', label: 'Anomalies & Patterns', icon: Activity },
      { id: 'contradictions', label: 'Contradictions', icon: AlertTriangle },
    ],
  },
  {
    title: 'VISUAL EXPLORATION',
    items: [
      { id: 'graph', label: 'Graph Explorer', icon: Layers },
      { id: 'map', label: 'Geospatial Map', icon: MapPin },
      { id: 'path_finder', label: 'Investigation Paths', icon: GitBranch },
    ],
  },
  {
    title: 'MONITORING & OUTPUT',
    items: [
      { id: 'alerts', label: 'Alerts Feed', icon: Bell },
      { id: 'reports', label: 'Intelligence Reports', icon: FileCheck },
    ],
  },
];

interface SidebarProps {
  activeView: ViewType;
  selectedCaseId: string | null;
  onSelectView: (view: ViewType) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onHealthCheck: () => void;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  selectedCaseId,
  onSelectView,
  sidebarOpen,
  onToggleSidebar,
  onHealthCheck,
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const isExpanded = sidebarOpen || isMobileOpen;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen bg-[#0D0A12]/90 backdrop-blur-md border-r border-[rgba(139,92,246,0.20)] flex flex-col justify-between z-50 transition-all duration-200 ease-out select-none shrink-0 ${
          isMobileOpen
            ? 'translate-x-0 w-[218px] shadow-2xl'
            : '-translate-x-full md:translate-x-0'
        } ${sidebarOpen ? 'md:w-[218px]' : 'md:w-[60px]'}`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Top Branding Section */}
          <div className="h-[52px] px-3 border-b border-[rgba(139,92,246,0.20)] flex items-center justify-between shrink-0">
            <div
              onClick={() => {
                onSelectView('dashboard');
                if (isMobileOpen && onCloseMobile) onCloseMobile();
              }}
              className="flex items-center space-x-2.5 cursor-pointer group min-w-0"
              title="TRACE-X Intelligence Platform"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#DC2626] to-[#7C3AED] border border-[rgba(139,92,246,0.5)] flex items-center justify-center text-white shadow-[0_0_10px_rgba(176,38,255,0.4)] group-hover:scale-105 transition-transform shrink-0">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>

              {isExpanded && (
                <div className="flex items-center font-extrabold text-sm tracking-tight truncate">
                  <span className="text-[#F5F5F5]">TRACE</span>
                  <span className="bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white text-[10px] px-1.5 py-0.2 rounded font-bold ml-1 shadow-sm">
                    X
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle / Mobile Close */}
            <div className="flex items-center">
              {/* Mobile Close Button */}
              {isMobileOpen && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="md:hidden p-1 text-[#A1A1AA] hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
                  title="Close Navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Desktop Toggle Button */}
              <button
                type="button"
                onClick={onToggleSidebar}
                className="hidden md:flex p-1 text-[#A1A1AA] hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
                title={sidebarOpen ? 'Collapse to icon rail' : 'Expand navigation'}
              >
                {sidebarOpen ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Navigation Groups List */}
          <nav className="flex-1 overflow-y-auto px-2 py-2.5 space-y-3 custom-scrollbar">
            {navigationGroups.map((group) => (
              <div key={group.title} className="space-y-0.5">
                {/* Section Header */}
                {isExpanded && (
                  <h3 className="px-2.5 text-[10px] font-mono font-semibold text-[#8B5CF6]/70 uppercase tracking-wider mb-1 mt-3 first:mt-1">
                    {group.title}
                  </h3>
                )}

                {/* Items */}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = !selectedCaseId && activeView === item.id;

                  return (
                    <div key={item.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectView(item.id);
                          if (isMobileOpen && onCloseMobile) onCloseMobile();
                        }}
                        className={`w-full flex items-center transition-all duration-150 cursor-pointer ${
                          isExpanded
                            ? `h-[35px] px-2.5 rounded-[8px] space-x-2.5 text-[13px] ${
                                isActive
                                  ? 'bg-gradient-to-r from-[#DC2626] via-[#B026FF] to-[#7C3AED] text-white font-semibold shadow-[0_0_12px_rgba(176,38,255,0.35),0_0_6px_rgba(220,38,38,0.25)]'
                                  : 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
                              }`
                            : `h-9 justify-center rounded-[8px] ${
                                isActive
                                  ? 'bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white shadow-[0_0_12px_rgba(176,38,255,0.35),0_0_6px_rgba(220,38,38,0.25)]'
                                  : 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
                              }`
                        }`}
                        title={isExpanded ? undefined : item.label}
                      >
                        <Icon
                          className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                            isActive ? 'text-white' : 'text-[#A1A1AA] group-hover:text-white'
                          }`}
                        />
                        {isExpanded && (
                          <span className="truncate text-left leading-none">{item.label}</span>
                        )}
                      </button>

                      {/* Tooltip in Desktop Collapsed Rail Mode */}
                      {!isExpanded && (
                        <div className="absolute left-[54px] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-[#15121C] text-[#F5F5F5] text-xs font-medium whitespace-nowrap shadow-xl border border-[rgba(139,92,246,0.25)] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {item.label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom System & User Controls */}
          <div className="p-2 border-t border-[rgba(139,92,246,0.20)] space-y-1 shrink-0 bg-[#0D0A12]">
            <div className="relative group">
              <button
                type="button"
                onClick={onHealthCheck}
                className={`w-full flex items-center transition-colors rounded-[8px] cursor-pointer text-xs font-mono text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04] ${
                  isExpanded ? 'h-[35px] px-2.5 space-x-2.5' : 'h-9 justify-center'
                }`}
                title={isExpanded ? undefined : 'System Health Check'}
              >
                <Server className="w-4 h-4 text-emerald-400 shrink-0" />
                {isExpanded && <span>Health Check</span>}
              </button>
              {!isExpanded && (
                <div className="absolute left-[54px] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-[#15121C] text-[#F5F5F5] text-xs font-medium whitespace-nowrap shadow-xl border border-[rgba(139,92,246,0.25)] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  Health Check
                </div>
              )}
            </div>

            <div className="relative group">
              <button
                type="button"
                onClick={onLogout}
                className={`w-full flex items-center transition-colors rounded-[8px] cursor-pointer text-xs font-semibold text-[#A1A1AA] hover:text-rose-400 hover:bg-rose-500/10 ${
                  isExpanded ? 'h-[35px] px-2.5 space-x-2.5' : 'h-9 justify-center'
                }`}
                title={isExpanded ? undefined : 'Sign Out'}
              >
                <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                {isExpanded && <span>Sign Out</span>}
              </button>
              {!isExpanded && (
                <div className="absolute left-[54px] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-[#15121C] text-[#F5F5F5] text-xs font-medium whitespace-nowrap shadow-xl border border-[rgba(139,92,246,0.25)] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  Sign Out
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
