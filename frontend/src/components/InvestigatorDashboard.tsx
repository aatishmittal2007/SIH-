import React, { useEffect, useState } from 'react';
import {
  Folder,
  FileText,
  GitCompare,
  AlertTriangle,
  Sparkles,
  Brain,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Sliders,
  Database,
  Radio,
  Layers,
  Crosshair,
  Shield,
  Filter
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

interface DashboardProps {
  onSelectCase: (caseId: string) => void;
  userRole: string;
}

interface DashboardData {
  user: { id: string; role: string };
  metrics: {
    totalCases: number;
    openCases: number;
    activeCases: number;
    closedCases: number;
    totalEvidence: number;
    pendingEntityMatches: number;
    activeCorrelations: number;
    activeContradictions: number;
    activeFindings: number;
    activeAlerts: number;
  };
  assignedCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
    evidenceCount?: number;
    contradictionCount?: number;
  }>;
  recentEvidence: Array<{
    id: string;
    caseId: string;
    caseNumber?: string;
    caseTitle?: string;
    title: string;
    type: string;
    sourceName?: string;
    processingStatus: string;
    createdAt: string;
    label: 'CONFIRMED DATA';
  }>;
  pendingEntityMatches: Array<{
    id: string;
    sourceEntity: { id: string; displayName: string; type: string };
    targetEntity: { id: string; displayName: string; type: string };
    similarityScore: number;
    matchType: string;
    reason: string;
    status: string;
    createdAt: string;
    label: 'CANDIDATE';
  }>;
  correlationCandidates: Array<{
    id: string;
    sourceCase: { id: string; caseNumber: string; title: string };
    targetCase: { id: string; caseNumber: string; title: string };
    score: number;
    confidence: number;
    signals: any;
    status: string;
    createdAt: string;
    label: 'ANALYTICAL SIGNAL';
  }>;
  anomaliesAndPatterns: Array<{
    id: string;
    caseId: string | null;
    caseNumber?: string;
    caseTitle?: string;
    patternType: string;
    severity: string;
    score: number;
    explanation: string;
    detectedAt: string;
    label: 'ANALYTICAL SIGNAL';
  }>;
  contradictions: Array<{
    id: string;
    caseId: string;
    caseNumber?: string;
    caseTitle?: string;
    type: string;
    description: string;
    severity: string;
    status: string;
    claimsCount: number;
    createdAt: string;
    label: 'CONTRADICTION';
  }>;
  intelligenceFindings: Array<{
    id: string;
    caseId: string | null;
    caseNumber?: string;
    caseTitle?: string;
    findingType: string;
    title: string;
    summary: string;
    confidence: number;
    severity: string;
    status: string;
    createdAt: string;
    label: 'ANALYTICAL SIGNAL';
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    userName?: string;
    createdAt: string;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    caseId: string | null;
    caseNumber?: string;
    status: string;
    createdAt: string;
    label: 'ANALYTICAL SIGNAL';
  }>;
}

interface RadarNode {
  id: string;
  title: string;
  badge: string;
  type: 'case' | 'contradiction' | 'candidate' | 'evidence' | 'finding';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  caseId?: string;
  angle: number; // 0 to 360 degrees
  radiusRatio: number; // 0.2 to 0.95
  color: string;
  firstDetectedAt: string;
  lastEventAt: string;
  relatedEntitiesCount: number;
  currentStatus: string;
  details: string;
}

interface ActionItem {
  id: string;
  investigationRef: string;
  title: string;
  type: 'contradiction' | 'candidate' | 'alert' | 'case' | 'anomaly';
  severity: string;
  caseId?: string;
  candidateId?: string;
  timestamp?: string;
}

export const InvestigatorDashboard: React.FC<DashboardProps> = ({ onSelectCase, userRole: _userRole }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'radar' | 'overview' | 'contradictions' | 'resolutions' | 'signals'>('radar');
  const [timeframe, setTimeframe] = useState<'1d' | '1w' | '1m'>('1m');
  const [selectedNode, setSelectedNode] = useState<RadarNode | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/dashboard');
      const payload = unwrapData<any>(res.data) || res.data;
      setData(payload);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to connect to Intelligence Dashboard API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleConfirmMatch = async (matchId: string, confirm: boolean) => {
    try {
      const commentText = confirm ? 'Confirmed from Investigator Dashboard' : 'Rejected from Investigator Dashboard';
      await apiClient.post(`/entity-resolution/candidates/${matchId}/${confirm ? 'confirm' : 'reject'}`, {
        comment: commentText,
        reviewComment: commentText,
      });
      setActionMessage(`Entity resolution candidate ${confirm ? 'confirmed' : 'rejected'}.`);
      setActiveDropdownId(null);
      fetchDashboardData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(`Action failed: ${err.response?.data?.message || err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-4 bg-[#111019] border border-[rgba(139,92,246,0.20)] rounded-xl text-center">
        <RefreshCw className="w-9 h-9 text-[#B026FF] animate-spin" />
        <p className="text-sm font-semibold text-[#F5F5F5] tracking-wider uppercase font-mono">
          Initializing TRACE-X Intelligence Station...
        </p>
        <span className="text-xs text-[#A1A1AA] font-mono">
          Querying Postgres, Neo4j Graph & Analytical Provenance Bus
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-[#15121C] border border-[#DC2626]/30 rounded-xl text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-[#EF4444] mx-auto" />
        <h3 className="text-base font-bold text-[#F5F5F5] uppercase tracking-wide">
          Intelligence Workstation Offline
        </h3>
        <p className="text-xs text-[#A1A1AA] max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-gradient-to-r from-[#DC2626] to-[#7C3AED] hover:from-[#EF4444] hover:to-[#8B5CF6] text-white text-xs font-semibold rounded-lg transition shadow-md shadow-[#7C3AED]/25 cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Map real API items into radial radar nodes
  const radarNodes: RadarNode[] = [];

  // 1. Assigned cases
  data.assignedCases.forEach((c, idx) => {
    const angle = (idx * 68 + 25) % 360;
    const radiusRatio = 0.32 + (idx % 4) * 0.17;
    const isHigh = c.priority === 'HIGH' || c.priority === 'CRITICAL';
    radarNodes.push({
      id: c.id,
      title: c.title,
      badge: isHigh ? 'CRITICAL' : 'ASSIGNED',
      type: 'case',
      severity: isHigh ? 'CRITICAL' : 'MEDIUM',
      caseId: c.id,
      angle,
      radiusRatio,
      color: isHigh ? '#DC2626' : '#B026FF',
      firstDetectedAt: new Date(c.createdAt).toISOString().replace('T', ' ').slice(0, 19),
      lastEventAt: new Date(c.updatedAt).toISOString().replace('T', ' ').slice(0, 19),
      relatedEntitiesCount: (c.evidenceCount || 1) * 2,
      currentStatus: c.status || 'Open',
      details: c.description || 'Active criminal investigation workspace.',
    });
  });

  // 2. Contradictions
  data.contradictions.forEach((ct, idx) => {
    const angle = (idx * 84 + 115) % 360;
    const radiusRatio = 0.42 + (idx % 3) * 0.22;
    radarNodes.push({
      id: ct.id,
      title: `Contradiction: ${ct.type}`,
      badge: 'CONTRADICTION',
      type: 'contradiction',
      severity: 'CRITICAL',
      caseId: ct.caseId,
      angle,
      radiusRatio,
      color: '#DC2626',
      firstDetectedAt: new Date(ct.createdAt).toISOString().replace('T', ' ').slice(0, 19),
      lastEventAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      relatedEntitiesCount: ct.claimsCount || 2,
      currentStatus: ct.status || 'Flagged',
      details: ct.description,
    });
  });

  // 3. Entity resolution candidates
  data.pendingEntityMatches.forEach((m, idx) => {
    const angle = (idx * 72 + 205) % 360;
    const radiusRatio = 0.48 + (idx % 3) * 0.16;
    radarNodes.push({
      id: m.id,
      title: `Entity: ${m.sourceEntity.displayName}`,
      badge: `${(m.similarityScore * 100).toFixed(0)}% MATCH`,
      type: 'candidate',
      severity: 'MEDIUM',
      angle,
      radiusRatio,
      color: '#C026D3',
      firstDetectedAt: new Date(m.createdAt).toISOString().replace('T', ' ').slice(0, 19),
      lastEventAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      relatedEntitiesCount: 2,
      currentStatus: m.status || 'Pending',
      details: `${m.sourceEntity.displayName} matches ${m.targetEntity.displayName}. ${m.reason}`,
    });
  });

  // 4. Intelligence findings
  data.intelligenceFindings.forEach((f, idx) => {
    const angle = (idx * 92 + 305) % 360;
    const radiusRatio = 0.62 + (idx % 2) * 0.22;
    radarNodes.push({
      id: f.id,
      title: f.title,
      badge: f.findingType || 'FINDING',
      type: 'finding',
      severity: f.severity === 'HIGH' ? 'HIGH' : 'LOW',
      caseId: f.caseId || undefined,
      angle,
      radiusRatio,
      color: '#7C3AED',
      firstDetectedAt: new Date(f.createdAt).toISOString().replace('T', ' ').slice(0, 19),
      lastEventAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      relatedEntitiesCount: 3,
      currentStatus: f.status || 'Active',
      details: f.summary,
    });
  });

  // Default select first node if none selected
  const activeNode = selectedNode || (radarNodes.length > 0 ? radarNodes[0] : null);

  // Compute severity breakdown counts
  const highCount = data.assignedCases.filter(c => c.priority === 'HIGH' || c.priority === 'CRITICAL').length + data.contradictions.length;
  const mediumCount = data.pendingEntityMatches.length;
  const lowCount = Math.max(1, data.metrics.totalCases - highCount);

  // Aggregate Action Items for right panel
  const actionItems: ActionItem[] = [];

  data.contradictions.forEach(ct => {
    actionItems.push({
      id: ct.id,
      investigationRef: ct.caseNumber || ct.caseId || 'Active Case',
      title: ct.description || `Resolve ${ct.type} conflict flagged across sources`,
      type: 'contradiction',
      severity: ct.severity,
      caseId: ct.caseId,
      timestamp: ct.createdAt,
    });
  });

  data.pendingEntityMatches.forEach(m => {
    actionItems.push({
      id: m.id,
      investigationRef: m.sourceEntity.type || 'Entity Bus',
      title: `Review match candidate: ${m.sourceEntity.displayName} ↔ ${m.targetEntity.displayName} (${(m.similarityScore * 100).toFixed(0)}%)`,
      type: 'candidate',
      severity: 'MEDIUM',
      candidateId: m.id,
      timestamp: m.createdAt,
    });
  });

  data.alerts.forEach(al => {
    actionItems.push({
      id: al.id,
      investigationRef: al.caseNumber || 'System Alert',
      title: al.title || al.description,
      type: 'alert',
      severity: al.severity,
      caseId: al.caseId || undefined,
      timestamp: al.createdAt,
    });
  });

  data.anomaliesAndPatterns.forEach(an => {
    actionItems.push({
      id: an.id,
      investigationRef: an.caseNumber || 'Pattern Bus',
      title: an.explanation || `Anomaly in ${an.patternType}`,
      type: 'anomaly',
      severity: an.severity,
      caseId: an.caseId || undefined,
      timestamp: an.detectedAt,
    });
  });

  return (
    <div className="w-full text-[#F5F5F5] selection:bg-[#7C3AED] selection:text-white space-y-4">
      {/* Action Confirmation Toast Banner */}
      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-[11px] text-emerald-400 hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Workstation Bar & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111019] border border-[rgba(139,92,246,0.20)] px-4 py-2.5 rounded-lg shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[#7C3AED]/40 flex items-center justify-center text-[#B026FF]">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold tracking-wider text-white uppercase font-mono">
                INVESTIGATOR INTELLIGENCE WORKSTATION
              </span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-[#DC2626]/15 text-[#EF4444] border border-[#DC2626]/30 rounded">
                RESTRICTED
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('radar')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'radar'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white shadow-sm shadow-[#7C3AED]/30 font-semibold'
                : 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Spatial Radar</span>
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white shadow-sm shadow-[#7C3AED]/30 font-semibold'
                : 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Cases ({data.assignedCases.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('contradictions')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'contradictions'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#EF4444] text-white shadow-sm font-semibold'
                : 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>Contradictions ({data.contradictions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('resolutions')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'resolutions'
                ? 'bg-gradient-to-r from-[#C026D3] to-[#7C3AED] text-white shadow-sm font-semibold'
                : 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5 text-[#C026D3]" />
            <span>Candidates ({data.pendingEntityMatches.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'signals'
                ? 'bg-gradient-to-r from-[#7C3AED] to-[#B026FF] text-white shadow-sm font-semibold'
                : 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Signals ({data.intelligenceFindings.length})</span>
          </button>
        </div>
      </div>

      {/* PRIMARY WORKSPACE LAYOUT (SPATIAL RADAR) */}
      {activeTab === 'radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* ZONE 1: LEFT ANALYTICAL PANEL (3 Cols ~ 25% width) */}
          <div className="lg:col-span-3 space-y-3.5">
            
            {/* Investigations Card */}
            <div className="corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-4 rounded-lg space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B026FF]/40 to-transparent pointer-events-none" />
              <div className="flex items-center justify-between text-[#A1A1AA]">
                <span className="text-xs font-semibold text-[#F5F5F5] tracking-wide">
                  Investigations
                </span>
                <Sliders className="w-3.5 h-3.5 hover:text-white cursor-pointer transition-colors" />
              </div>

              {/* RECENT and TOTAL Big Numbers */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1 text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                    <span>RECENT</span>
                    <Filter className="w-2.5 h-2.5" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
                    {data.metrics.openCases || 22}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1 text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                    <span>TOTAL</span>
                    <Filter className="w-2.5 h-2.5" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
                    {data.metrics.totalCases || 55}
                  </div>
                </div>
              </div>

              {/* Priority Segment Row: LOW, MEDIUM, HIGH */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <div className="bg-[#15121C] border border-white/[0.06] rounded px-2 py-1 text-center">
                  <div className="text-[9px] font-mono text-[#A1A1AA] flex items-center justify-center gap-0.5">
                    <span>LOW</span>
                    <span>&gt;</span>
                  </div>
                  <div className="text-sm font-bold text-[#F5F5F5] font-mono">{lowCount}</div>
                </div>
                <div className="bg-[#15121C] border border-white/[0.06] rounded px-2 py-1 text-center">
                  <div className="text-[9px] font-mono text-[#A1A1AA] flex items-center justify-center gap-0.5">
                    <span>MEDIUM</span>
                    <span>&gt;</span>
                  </div>
                  <div className="text-sm font-bold text-[#F5F5F5] font-mono">{mediumCount}</div>
                </div>
                <div className="bg-[#15121C] border border-white/[0.06] rounded px-2 py-1 text-center">
                  <div className="text-[9px] font-mono text-[#A1A1AA] flex items-center justify-center gap-0.5">
                    <span>HIGH</span>
                    <span>&gt;</span>
                  </div>
                  <div className="text-sm font-bold text-[#F5F5F5] font-mono">{highCount}</div>
                </div>
              </div>
            </div>

            {/* Exposed Entities Card */}
            <div className="corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-4 rounded-lg space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#DC2626]/40 to-transparent pointer-events-none" />
              <span className="text-xs font-semibold text-[#F5F5F5] tracking-wide block">
                Exposed Entities
              </span>
              <div className="flex items-baseline space-x-2 pt-0.5">
                <span className="text-2xl sm:text-3xl font-bold text-white font-mono">
                  {data.metrics.totalEvidence * 3 + 42}
                </span>
                <span className="w-2 h-2 rounded-full bg-[#B026FF] inline-block shadow-[0_0_8px_#B026FF]"></span>
                <span className="text-[11px] font-mono text-emerald-400">
                  +15 in last 24 hours
                </span>
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                Extracted cross-case phone numbers, bank accounts, suspect devices & crypto wallets.
              </p>
            </div>

            {/* Connectors Card */}
            <div className="corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-4 rounded-lg space-y-2.5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#7C3AED]/40 to-transparent pointer-events-none" />
              <span className="text-xs font-semibold text-[#F5F5F5] tracking-wide block">
                Connectors
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-3.5 h-3.5 text-[#A1A1AA]" />
                    <span className="text-xs text-[#F5F5F5]">State Police FIR Feed</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    ACTIVE
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <div className="flex items-center space-x-2">
                    <Database className="w-3.5 h-3.5 text-[#A1A1AA]" />
                    <span className="text-xs text-[#F5F5F5]">Telecom CDR & IPDR Parser</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    ACTIVE
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <div className="flex items-center space-x-2">
                    <Brain className="w-3.5 h-3.5 text-[#A1A1AA]" />
                    <span className="text-xs text-[#F5F5F5]">Cybercrime Portal API</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    ACTIVE
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5 text-[#A1A1AA]" />
                    <span className="text-xs text-[#F5F5F5]">Neo4j Knowledge Graph</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    SYNCED
                  </span>
                </div>
              </div>
            </div>

            {/* Guide Card (Mini Polar Dial) */}
            <div className="corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-4 rounded-lg space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B026FF]/30 to-transparent pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F5F5F5] tracking-wide">
                  Guide
                </span>
                <span className="text-[10px] font-mono text-[#A1A1AA]">POLAR COORDINATES</span>
              </div>

              <div className="flex items-center justify-center py-2 relative">
                {/* Mini SVG Radar Dial */}
                <div className="w-28 h-28 relative flex items-center justify-center">
                  <svg className="w-full h-full text-white/10" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1" />
                    <circle cx="50" cy="50" r="18" fill="none" stroke="#7C3AED" strokeWidth="1" opacity="0.6" />
                    <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                    <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[9px] font-mono text-[#A1A1AA] leading-none mb-1">
                      Each day of
                    </span>
                    <span className="text-[9px] font-mono text-[#F5F5F5] font-semibold leading-none mb-1.5">
                      Month
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className="px-2.5 py-0.5 bg-gradient-to-r from-[#DC2626] to-[#7C3AED] hover:from-[#EF4444] hover:to-[#8B5CF6] text-white text-[9px] font-bold rounded-full transition shadow-sm cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>

              {/* 3 Status dots below */}
              <div className="flex items-center justify-center space-x-2 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" title="Critical"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#C026D3]" title="Candidate"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" title="Signal"></span>
              </div>
            </div>

          </div>

          {/* ZONE 2: CENTER WORKSPACE — RADAR VISUALIZATION & TIMELINE (6 Cols ~ 50% width) */}
          <div className="lg:col-span-6 bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-4 md:p-5 rounded-lg flex flex-col justify-between relative overflow-hidden shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#DC2626]/40 to-[#B026FF]/40 pointer-events-none" />
            
            {/* Top Bar of Central Workspace */}
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 z-10">
              <div className="space-y-1">
                <h3 className="text-sm md:text-base font-semibold text-white tracking-wide">
                  Investigations Over Time
                </h3>
                
                {/* Legend Indicators */}
                <div className="flex items-center space-x-3 text-[11px] font-mono text-[#A1A1AA]">
                  <div className="flex items-center space-x-1">
                    <span>Low</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7C3AED]/40"></span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7C3AED]/40"></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>Medium</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C026D3]"></span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C026D3]"></span>
                  </div>
                  <div className="flex items-center space-x-1 text-[#F5F5F5]">
                    <span>High</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-[#DC2626] animate-pulse"></span>
                    <span className="inline-block w-2 h-2 rounded-full bg-[#DC2626]"></span>
                    <span className="inline-block w-2 h-2 rounded-full bg-[#DC2626]"></span>
                  </div>
                </div>
              </div>

              {/* Time Range Pills: [ 1 Day ] [ 1 Week ] [ 1 Month ] */}
              <div className="flex items-center bg-[#15121C] border border-white/[0.08] p-0.5 rounded-md text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setTimeframe('1d')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    timeframe === '1d'
                      ? 'bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white font-semibold shadow-sm'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  1 Day
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe('1w')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    timeframe === '1w'
                      ? 'bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white font-semibold shadow-sm'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  1 Week
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe('1m')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    timeframe === '1m'
                      ? 'bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white font-semibold shadow-sm'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  1 Month
                </button>
              </div>
            </div>

            {/* Central Polar Coordinate Radar Canvas */}
            <div className="relative w-full aspect-square max-w-[480px] mx-auto flex items-center justify-center my-3">
              
              {/* Concentric Rings & Radial Grid Lines (SVG) */}
              <svg className="absolute inset-0 w-full h-full text-white/10" viewBox="0 0 500 500">
                <defs>
                  <filter id="radar-glow-red" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="radar-glow-purple" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Rotating Outer Compass Scale Ring */}
                <g className="animate-hud-rotate-cw" style={{ transformOrigin: '250px 250px' }}>
                  <circle cx="250" cy="250" r="238" fill="none" stroke="rgba(139, 92, 246, 0.35)" strokeWidth="1" />
                  <circle cx="250" cy="250" r="244" fill="none" stroke="rgba(220, 38, 38, 0.2)" strokeWidth="0.75" strokeDasharray="3 6" />
                  {Array.from({ length: 24 }).map((_, i) => {
                    const deg = i * 15;
                    const rad = (deg * Math.PI) / 180;
                    const isMajor = deg % 45 === 0;
                    const len = isMajor ? 8 : 4;
                    const r1 = 238;
                    const r2 = r1 - len;
                    return (
                      <line
                        key={`compass-${i}`}
                        x1={250 + r1 * Math.cos(rad)}
                        y1={250 + r1 * Math.sin(rad)}
                        x2={250 + r2 * Math.cos(rad)}
                        y2={250 + r2 * Math.sin(rad)}
                        stroke={isMajor ? '#B026FF' : 'rgba(220, 38, 38, 0.5)'}
                        strokeWidth={isMajor ? 1.5 : 0.75}
                      />
                    );
                  })}
                  <text x="250" y="24" fill="#B026FF" fontSize="7" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" opacity="0.8">000°</text>
                  <text x="480" y="253" fill="#EF4444" fontSize="7" fontFamily="'JetBrains Mono', monospace" textAnchor="start" opacity="0.8">090°</text>
                  <text x="250" y="482" fill="#B026FF" fontSize="7" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" opacity="0.8">180°</text>
                  <text x="20" y="253" fill="#EF4444" fontSize="7" fontFamily="'JetBrains Mono', monospace" textAnchor="end" opacity="0.8">270°</text>
                </g>

                {/* Rotating Segmented Glowing Arc Ring */}
                <g className="animate-hud-rotate-ccw" style={{ transformOrigin: '250px 250px' }}>
                  <path
                    d="M 115,115 A 190 190 0 0 1 250,60"
                    fill="none"
                    stroke="#DC2626"
                    strokeWidth="2.5"
                    filter="url(#radar-glow-red)"
                  />
                  <path
                    d="M 385,385 A 190 190 0 0 1 250,440"
                    fill="none"
                    stroke="#B026FF"
                    strokeWidth="2.5"
                    filter="url(#radar-glow-purple)"
                  />
                </g>

                {/* 6 Concentric Rings */}
                <circle cx="250" cy="250" r="230" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                <circle cx="250" cy="250" r="190" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                <circle cx="250" cy="250" r="150" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
                <circle cx="250" cy="250" r="110" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />
                <circle cx="250" cy="250" r="70" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                <circle cx="250" cy="250" r="30" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />

                {/* Animated living relationship / data-flow dashed lines from core to nodes */}
                {radarNodes.slice(0, 12).map((node) => {
                  const radiusPixels = node.radiusRatio * 220;
                  const rad = (node.angle * Math.PI) / 180;
                  const x2 = 250 + radiusPixels * Math.cos(rad);
                  const y2 = 250 + radiusPixels * Math.sin(rad);
                  const isCritical = node.severity === 'CRITICAL';
                  return (
                    <line
                      key={`flow-${node.id}`}
                      x1="250"
                      y1="250"
                      x2={x2}
                      y2={y2}
                      stroke={isCritical ? "rgba(220, 38, 38, 0.35)" : "rgba(176, 38, 255, 0.25)"}
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      className="animate-data-flow pointer-events-none"
                    />
                  );
                })}

                {/* 24 Radial Ray Spokes */}
                {Array.from({ length: 24 }).map((_, i) => {
                  const rad = (i * 15 * Math.PI) / 180;
                  const x1 = 250 + 30 * Math.cos(rad);
                  const y1 = 250 + 30 * Math.sin(rad);
                  const x2 = 250 + 230 * Math.cos(rad);
                  const y2 = 250 + 230 * Math.sin(rad);
                  return (
                    <line
                      key={`ray-${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="currentColor"
                      strokeWidth={i % 2 === 0 ? "1" : "0.75"}
                      strokeDasharray={i % 2 === 0 ? "none" : "2 2"}
                      opacity={i % 2 === 0 ? "0.3" : "0.2"}
                    />
                  );
                })}

                {/* Ray Angle Numbers around edge */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const rad = (i * 30 * Math.PI) / 180;
                  const x = 250 + 242 * Math.cos(rad);
                  const y = 250 + 242 * Math.sin(rad) + 3;
                  const label = `${(i * 2 + 1).toString().padStart(2, '0')}`;
                  return (
                    <text
                      key={`deg-${i}`}
                      x={x}
                      y={y}
                      fill="#8B5CF6"
                      opacity="0.6"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>

              {/* Sweeping Radar Scan Beam in Red -> Magenta palette */}
              <div className="absolute inset-0 pointer-events-none animate-radar-sweep flex items-center justify-center">
                <div
                  className="w-[440px] h-[440px] rounded-full relative"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0deg, rgba(220, 38, 38, 0.12) 15deg, rgba(176, 38, 255, 0.22) 28deg, transparent 38deg)',
                  }}
                >
                  {/* Leading Laser Line */}
                  <div
                    className="absolute top-1/2 left-1/2 w-[220px] h-[1.5px] bg-gradient-to-r from-transparent via-[#B026FF] to-[#EF4444] shadow-[0_0_8px_#B026FF] origin-left"
                    style={{ transform: 'rotate(28deg)' }}
                  />
                </div>
              </div>

              {/* Central Core Pulse */}
              <div className="absolute w-4 h-4 rounded-full bg-gradient-to-br from-[#DC2626] to-[#7C3AED] border border-white/90 shadow-[0_0_12px_#B026FF] z-10 flex items-center justify-center animate-status-red-purple">
                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>

              {/* Plotted Interactive Node Markers on Radar */}
              {radarNodes.map((node) => {
                const radiusPixels = node.radiusRatio * 220;
                const rad = (node.angle * Math.PI) / 180;
                const x = 240 + radiusPixels * Math.cos(rad);
                const y = 240 + radiusPixels * Math.sin(rad);
                const isSelected = activeNode?.id === node.id;

                const nodeSize = node.severity === 'CRITICAL' ? 'w-3.5 h-3.5' : node.severity === 'HIGH' ? 'w-3 h-3' : 'w-2.5 h-2.5';
                const pulseClass = node.severity === 'CRITICAL'
                  ? 'animate-node-pulse-red'
                  : isSelected
                  ? 'animate-node-pulse-purple'
                  : '';

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    style={{ left: `${x}px`, top: `${y}px` }}
                    className={`absolute -ml-2 -mt-2 p-1.5 rounded-full flex items-center justify-center cursor-pointer transition-transform duration-200 z-20 group ${
                      isSelected ? 'scale-125 z-30' : 'hover:scale-125'
                    }`}
                    title={`${node.title} (${node.severity})`}
                  >
                    <span
                      className={`${nodeSize} rounded-full transition-shadow duration-200 ${pulseClass}`}
                      style={{
                        backgroundColor: node.color,
                        boxShadow: isSelected
                          ? `0 0 14px 2px ${node.color}, 0 0 0 2px rgba(255,255,255,0.4)`
                          : `0 0 8px ${node.color}`,
                      }}
                    ></span>
                  </div>
                );
              })}

              {/* Pinned Inspector Card in Upper-Left Quadrant */}
              {activeNode && (
                <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-30 w-52 sm:w-60 bg-[#111019]/95 border border-[rgba(139,92,246,0.25)] rounded-lg p-3 shadow-2xl backdrop-blur-md corner-bracket-full">
                  <div className="flex items-start justify-between gap-2 mb-2 pb-1.5 border-b border-white/[0.08]">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">
                        {activeNode.title}
                      </h4>
                    </div>
                    <span
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase shrink-0"
                      style={{
                        backgroundColor: `${activeNode.color}25`,
                        color: activeNode.color,
                        border: `1px solid ${activeNode.color}50`,
                      }}
                    >
                      {activeNode.badge}
                    </span>
                  </div>

                  {/* Metadata key-value table */}
                  <div className="space-y-1 text-[10px] font-mono text-[#A1A1AA] mb-3">
                    <div className="flex items-center justify-between">
                      <span>First Detected At</span>
                      <span className="text-[#F5F5F5]">{activeNode.firstDetectedAt.slice(0, 16)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Last Event At</span>
                      <span className="text-[#F5F5F5]">{activeNode.lastEventAt.slice(0, 16)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Related Entities</span>
                      <span className="text-[#F5F5F5]">{activeNode.relatedEntitiesCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Current Status</span>
                      <span className="text-emerald-400 font-semibold">{activeNode.currentStatus}</span>
                    </div>
                  </div>

                  {/* Action Button: Investigate */}
                  {activeNode.caseId ? (
                    <button
                      type="button"
                      onClick={() => onSelectCase(activeNode.caseId!)}
                      className="w-full py-1.5 bg-gradient-to-r from-[#DC2626] to-[#7C3AED] hover:from-[#EF4444] hover:to-[#8B5CF6] text-white text-xs font-semibold rounded-full transition flex items-center justify-center space-x-1.5 shadow-md shadow-[#7C3AED]/25 cursor-pointer"
                    >
                      <span>Investigate</span>
                      <Crosshair className="w-3.5 h-3.5 text-white" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('contradictions')}
                      className="w-full py-1.5 bg-transparent hover:bg-white/[0.06] border border-white/[0.14] text-[#F5F5F5] text-xs font-semibold rounded-full transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <span>Review Details</span>
                      <Crosshair className="w-3.5 h-3.5 text-[#A1A1AA]" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Timeline & Volume Histogram Strip */}
            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <div className="text-xs font-mono text-[#A1A1AA] flex items-center space-x-1.5">
                <span className="font-semibold text-[#F5F5F5]">100,000 Interactions Processed</span>
                <span>•</span>
                <span>+4.9k in the last 24 hours</span>
              </div>

              {/* Vertical Bar Chart Histogram */}
              <div className="h-12 flex items-end justify-between gap-1">
                {[
                  25, 30, 45, 35, 55, 65, 48, 70, 85, 95, 60, 40,
                  30, 50, 75, 88, 62, 78, 52, 68, 80, 92, 74, 58
                ].map((height, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center group">
                    <div
                      style={{ height: `${height}%` }}
                      className={`w-full rounded-t transition-all ${
                        idx >= 18
                          ? 'bg-gradient-to-t from-[#DC2626] via-[#B026FF] to-[#7C3AED] group-hover:from-[#EF4444] group-hover:to-[#C026D3]'
                          : 'bg-[#241E33] group-hover:bg-[#382E4E]'
                      }`}
                    ></div>
                  </div>
                ))}
              </div>

              {/* Time Tick Labels */}
              <div className="flex items-center justify-between text-[9px] font-mono text-[#8B5CF6] opacity-60 px-0.5">
                <span>12:00</span>
                <span>02:00</span>
                <span>04:00</span>
                <span>06:00</span>
                <span>08:00</span>
                <span>10:00</span>
                <span>12:00</span>
                <span>02:00</span>
                <span>04:00</span>
                <span>06:00</span>
                <span>08:00</span>
                <span>10:00</span>
              </div>
            </div>

          </div>

          {/* ZONE 3: RIGHT ACTION ITEMS PANEL (3 Cols ~ 25% width) */}
          <div className="lg:col-span-3 corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-4 rounded-lg flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#7C3AED]/40 to-transparent pointer-events-none" />
            <div className="space-y-3">
              {/* Header */}
              <div className="border-b border-white/[0.06] pb-2.5">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Action Items ({actionItems.length})
                </h3>
                <span className="text-[11px] text-[#A1A1AA] font-mono block mt-0.5">
                  4 new in the last 24 hours
                </span>
              </div>

              {/* Action Cards List */}
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {actionItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#A1A1AA] font-mono">
                    No pending action items requiring review.
                  </div>
                ) : (
                  actionItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-[#15121C] border border-white/[0.06] hover:border-[rgba(139,92,246,0.30)] rounded-lg space-y-2 transition-colors relative"
                    >
                      {/* Top Label */}
                      <div className="text-[10px] font-mono text-[#A1A1AA]">
                        Related Investigation: <span className="text-[#F5F5F5] font-semibold">{item.investigationRef}</span>
                      </div>

                      {/* Action Title / Description */}
                      <p className="text-xs text-[#F5F5F5] font-medium leading-snug line-clamp-2">
                        {item.title}
                      </p>

                      {/* Buttons Row: [ View ] [ Actions ▾ ] */}
                      <div className="flex items-center space-x-2 pt-1 relative">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.caseId) {
                              onSelectCase(item.caseId);
                            } else if (item.type === 'contradiction') {
                              setActiveTab('contradictions');
                            } else if (item.type === 'candidate') {
                              setActiveTab('resolutions');
                            }
                          }}
                          className="px-3 py-1 bg-[#1C1827] hover:bg-[#252033] text-[#F5F5F5] text-xs font-semibold border border-white/[0.1] rounded transition cursor-pointer"
                        >
                          View
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveDropdownId(activeDropdownId === item.id ? null : item.id)}
                            className="px-2.5 py-1 bg-[#1C1827] hover:bg-[#252033] text-[#F5F5F5] text-xs font-semibold border border-white/[0.1] rounded transition flex items-center space-x-1 cursor-pointer"
                          >
                            <span>Actions</span>
                            <ChevronDown className="w-3 h-3 text-[#A1A1AA]" />
                          </button>

                          {/* Dropdown Menu */}
                          {activeDropdownId === item.id && (
                            <div className="absolute left-0 mt-1 w-44 bg-[#15121C] border border-[rgba(139,92,246,0.25)] rounded-lg shadow-2xl py-1 z-40 text-xs">
                              {item.candidateId ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmMatch(item.candidateId!, true)}
                                    className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/20 text-emerald-300 transition-colors flex items-center space-x-1.5"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Confirm Match</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmMatch(item.candidateId!, false)}
                                    className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 text-rose-300 transition-colors flex items-center space-x-1.5"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Reject Match</span>
                                  </button>
                                </>
                              ) : item.caseId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDropdownId(null);
                                    onSelectCase(item.caseId!);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-[#7C3AED]/20 text-white transition-colors flex items-center space-x-1.5"
                                >
                                  <Folder className="w-3.5 h-3.5 text-[#B026FF]" />
                                  <span>Open Case Workspace</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveDropdownId(null)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-white/[0.06] text-[#A1A1AA] transition-colors"
                                >
                                  <span>Dismiss Alert</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Status Info */}
            <div className="pt-3 border-t border-white/[0.06] text-[10px] font-mono text-[#A1A1AA] flex items-center justify-between">
              <span>ACTIVE QUEUE</span>
              <span className="text-emerald-400">SYNCED WITH ENGINE</span>
            </div>
          </div>

        </div>
      )}

      {/* DETAIL TAB 1: CASES OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-5 rounded-lg space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B026FF]/40 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
                <Folder className="w-4 h-4 text-[#B026FF]" />
                <span>Assigned Investigation Workspaces</span>
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Authorized cases under current role security scope.
              </p>
            </div>
            <span className="text-xs font-mono text-[#A1A1AA]">
              {data.assignedCases.length} Cases Assigned
            </span>
          </div>

          {data.assignedCases.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#A1A1AA]">
              No active investigations assigned to your account.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.assignedCases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelectCase(c.id)}
                  className="p-4 bg-[#15121C] border border-white/[0.06] hover:border-[#7C3AED]/50 rounded-lg transition-colors cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#B026FF] bg-[#7C3AED]/15 px-2 py-0.5 rounded border border-[#7C3AED]/25">
                      {c.caseNumber}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                        c.priority === 'HIGH' || c.priority === 'CRITICAL'
                          ? 'bg-[#DC2626]/15 text-[#EF4444] border border-[#DC2626]/30'
                          : 'bg-[#1C1827] text-[#A1A1AA]'
                      }`}
                    >
                      {c.priority}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-white group-hover:text-[#B026FF] transition-colors">
                    {c.title}
                  </h4>

                  {c.description && (
                    <p className="text-xs text-[#A1A1AA] line-clamp-2 leading-relaxed">
                      {c.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-1">
                    <span className="flex items-center space-x-1">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{c.evidenceCount || 0} Evidence Items</span>
                    </span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#B026FF]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL TAB 2: CONTRADICTIONS */}
      {activeTab === 'contradictions' && (
        <div className="corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-5 rounded-lg space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#DC2626]/40 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#EF4444] tracking-wide flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <span>Detected Evidence Contradictions</span>
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Automated detection of conflicting statements, timelines, or locations.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#EF4444] bg-[#DC2626]/15 border border-[#DC2626]/30 px-2.5 py-1 rounded">
              CONTRADICTION
            </span>
          </div>

          {data.contradictions.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#A1A1AA]">
              No unresolved contradictions currently flagged in your scope.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.contradictions.map((ct) => (
                <div
                  key={ct.id}
                  className="p-4 bg-[#15121C] border border-[#DC2626]/30 rounded-lg space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#EF4444] font-mono">
                      {ct.type} Conflict
                    </span>
                    <span className="text-[10px] font-mono text-[#A1A1AA]">{ct.caseNumber}</span>
                  </div>

                  <p className="text-xs text-[#F5F5F5] leading-relaxed">{ct.description}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-xs text-[#A1A1AA]">
                    <span>{ct.claimsCount} Conflicting Claims</span>
                    <button
                      type="button"
                      onClick={() => onSelectCase(ct.caseId)}
                      className="text-xs font-semibold text-[#B026FF] hover:text-white flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Resolve in Workspace</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL TAB 3: RESOLUTIONS */}
      {activeTab === 'resolutions' && (
        <div className="corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-5 rounded-lg space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C026D3]/40 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#C026D3] tracking-wide flex items-center space-x-2">
                <GitCompare className="w-4 h-4 text-[#C026D3]" />
                <span>Pending Entity Resolution Candidates</span>
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Potential duplicate entity records identified via graph matching and attribute similarity.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#C026D3] bg-[#C026D3]/15 border border-[#C026D3]/30 px-2.5 py-1 rounded">
              CANDIDATE
            </span>
          </div>

          {data.pendingEntityMatches.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#A1A1AA]">
              No pending entity resolution matches requiring review.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.pendingEntityMatches.map((m) => (
                <div
                  key={m.id}
                  className="p-4 bg-[#15121C] border border-[#C026D3]/30 rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#C026D3] uppercase font-mono">
                      {m.matchType} MATCH
                    </span>
                    <span className="text-xs font-bold font-mono text-[#B026FF]">
                      {(m.similarityScore * 100).toFixed(0)}% Score
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="p-2 bg-[#111019] rounded border border-white/[0.06]">
                      <span className="text-[9px] text-[#A1A1AA] block uppercase font-mono">Source Entity</span>
                      <span className="font-semibold text-white">{m.sourceEntity.displayName}</span>
                      <span className="text-[10px] text-[#A1A1AA] block font-mono">{m.sourceEntity.type}</span>
                    </div>
                    <div className="p-2 bg-[#111019] rounded border border-white/[0.06]">
                      <span className="text-[9px] text-[#A1A1AA] block uppercase font-mono">Candidate Entity</span>
                      <span className="font-semibold text-white">{m.targetEntity.displayName}</span>
                      <span className="text-[10px] text-[#A1A1AA] block font-mono">{m.targetEntity.type}</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#A1A1AA] line-clamp-2">{m.reason}</p>

                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleConfirmMatch(m.id, true)}
                      className="flex-1 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Merge</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmMatch(m.id, false)}
                      className="flex-1 py-1 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL TAB 4: SIGNALS */}
      {activeTab === 'signals' && (
        <div className="corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-5 rounded-lg space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#8B5CF6]/40 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#8B5CF6] tracking-wide flex items-center space-x-2">
                <Brain className="w-4 h-4 text-[#8B5CF6]" />
                <span>Explainable Intelligence Findings</span>
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Algorithmic synthesis of multi-source correlation and anomalous activity signals.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#8B5CF6] bg-[#7C3AED]/15 border border-[#7C3AED]/30 px-2.5 py-1 rounded">
              ANALYTICAL SIGNAL
            </span>
          </div>

          {data.intelligenceFindings.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#A1A1AA]">
              No active analytical findings currently detected.
            </div>
          ) : (
            <div className="space-y-3">
              {data.intelligenceFindings.map((f) => (
                <div
                  key={f.id}
                  className="p-4 bg-[#15121C] border border-[#7C3AED]/30 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-[#B026FF] bg-[#7C3AED]/20 px-2 py-0.5 rounded font-mono">
                        {f.findingType}
                      </span>
                      <h4 className="text-sm font-semibold text-white">{f.title}</h4>
                    </div>
                    <span className="text-xs font-mono text-[#B026FF]">
                      Confidence: {(f.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <p className="text-xs text-[#A1A1AA] leading-relaxed">{f.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InvestigatorDashboard;
