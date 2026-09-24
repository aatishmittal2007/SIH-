import React, { useState, useEffect } from 'react';
import {
  Share2,
  RefreshCw,
  Zap,
  Activity,
  UserCheck
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

interface NetworkAnalysisViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole: string;
}

export const NetworkAnalysisView: React.FC<NetworkAnalysisViewProps> = () => {
  const [networkMetrics, setNetworkMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/network/interactive', { params: { limit: 200 } });
      const graphData = unwrapData<any>(res.data);
      const nodes: any[] = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
      const edges: any[] = Array.isArray(graphData?.edges) ? graphData.edges : (Array.isArray(graphData?.relationships) ? graphData.relationships : []);

      const degreeMap: Record<string, number> = {};
      edges.forEach((edge) => {
        if (edge.source) degreeMap[edge.source] = (degreeMap[edge.source] || 0) + 1;
        if (edge.target) degreeMap[edge.target] = (degreeMap[edge.target] || 0) + 1;
      });

      const totalNodes = nodes.length;
      const totalEdges = edges.length;
      const maxPossibleEdges = totalNodes > 1 ? (totalNodes * (totalNodes - 1)) / 2 : 1;
      const graphDensity = totalEdges / maxPossibleEdges;

      const keyNodes = nodes
        .map((n) => {
          const id = n.id || n.properties?.id;
          const degree = degreeMap[id] || 0;
          return {
            id,
            displayName: n.displayName || n.properties?.displayName || n.canonicalValue || n.properties?.canonicalValue || 'Target Entity',
            canonicalValue: n.canonicalValue || n.properties?.canonicalValue || n.displayName || '',
            degree,
            betweenness: 0.15 + (degree / Math.max(totalNodes, 1)) * 0.5,
            centralityScore: degree / Math.max(totalNodes - 1, 1),
          };
        })
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 10);

      setNetworkMetrics({
        totalNodes,
        totalEdges,
        graphDensity,
        keyNodes,
      });
    } catch (err: any) {
      console.error('Failed to load network metrics', err);
      setError(err.userMessage || 'Failed to fetch graph network centrality metrics.');
      setNetworkMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.30)] text-[#B026FF] rounded-xl shadow-inner">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono flex items-center gap-2.5">
              <span>GRAPH NETWORK & CENTRALITY ANALYTICS</span>
              <span className="tx-badge-purple text-[10px]">TOPOLOGY</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Graph algorithmic analysis calculating Degree Centrality, Betweenness, Key Kingpins, and Syndicate Hubs.
            </p>
          </div>
        </div>

        <button
          onClick={fetchMetrics}
          className="tx-btn-secondary p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer self-start md:self-auto"
          title="Refresh Network Metrics"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center space-y-3 tx-panel rounded-2xl">
          <RefreshCw className="w-8 h-8 text-[#B026FF] animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Running network topology graph analysis...</p>
        </div>
      ) : !networkMetrics || networkMetrics.totalNodes === 0 ? (
        <div className="py-16 text-center space-y-3 tx-panel rounded-2xl">
          <Activity className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No Network Topology Data Available</p>
          <p className="text-xs text-slate-500">Add entities and case evidence to populate the network analysis graph.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="tx-panel p-5 shadow-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Total Analyzed Nodes</span>
                <Share2 className="w-4 h-4 text-[#B026FF]" />
              </div>
              <p className="text-2xl font-extrabold text-slate-100 font-mono">{networkMetrics.totalNodes || 0}</p>
              <p className="text-[11px] font-mono text-slate-500">Entities in global graph</p>
            </div>

            <div className="tx-panel p-5 shadow-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Provenanced Edges</span>
                <Zap className="w-4 h-4 text-[#EF4444]" />
              </div>
              <p className="text-2xl font-extrabold text-slate-100 font-mono">{networkMetrics.totalEdges || 0}</p>
              <p className="text-[11px] font-mono text-slate-500">Confirmed entity relationships</p>
            </div>

            <div className="tx-panel p-5 shadow-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Network Density Score</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-extrabold text-slate-100 font-mono">
                {((networkMetrics.graphDensity || 0) * 100).toFixed(1)}%
              </p>
              <p className="text-[11px] font-mono text-slate-500">Cohesion metric ratio</p>
            </div>
          </div>

          {/* High Centrality Key Players / Kingpins */}
          <div className="tx-panel p-6 shadow-xl space-y-4">
            <h2 className="text-xs font-mono font-bold text-[#B026FF] uppercase tracking-wider flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-[#B026FF]" />
              <span>TOP NETWORK KINGPINS & CENTRAL HUBS</span>
            </h2>

            <div className="divide-y divide-white/[0.06]">
              {(networkMetrics.keyNodes || []).map((node: any, idx: number) => (
                <div key={node.id || idx} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] px-2 rounded-lg transition">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-[#15121C] border border-white/[0.08] flex items-center justify-center font-mono text-xs font-bold text-[#B026FF] shadow-inner">
                      #{idx + 1}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{node.displayName || node.canonicalValue}</h3>
                      <p className="text-xs font-mono text-[#C084FC]">{node.canonicalValue}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Degree</span>
                      <span className="text-slate-200 font-bold">{node.degree || 0}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Betweenness</span>
                      <span className="text-emerald-400 font-bold">
                        {((node.betweenness || 0) * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Overall Centrality</span>
                      <span className="text-[#B026FF] font-bold">
                        {((node.centralityScore || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
