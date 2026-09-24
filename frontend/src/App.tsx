import { useEffect, useState } from 'react';
import {
  Shield,
  Menu,
} from 'lucide-react';
import { Sidebar, type ViewType } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { CyberHudBackground } from './components/CyberHudBackground';
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

export function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tracex_jwt_token'));
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
      const data = (unwrapData<{ user: any }>(res.data) || res.data) as any;
      const verifiedUser = data?.user || data;
      if (verifiedUser && (verifiedUser.id || verifiedUser.email)) {
        setUser(verifiedUser);
      } else {
        handleLogout();
      }
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

  return (
    <div className="min-h-screen bg-[#08070B] text-[#F5F5F5] font-sans bg-workstation-grid selection:bg-[#7C3AED] selection:text-white flex flex-col">
      {!user && <LoginModal onLoginSuccess={handleLoginSuccess} />}

      {user ? (
        <div className="flex-1 flex flex-col md:flex-row md:h-screen md:overflow-hidden relative">
          {/* Cyber HUD Background for Dashboard and All Workspace Views */}
          <CyberHudBackground variant="workstation" fixed={true} opacity={0.65} />

          {/* Left Vertical HUD Navigation Sidebar */}
          <Sidebar
            activeView={activeView}
            selectedCaseId={selectedCaseId}
            onSelectView={(v) => {
              setSelectedCaseId(null);
              setActiveView(v);
            }}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onHealthCheck={checkHealth}
            onLogout={handleLogout}
            isMobileOpen={isMobileOpen}
            onCloseMobile={() => setIsMobileOpen(false)}
          />

          {/* Main Content Workspace Area */}
          <div className="flex-1 flex flex-col min-w-0 md:h-screen overflow-hidden relative z-10">
            {/* Top Workspace Header */}
            <header className="h-12 bg-[#0D0A12]/85 backdrop-blur-md border-b border-[rgba(139,92,246,0.20)] px-4 md:px-6 flex items-center justify-between z-20 shrink-0">
              <div className="flex items-center space-x-3">
                {/* Mobile Navigation Drawer Toggle */}
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(true)}
                  className="md:hidden p-1.5 text-[#A1A1AA] hover:text-white hover:bg-white/[0.06] rounded-md transition-colors mr-1 cursor-pointer"
                  title="Open Navigation Menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-status-red-purple"></span>
                  <span className="text-xs font-mono text-[#A1A1AA] uppercase tracking-wider">
                    RESTRICTED // INTELLIGENCE WORKSTATION ONLINE
                  </span>
                </div>
              </div>

              {/* User Profile Info */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-[#111019]/90 backdrop-blur border border-[rgba(139,92,246,0.20)] px-2.5 py-1 rounded-md shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse"></div>
                  <span className="text-xs font-medium text-[#F5F5F5]">{user.name}</span>
                  <span className="text-[9px] font-mono bg-[#7C3AED]/20 text-[#B026FF] border border-[#7C3AED]/30 px-1.5 py-0.2 rounded uppercase font-bold">
                    {user.role}
                  </span>
                </div>
              </div>
            </header>

            {/* Active View Container */}
            <main className="flex-1 overflow-y-auto bg-transparent p-2 sm:p-4 lg:p-6 flex flex-col relative z-10">
              <div className="w-full max-w-[1680px] mx-auto flex-1 flex flex-col">
                {selectedCaseId ? (
                  <div className="p-2 sm:p-4">
                    <CaseDetailView
                      caseId={selectedCaseId}
                      onBack={() => setSelectedCaseId(null)}
                      userRole={user.role}
                    />
                  </div>
                ) : activeView === 'dashboard' ? (
                  <div className="workstation-bezel bg-[#111019]/85 backdrop-blur-md p-3 sm:p-5 lg:p-6 flex-1 flex flex-col shadow-2xl">
                    <InvestigatorDashboard
                      onSelectCase={(id) => setSelectedCaseId(id)}
                      userRole={user.role}
                    />
                  </div>
                ) : activeView === 'all_cases' ? (
                  <div className="p-2 sm:p-4">
                    <CaseList
                      onSelectCase={(id) => setSelectedCaseId(id)}
                      userRole={user.role}
                    />
                  </div>
                ) : activeView === 'new_case' ? (
                  <div className="p-2 sm:p-4">
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
              </div>
            </main>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="p-12 text-center text-[#A1A1AA] bg-[#111019] border border-[rgba(139,92,246,0.25)] rounded-2xl max-w-md shadow-2xl">
            <Shield className="w-12 h-12 text-[#7C3AED] mx-auto mb-4 opacity-70 animate-logo-glow" />
            <p className="text-sm font-medium text-[#F5F5F5]">
              Please log in with appropriate credentials to access TRACE-X investigation cases.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
