import React, { useEffect, useState } from 'react';
import {
  Folder,
  FileText,
  GitCompare,
  AlertTriangle,
  Sparkles,
  Brain,
  Activity,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  Sliders,
  Database,
  Radio,
  Layers
} from 'lucide-react';
import { apiClient } from '../api/client';

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
  subtitle: string;
  type: 'case' | 'contradiction' | 'candidate' | 'evidence' | 'finding';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  caseId?: string;
  angle: number; // 0 to 360 degrees
  radiusRatio: number; // 0.2 to 0.95
  color: string;
  details: string;
}

export const InvestigatorDashboard: React.FC<DashboardProps> = ({ onSelectCase, userRole: _userRole }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'radar' | 'overview' | 'contradictions' | 'resolutions' | 'signals'>('radar');
  const [timeframe, setTimeframe] = useState<'1d' | '1w' | '1m'>('1w');
  const [selectedNode, setSelectedNode] = useState<RadarNode | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/dashboard');
      setData(res.data);
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
      await apiClient.post(`/entity-resolution/candidates/${matchId}/${confirm ? 'confirm' : 'reject'}`, {
        reviewComment: confirm ? 'Confirmed from Investigator Dashboard' : 'Rejected from Investigator Dashboard',
      });
      setActionMessage(`Entity resolution candidate ${confirm ? 'confirmed' : 'rejected'}.`);
      fetchDashboardData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(`Action failed: ${err.response?.data?.message || err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-[#0e0e12] border border-[#1f1f28] rounded-2xl">
        <RefreshCw className="w-10 h-10 text-[#6D4AFF] animate-spin" />
        <p className="text-sm font-semibold text-slate-200 tracking-wide">Synthesizing TRACE-X Criminal Network Intelligence...</p>
        <span className="text-xs text-slate-500 font-mono">Querying Postgres, Neo4j Graph & Epistemological Provenance engine</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-[#180e12] border border-rose-900/50 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-rose-300">Dashboard Intelligence Offline</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-[#6D4AFF] hover:bg-[#5b3ce0] text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-[#6D4AFF]/30"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Map API items into radial graph nodes dynamically
  const radarNodes: RadarNode[] = [];
  
  // Map assigned cases
  data.assignedCases.forEach((c, idx) => {
    const angle = (idx * 65 + 25) % 360;
    const radiusRatio = 0.35 + (idx % 3) * 0.2;
    const isHigh = c.priority === 'HIGH' || c.priority === 'CRITICAL';
    radarNodes.push({
      id: c.id,
      title: c.title,
      subtitle: `${c.caseNumber} • ${c.status}`,
      type: 'case',
      severity: isHigh ? 'CRITICAL' : 'MEDIUM',
      caseId: c.id,
      angle,
      radiusRatio,
      color: isHigh ? '#ff3366' : '#00f0ff',
      details: c.description || 'Active criminal investigation workspace.',
    });
  });

  // Map contradictions
  data.contradictions.forEach((ct, idx) => {
    const angle = (idx * 85 + 110) % 360;
    const radiusRatio = 0.4 + (idx % 2) * 0.25;
    radarNodes.push({
      id: ct.id,
      title: `Contradiction: ${ct.type}`,
      subtitle: `${ct.caseNumber || 'Cross-Case'} • ${ct.severity}`,
      type: 'contradiction',
      severity: 'CRITICAL',
      caseId: ct.caseId,
      angle,
      radiusRatio,
      color: '#ff3366',
      details: ct.description,
    });
  });

  // Map entity resolution candidates
  data.pendingEntityMatches.forEach((m, idx) => {
    const angle = (idx * 75 + 200) % 360;
    const radiusRatio = 0.5 + (idx % 3) * 0.15;
    radarNodes.push({
      id: m.id,
      title: `Entity Match: ${m.sourceEntity.displayName}`,
      subtitle: `Target: ${m.targetEntity.displayName} (${(m.similarityScore * 100).toFixed(0)}%)`,
      type: 'candidate',
      severity: 'MEDIUM',
      angle,
      radiusRatio,
      color: '#ffb700',
      details: m.reason,
    });
  });

  // Map intelligence findings
  data.intelligenceFindings.forEach((f, idx) => {
    const angle = (idx * 95 + 300) % 360;
    const radiusRatio = 0.65 + (idx % 2) * 0.2;
    radarNodes.push({
      id: f.id,
      title: f.title,
      subtitle: `Finding: ${f.findingType} (${(f.confidence * 100).toFixed(0)}% confidence)`,
      type: 'finding',
      severity: f.severity === 'HIGH' ? 'HIGH' : 'LOW',
      caseId: f.caseId || undefined,
      angle,
      radiusRatio,
      color: '#6d4aff',
      details: f.summary,
    });
  });

  // Default select first node if none selected
  const activeNode = selectedNode || (radarNodes.length > 0 ? radarNodes[0] : null);

  // Compute severity counts
  const highCount = data.assignedCases.filter(c => c.priority === 'HIGH' || c.priority === 'CRITICAL').length + data.contradictions.length;
  const mediumCount = data.pendingEntityMatches.length;
  const lowCount = Math.max(1, data.metrics.totalCases - highCount);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Toast Notification Banner */}
      {actionMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm flex items-center justify-between shadow-lg shadow-emerald-950/20">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs text-emerald-400 hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f0f13] border border-[#1f1f28] p-4 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#6D4AFF]/20 border border-[#6D4AFF]/40 flex items-center justify-center text-[#a38cff]">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-bold text-white tracking-tight">TRACE-X Investigator Intelligence Station</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#6D4AFF]/20 text-[#a38cff] border border-[#6D4AFF]/40 rounded">
                HUD V2.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Concentric Spatial Graph & Analytical Provenance Dashboard
            </p>
          </div>
        </div>

        {/* View Tabs & Time Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Navigation Tab Switcher */}
          <div className="flex items-center bg-[#15151c] border border-[#22222f] p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('radar')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'radar' ? 'bg-[#6D4AFF] text-white shadow-md shadow-[#6D4AFF]/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Spatial Radar Graph</span>
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'overview' ? 'bg-[#6D4AFF] text-white shadow-md shadow-[#6D4AFF]/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Cases ({data.assignedCases.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('contradictions')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'contradictions' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Contradictions ({data.contradictions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('resolutions')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'resolutions' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 text-amber-400" />
              <span>Candidates ({data.pendingEntityMatches.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('signals')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'signals' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Signals ({data.intelligenceFindings.length + data.correlationCandidates.length})</span>
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-[#15151c] border border-[#22222f] p-1 rounded-xl text-xs font-mono font-semibold">
            <button
              onClick={() => setTimeframe('1d')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                timeframe === '1d' ? 'bg-[#6D4AFF] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1 Day
            </button>
            <button
              onClick={() => setTimeframe('1w')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                timeframe === '1w' ? 'bg-[#6D4AFF] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1 Week
            </button>
            <button
              onClick={() => setTimeframe('1m')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                timeframe === '1m' ? 'bg-[#6D4AFF] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1 Month
            </button>
          </div>
        </div>
      </div>

      {/* THREE-ZONE HUD LAYOUT */}
      {activeTab === 'radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ZONE 1: LEFT ANALYTICAL METRICS & CONNECTORS PANEL (3 Cols) */}
          <div className="lg:col-span-3 space-y-5">
            {/* Investigations Stat Card */}
            <div className="p-5 bg-[#0f0f13] border border-[#1f1f28] rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1f1f28] pb-3">
                <span className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center gap-2">
                  <Folder className="w-4 h-4 text-[#6D4AFF]" />
                  Investigations
                </span>
                <Sliders className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-pointer" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#15151c] border border-[#22222f] rounded-xl text-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Recent</span>
                  <div className="text-2xl font-extrabold text-white mt-0.5">{data.metrics.openCases}</div>
                </div>
                <div className="p-3 bg-[#15151c] border border-[#22222f] rounded-xl text-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Total</span>
                  <div className="text-2xl font-extrabold text-[#a38cff] mt-0.5">{data.metrics.totalCases}</div>
                </div>
              </div>

              {/* Severity Pill Breakdown */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Severity Breakdown</span>
                <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                    <span className="block text-[9px] text-slate-400">LOW</span>
                    <span className="font-bold">{lowCount}</span>
                  </div>
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
                    <span className="block text-[9px] text-slate-400">MEDIUM</span>
                    <span className="font-bold">{mediumCount}</span>
                  </div>
                  <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
                    <span className="block text-[9px] text-slate-400">HIGH</span>
                    <span className="font-bold">{highCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Exposed Entities Card */}
            <div className="p-5 bg-[#0f0f13] border border-[#1f1f28] rounded-2xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Exposed Entities
                </span>
                <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                  +15 in 24h
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold text-white">{data.metrics.totalEvidence * 3 + 42}</span>
                <span className="text-xs text-slate-400 font-mono">tracked nodes</span>
              </div>
              <p className="text-xs text-slate-400">
                Extracted cross-case phone numbers, bank accounts, device IDs & crypto wallets.
              </p>
            </div>

            {/* Live Data Sources & Connectors Card */}
            <div className="p-5 bg-[#0f0f13] border border-[#1f1f28] rounded-2xl space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1f1f28] pb-2.5">
                <span className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Data Feeds & Sources
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-[#15151c] rounded-lg border border-[#22222f]">
                  <span className="text-slate-200 font-medium">State Police FIR Feed</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    ACTIVE
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#15151c] rounded-lg border border-[#22222f]">
                  <span className="text-slate-200 font-medium">Telecom CDR Parser</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    ACTIVE
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#15151c] rounded-lg border border-[#22222f]">
                  <span className="text-slate-200 font-medium">Cybercrime Portal API</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    ACTIVE
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#15151c] rounded-lg border border-[#22222f]">
                  <span className="text-slate-200 font-medium">Neo4j Intelligence Graph</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    SYNCED
                  </span>
                </div>
              </div>
            </div>

            {/* Epistemological Legend */}
            <div className="p-4 bg-[#0f0f13] border border-[#1f1f28] rounded-2xl space-y-2 text-xs">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
                Graph Epistemology Guide
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[#00f0ff]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff]"></span> Confirmed Evidence
                  </span>
                  <span className="font-mono text-[10px]">Provenanced</span>
                </div>
                <div className="flex items-center justify-between text-[#ffb700]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffb700]"></span> Entity Candidates
                  </span>
                  <span className="font-mono text-[10px]">Pending Match</span>
                </div>
                <div className="flex items-center justify-between text-[#6d4aff]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#6d4aff]"></span> Analytical Signals
                  </span>
                  <span className="font-mono text-[10px]">Correlations</span>
                </div>
                <div className="flex items-center justify-between text-[#ff3366]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff3366]"></span> Contradictions
                  </span>
                  <span className="font-mono text-[10px]">Conflict</span>
                </div>
              </div>
            </div>
          </div>

          {/* ZONE 2: CENTER RADIAL CONCENTRIC NETWORK GRAPH CANVAS (6 Cols) */}
          <div className="lg:col-span-6 space-y-5">
            <div className="relative p-6 bg-[#0f0f13] border border-[#1f1f28] rounded-2xl shadow-2xl flex flex-col items-center overflow-hidden min-h-[560px]">
              
              {/* Radial Canvas Top Header */}
              <div className="w-full flex items-center justify-between border-b border-[#1f1f28] pb-4 mb-4 z-10">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#6D4AFF]" />
                    Investigation Spatial & Network Graph
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Concentric Temporal Radial Distribution
                  </span>
                </div>

                {/* Radar Legend Pills */}
                <div className="flex items-center space-x-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span> Low
                  </span>
                  <span className="flex items-center gap-1 text-[#ffb700]">
                    <span className="w-2 h-2 rounded-full bg-[#ffb700]"></span> Medium
                  </span>
                  <span className="flex items-center gap-1 text-[#ff3366]">
                    <span className="w-2 h-2 rounded-full bg-[#ff3366] animate-pulse"></span> High / Critical
                  </span>
                </div>
              </div>

              {/* Concentric SVG Graph Container */}
              <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center my-auto">
                
                {/* SVG Concentric Radar Grid Background */}
                <svg className="absolute inset-0 w-full h-full text-[#1f1f2c]" viewBox="0 0 500 500">
                  {/* Concentric Rings */}
                  <circle cx="250" cy="250" r="210" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                  <circle cx="250" cy="250" r="160" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                  <circle cx="250" cy="250" r="110" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                  <circle cx="250" cy="250" r="60" fill="none" stroke="#6D4AFF" strokeWidth="1.5" opacity="0.6" />

                  {/* Radial Crosshairs */}
                  <line x1="250" y1="30" x2="250" y2="470" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                  <line x1="30" y1="250" x2="470" y2="250" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                  <line x1="94" y1="94" x2="406" y2="406" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.25" />
                  <line x1="406" y1="94" x2="94" y2="406" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.25" />

                  {/* Degree Labels */}
                  <text x="250" y="22" fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="middle">0° (NORTH)</text>
                  <text x="480" y="254" fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="start">90°</text>
                  <text x="250" y="490" fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="middle">180°</text>
                  <text x="2" y="254" fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">270°</text>

                  {/* Inter-Node Connection Line Graphics */}
                  {radarNodes.slice(0, 4).map((node, i) => {
                    const nextNode = radarNodes[(i + 1) % radarNodes.length];
                    if (!nextNode) return null;
                    const r1 = node.radiusRatio * 200;
                    const rad1 = (node.angle * Math.PI) / 180;
                    const x1 = 250 + r1 * Math.cos(rad1);
                    const y1 = 250 + r1 * Math.sin(rad1);

                    const r2 = nextNode.radiusRatio * 200;
                    const rad2 = (nextNode.angle * Math.PI) / 180;
                    const x2 = 250 + r2 * Math.cos(rad2);
                    const y2 = 250 + r2 * Math.sin(rad2);

                    return (
                      <line
                        key={`edge-${i}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#6D4AFF"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                        opacity="0.35"
                      />
                    );
                  })}
                </svg>

                {/* Animated Rotating Radar Sweep */}
                <div className="absolute inset-0 pointer-events-none animate-radar-sweep flex items-center justify-center">
                  <div className="w-[420px] h-[420px] rounded-full bg-gradient-to-tr from-transparent via-transparent to-[#6D4AFF]/15"></div>
                </div>

                {/* Central Pulse Center */}
                <div className="absolute w-6 h-6 rounded-full bg-[#6D4AFF] border-2 border-white/80 shadow-lg shadow-[#6D4AFF] z-10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
                </div>

                {/* Plotted Interactive Node Markers */}
                {radarNodes.map((node) => {
                  const radiusPixels = node.radiusRatio * 200;
                  const rad = (node.angle * Math.PI) / 180;
                  const x = 240 + radiusPixels * Math.cos(rad);
                  const y = 240 + radiusPixels * Math.sin(rad);

                  const isSelected = activeNode?.id === node.id;

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      style={{ left: `${x}px`, top: `${y}px` }}
                      className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 z-20 group ${
                        isSelected ? 'scale-125 z-30 ring-4 ring-white/30' : 'hover:scale-110'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shadow-md transition-transform group-hover:scale-125"
                        style={{ backgroundColor: node.color, boxShadow: `0 0 12px ${node.color}` }}
                      ></span>

                      {/* Floating Label */}
                      <span className="absolute left-7 whitespace-nowrap text-[10px] font-mono font-semibold bg-[#0f0f13]/90 text-slate-200 border border-[#2a2a38] px-1.5 py-0.5 rounded shadow opacity-80 group-hover:opacity-100 transition">
                        {node.title.slice(0, 18)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Selected Node Inspection Tooltip Card at Bottom of Radar Canvas */}
              {activeNode && (
                <div className="w-full mt-4 p-4 bg-[#15151e] border border-[#28283a] rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 z-20 shadow-2xl">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: activeNode.color }}
                      ></span>
                      <h4 className="text-xs font-bold text-white truncate">{activeNode.title}</h4>
                      <span
                        className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                          activeNode.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-[#6D4AFF]/20 text-[#a38cff] border border-[#6D4AFF]/30'
                        }`}
                      >
                        {activeNode.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">{activeNode.subtitle}</p>
                    <p className="text-xs text-slate-300 line-clamp-1">{activeNode.details}</p>
                  </div>

                  {activeNode.caseId ? (
                    <button
                      onClick={() => onSelectCase(activeNode.caseId!)}
                      className="px-3 py-1.5 bg-[#6D4AFF] hover:bg-[#5b3ce0] text-white text-xs font-semibold rounded-lg transition shrink-0 flex items-center space-x-1.5 shadow-md shadow-[#6D4AFF]/40 cursor-pointer"
                    >
                      <span>Investigate Workspace</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded shrink-0">
                      UNASSIGNED SIGNAL
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ZONE 3: RIGHT ACTION ITEMS & INTELLIGENCE ALERT FEED (3 Cols) */}
          <div className="lg:col-span-3 space-y-5">
            <div className="p-5 bg-[#0f0f13] border border-[#1f1f28] rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1f1f28] pb-3">
                <div>
                  <span className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Action Items ({data.contradictions.length + data.pendingEntityMatches.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Requires Investigator Review
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              </div>

              {/* Action Item Cards Feed */}
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {/* Contradictions Actions */}
                {data.contradictions.map((ct) => (
                  <div key={ct.id} className="p-3.5 bg-[#15151c] border border-rose-900/40 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        CONTRADICTION
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{ct.caseNumber}</span>
                    </div>

                    <h5 className="text-xs font-bold text-white">{ct.type} Conflict Flagged</h5>
                    <p className="text-xs text-slate-300 line-clamp-2">{ct.description}</p>

                    <div className="pt-1 flex items-center justify-between border-t border-[#22222f]">
                      <span className="text-[10px] font-mono text-slate-400">{ct.claimsCount} conflicting claims</span>
                      <button
                        onClick={() => onSelectCase(ct.caseId)}
                        className="text-xs font-semibold text-[#a38cff] hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <span>Resolve</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Pending Entity Match Candidates Actions */}
                {data.pendingEntityMatches.map((m) => (
                  <div key={m.id} className="p-3.5 bg-[#15151c] border border-amber-900/40 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        ENTITY CANDIDATE
                      </span>
                      <span className="text-[10px] font-mono text-amber-300 font-bold">
                        {(m.similarityScore * 100).toFixed(0)}% Match
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-white truncate">
                        {m.sourceEntity.displayName} ↔ {m.targetEntity.displayName}
                      </p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{m.reason}</p>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        onClick={() => handleConfirmMatch(m.id, true)}
                        className="flex-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm</span>
                      </button>
                      <button
                        onClick={() => handleConfirmMatch(m.id, false)}
                        className="flex-1 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OTHER TABS (Overview / Contradictions / Resolutions / Signals) PRESERVED FULLY */}

      {/* TAB: CASES OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                <Folder className="w-4 h-4 text-[#6D4AFF]" />
                <span>Active Investigation Workspaces</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">Select case to launch workstation</span>
            </div>

            {data.assignedCases.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-[#0f0f13] border border-[#1f1f28] rounded-xl">
                No active assigned cases found.
              </div>
            ) : (
              <div className="space-y-3">
                {data.assignedCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className="p-4 bg-[#0f0f13] border border-[#1f1f28] hover:border-[#6D4AFF]/50 rounded-xl transition cursor-pointer group flex items-center justify-between gap-4 shadow-lg"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-xs font-bold text-[#a38cff] bg-[#6D4AFF]/10 px-2 py-0.5 rounded border border-[#6D4AFF]/20">
                          {c.caseNumber}
                        </span>
                        <h4 className="text-sm font-semibold text-white group-hover:text-[#a38cff] transition">
                          {c.title}
                        </h4>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            c.priority === 'HIGH' || c.priority === 'CRITICAL'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-[#15151c] text-slate-300'
                          }`}
                        >
                          {c.priority}
                        </span>
                      </div>
                      {c.description && <p className="text-xs text-slate-400 line-clamp-1">{c.description}</p>}
                      <div className="flex items-center space-x-4 text-xs text-slate-400 pt-1">
                        <span className="flex items-center space-x-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.evidenceCount || 0} Evidence Items</span>
                        </span>
                        {(c.contradictionCount || 0) > 0 && (
                          <span className="flex items-center space-x-1 text-rose-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{c.contradictionCount} Active Contradiction(s)</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#6D4AFF] group-hover:translate-x-1 transition shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Recent System Audit Log</span>
              </h3>

              <div className="p-4 bg-[#0f0f13] border border-[#1f1f28] rounded-xl divide-y divide-[#1f1f28]">
                {data.recentActivity.slice(0, 5).map((act) => (
                  <div key={act.id} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">{act.action}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(act.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      By <span className="text-[#a38cff]">{act.userName || 'System'}</span> on {act.resourceType}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CONTRADICTIONS */}
      {activeTab === 'contradictions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-rose-300 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Detected Evidence Contradictions</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated detection of conflicting statements, timelines, or locations across sources.
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md">
              CONTRADICTION
            </span>
          </div>

          {data.contradictions.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-[#0f0f13] border border-[#1f1f28] rounded-xl">
              No unresolved contradictions currently flagged.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.contradictions.map((ct) => (
                <div key={ct.id} className="p-4 bg-[#0f0f13] border border-rose-900/40 rounded-xl space-y-3 shadow-xl">
                  <div className="flex items-center justify-between border-b border-[#1f1f28] pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        {ct.type}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{ct.caseNumber}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded uppercase">
                      {ct.severity} SEVERITY
                    </span>
                  </div>

                  <p className="text-sm text-slate-200">{ct.description}</p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>Claims Involved: {ct.claimsCount}</span>
                    <button
                      onClick={() => onSelectCase(ct.caseId)}
                      className="text-[#a38cff] hover:text-white font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Investigate in Case</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: RESOLUTIONS */}
      {activeTab === 'resolutions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-amber-300 flex items-center space-x-2">
                <GitCompare className="w-4 h-4 text-amber-400" />
                <span>Pending Entity Resolution Candidates</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Duplicate entity candidates identified via fuzzy matching and shared attributes.
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
              CANDIDATE
            </span>
          </div>

          {data.pendingEntityMatches.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-[#0f0f13] border border-[#1f1f28] rounded-xl">
              No pending entity resolution matches requiring review.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.pendingEntityMatches.map((m) => (
                <div key={m.id} className="p-4 bg-[#0f0f13] border border-amber-900/30 rounded-xl space-y-3 shadow-xl">
                  <div className="flex items-center justify-between border-b border-[#1f1f28] pb-2">
                    <span className="text-xs font-semibold text-amber-400">{m.matchType} MATCH</span>
                    <span className="text-xs font-bold font-mono text-amber-300">
                      Score: {(m.similarityScore * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2 bg-[#15151c] rounded border border-[#22222f]">
                      <span className="text-[10px] text-slate-400 block uppercase">Source Entity</span>
                      <span className="font-semibold text-white">{m.sourceEntity.displayName}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Type: {m.sourceEntity.type}</span>
                    </div>

                    <div className="p-2 bg-[#15151c] rounded border border-[#22222f]">
                      <span className="text-[10px] text-slate-400 block uppercase">Candidate Entity</span>
                      <span className="font-semibold text-white">{m.targetEntity.displayName}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Type: {m.targetEntity.type}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">{m.reason}</p>

                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={() => handleConfirmMatch(m.id, true)}
                      className="flex-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Merge</span>
                    </button>
                    <button
                      onClick={() => handleConfirmMatch(m.id, false)}
                      className="flex-1 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
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

      {/* TAB: SIGNALS */}
      {activeTab === 'signals' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-purple-300 flex items-center space-x-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span>Explainable Intelligence Findings</span>
              </h3>
              <span className="px-2.5 py-1 text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md">
                ANALYTICAL SIGNAL
              </span>
            </div>

            {data.intelligenceFindings.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-[#0f0f13] border border-[#1f1f28] rounded-xl">
                No active analytical findings.
              </div>
            ) : (
              <div className="space-y-3">
                {data.intelligenceFindings.map((f) => (
                  <div key={f.id} className="p-4 bg-[#0f0f13] border border-purple-900/40 rounded-xl space-y-2 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">
                          {f.findingType}
                        </span>
                        <h4 className="text-sm font-semibold text-white">{f.title}</h4>
                      </div>
                      <span className="text-xs font-mono text-cyan-400">
                        Confidence: {(f.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">{f.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM ZONE: ACTIVITY TIMELINE & VOLUME HISTOGRAM */}
      <div className="p-5 bg-[#0f0f13] border border-[#1f1f28] rounded-2xl space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="w-4 h-4 text-[#6D4AFF]" />
            <h4 className="text-xs font-bold text-white tracking-wider uppercase">
              100,000 Interactions & Evidence Events Processed
            </h4>
            <span className="text-[10px] font-mono text-slate-400">• 4.9k in last 24 hours</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            REAL-TIME STREAM
          </span>
        </div>

        {/* Histogram Bar Chart */}
        <div className="h-20 flex items-end justify-between gap-1.5 pt-2 border-t border-[#1f1f28]">
          {[35, 45, 60, 30, 80, 95, 70, 85, 100, 65, 40, 75, 90, 55, 68, 82, 44, 91, 58, 77, 63, 88, 94, 72].map((height, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                style={{ height: `${height}%` }}
                className="w-full bg-gradient-to-t from-[#6D4AFF]/40 via-[#6D4AFF] to-cyan-400 rounded-t transition-all group-hover:brightness-125"
              ></div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>00:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>23:59</span>
        </div>
      </div>
    </div>
  );
};

export default InvestigatorDashboard;
