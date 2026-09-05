import { useEffect, useState } from 'react';
import {
  Shield,
  Server,
  LogOut,
  LayoutDashboard,
  FolderKanban,
  FilePlus,
  Upload,
  Database,
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
  Menu,
  X
} from 'lucide-react';
import { LoginModal } from './components/LoginModal';
import { CaseList } from './components/CaseList';
import { NewCaseView } from './components/NewCaseView';
import { CaseDetailView } from './components/CaseDetailView';
import { InvestigatorDashboard } from './components/InvestigatorDashboard';
import { EvidenceRepositoryView } from './components/EvidenceRepositoryView';
import { EntityExplorerView } from './components/EntityExplorerView';
import { EntityResolutionView } from './components/EntityResolutionView';
import { CrossCaseCorrelationView } from './components/CrossCaseCorrelationView';
import { NetworkAnalysisView } from './components/NetworkAnalysisView';
import { AnomaliesPatternsView } from './components/AnomaliesPatternsView';
import { ContradictionsView } from './components/ContradictionsView';
import { PathFinderView } from './components/PathFinderView';
import { AlertsView } from './components/AlertsView';
import { ReportsView } from './components/ReportsView';
import { InteractiveGraphView } from './components/InteractiveGraphView';
import { TimelineView } from './components/TimelineView';
import { GeospatialView } from './components/GeospatialView';
import { apiClient, unwrapData } from './api/client';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'checking' | 'online' | 'offline';
  details?: string;
  latency?: number;
}

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

export function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tracex_jwt_token'));
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Node.js Express Backend', url: 'http://localhost:5000/api/health', status: 'checking' },
    { name: 'Python FastAPI AI Service', url: 'http://localhost:8000/health', status: 'checking' },
    { name: 'PostgreSQL Database', url: 'http://localhost:5000/api/health/db', status: 'checking' },
    { name: 'Neo4j Graph Database', url: 'http://localhost:5000/api/health/graph', status: 'checking' }
  ]);

  const checkHealth = async () => {
    const updated = await Promise.all(
      services.map(async (service) => {
        const start = performance.now();
        try {
          const res = await fetch(service.url);
          const latency = Math.round(performance.now() - start);
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            return { ...service, status: 'online' as const, latency, details: JSON.stringify(data) };
          }
          return { ...service, status: 'offline' as const, latency, details: `HTTP ${res.status}` };
        } catch (err: any) {
          return { ...service, status: 'offline' as const, details: err.message || 'Connection failed' };
        }
      })
    );
    setServices(updated);
  };

  const verifyUserSession = async () => {
    if (!token) return;
    try {
      const res = await apiClient.get('/auth/me');
      const { user } = unwrapData<{ user: any }>(res.data);
      setUser(user);
    } catch (err) {
      console.warn('Session expired or invalid, logging out');
      handleLogout();
    }
  };

  useEffect(() => {
    checkHealth();
    verifyUserSession();
    const interval = setInterval(checkHealth, 10000);
    const onUnauthorized = () => handleLogout();
    window.addEventListener('tracex:unauthorized', onUnauthorized);
    return () => {
      clearInterval(interval);
      window.removeEventListener('tracex:unauthorized', onUnauthorized);
    };
  }, [token]);

  const handleLoginSuccess = (userData: any, jwtToken: string) => {
    setUser(userData);
    setToken(jwtToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_jwt_token');
    setUser(null);
    setToken(null);
    setSelectedCaseId(null);
  };

  const navGroups = [
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

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 font-sans bg-cyber-grid selection:bg-[#6D4AFF] selection:text-white flex flex-col">
      {!user && <LoginModal onLoginSuccess={handleLoginSuccess} />}

      {user ? (
        <div className="flex-1 flex flex-col md:flex-row min-h-screen">
          {/* Left Vertical Extended Navigation Rail */}
          <aside className={`bg-[#0f0f13] border-b md:border-b-0 md:border-r border-[#1f1f28] flex flex-col justify-between z-30 shrink-0 transition-all duration-300 ${
            sidebarOpen ? 'w-full md:w-64' : 'w-full md:w-16'
          }`}>
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Header & Toggle */}
              <div className="p-4 border-b border-[#1f1f28] flex items-center justify-between">
                <div 
                  onClick={() => { setSelectedCaseId(null); setActiveView('dashboard'); }}
                  className="flex items-center space-x-3 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6D4AFF] to-indigo-900 border border-[#6D4AFF]/50 flex items-center justify-center text-white shadow-lg shadow-[#6D4AFF]/30 group-hover:scale-105 transition-transform">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  {sidebarOpen && (
                    <div className="flex items-center space-x-1 font-extrabold text-base tracking-tight">
                      <span className="text-white">TRACE</span>
                      <span className="bg-[#6D4AFF] text-white text-xs px-1.5 py-0.5 rounded font-bold">X</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1a1a24] rounded-lg transition"
                  title={sidebarOpen ? 'Collapse Navigation' : 'Expand Navigation'}
                >
                  {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="p-3 space-y-6 flex-1">
                {navGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    {sidebarOpen && (
                      <h3 className="px-3 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">
                        {group.title}
                      </h3>
                    )}
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = !selectedCaseId && activeView === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedCaseId(null);
                            setActiveView(item.id as ViewType);
                          }}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-[#6D4AFF] text-white shadow-lg shadow-[#6D4AFF]/40 font-bold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1a24]'
                          }`}
                          title={item.label}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          {sidebarOpen && <span className="truncate">{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Footer System Status */}
              <div className="p-3 border-t border-[#1f1f28] space-y-2">
                <button
                  onClick={checkHealth}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-mono text-slate-400 hover:bg-[#1a1a24] transition cursor-pointer"
                >
                  <Server className="w-4 h-4 text-emerald-400 shrink-0" />
                  {sidebarOpen && <span>Health Check</span>}
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
                  {sidebarOpen && <span>Sign Out</span>}
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content Workspace Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top Workspace Header */}
            <header className="h-14 bg-[#0f0f13] border-b border-[#1f1f28] px-4 md:px-6 flex items-center justify-between z-20 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-mono text-slate-300 uppercase tracking-wide">
                    INTELLIGENCE WORKSTATION ONLINE
                  </span>
                </div>
              </div>

              {/* User Profile Info */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-[#17171f] border border-[#262633] px-3 py-1 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-[#6D4AFF]"></div>
                  <span className="text-xs font-semibold text-slate-200">{user.name}</span>
                  <span className="text-[10px] font-mono bg-[#6D4AFF]/20 text-[#a38cff] border border-[#6D4AFF]/40 px-1.5 py-0.5 rounded uppercase">
                    {user.role}
                  </span>
                </div>
              </div>
            </header>

            {/* Active View Container */}
            <main className="flex-1 overflow-y-auto bg-[#0a0a0c]">
              {selectedCaseId ? (
                <div className="p-4 md:p-6">
                  <CaseDetailView
                    caseId={selectedCaseId}
                    onBack={() => setSelectedCaseId(null)}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'dashboard' ? (
                <InvestigatorDashboard
                  onSelectCase={(id) => setSelectedCaseId(id)}
                  userRole={user.role}
                />
              ) : activeView === 'all_cases' ? (
                <div className="p-4 md:p-6">
                  <CaseList
                    onSelectCase={(id) => setSelectedCaseId(id)}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'new_case' ? (
                <div className="p-4 md:p-6">
                  <NewCaseView
                    onCaseCreated={(caseId) => setSelectedCaseId(caseId)}
                    onCancel={() => setActiveView('all_cases')}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'evidence_repository' || activeView === 'evidence_upload' ? (
                <div className="p-4 md:p-6">
                  <EvidenceRepositoryView
                    onSelectCase={(id) => setSelectedCaseId(id)}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'entity_explorer' ? (
                <div className="p-4 md:p-6">
                  <EntityExplorerView
                    onSelectCase={(id) => setSelectedCaseId(id)}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'entity_resolution' ? (
                <div className="p-4 md:p-6">
                  <EntityResolutionView userRole={user.role} />
                </div>
              ) : activeView === 'correlations' ? (
                <div className="p-4 md:p-6">
                  <CrossCaseCorrelationView
                    onSelectCase={(id) => setSelectedCaseId(id)}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'timeline' ? (
                <div className="p-4 md:p-6">
                  <TimelineView
                    onSelectCase={(id) => setSelectedCaseId(id)}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'network_analysis' ? (
                <div className="p-4 md:p-6">
                  <NetworkAnalysisView userRole={user.role} />
                </div>
              ) : activeView === 'anomalies' ? (
                <div className="p-4 md:p-6">
                  <AnomaliesPatternsView userRole={user.role} />
                </div>
              ) : activeView === 'contradictions' ? (
                <div className="p-4 md:p-6">
                  <ContradictionsView userRole={user.role} />
                </div>
              ) : activeView === 'graph' ? (
                <div className="p-4 md:p-6">
                  <InteractiveGraphView
                    onSelectCase={(id) => setSelectedCaseId(id)}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'map' ? (
                <div className="p-4 md:p-6">
                  <GeospatialView
                    onSelectCase={(id) => setSelectedCaseId(id)}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'path_finder' ? (
                <div className="p-4 md:p-6">
                  <PathFinderView userRole={user.role} />
                </div>
              ) : activeView === 'alerts' ? (
                <div className="p-4 md:p-6">
                  <AlertsView
                    onSelectCase={(id) => setSelectedCaseId(id)}
                    userRole={user.role}
                  />
                </div>
              ) : activeView === 'reports' ? (
                <div className="p-4 md:p-6">
                  <ReportsView
                    selectedCaseId={selectedCaseId}
                    userRole={user.role}
                  />
                </div>
              ) : (
                <div className="p-4 md:p-6">
                  <CaseList
                    onSelectCase={(id) => setSelectedCaseId(id)}
                    userRole={user.role}
                  />
                </div>
              )}
            </main>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="p-12 text-center text-slate-500 bg-[#111115] border border-[#1f1f28] rounded-2xl max-w-md">
            <Shield className="w-12 h-12 text-[#6D4AFF] mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium text-slate-300">
              Please log in with appropriate credentials to access TRACE-X investigation cases.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
