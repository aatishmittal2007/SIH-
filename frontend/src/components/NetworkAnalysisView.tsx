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
      const res = await apiClient.get('/intelligence/network-metrics');
      const data = unwrapData(res);
      setNetworkMetrics(data || res.data || null);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#6D4AFF]/20 border border-[#6D4AFF]/40 text-[#6D4AFF] rounded-xl">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">GRAPH NETWORK & CENTRALITY ANALYTICS</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Graph algorithmic analysis calculating Degree Centrality, Betweenness, Key Kingpins, and Syndicate Hubs.
            </p>
          </div>
        </div>

        <button
          onClick={fetchMetrics}
          className="p-2.5 bg-[#17171f] hover:bg-[#20202b] text-slate-300 border border-[#262633] rounded-xl text-xs font-semibold transition cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <RefreshCw className="w-8 h-8 text-[#6D4AFF] animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Running network topology graph analysis...</p>
        </div>
      ) : !networkMetrics ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <Activity className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No Network Topology Data Available</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#111114] border border-[#1f1f28] rounded-2xl p-5 shadow-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400">Total Analyzed Nodes</span>
                <Share2 className="w-4 h-4 text-[#6D4AFF]" />
              </div>
              <p className="text-2xl font-extrabold text-slate-100">{networkMetrics.totalNodes || 0}</p>
              <p className="text-[11px] font-mono text-slate-500">Entities in global graph</p>
            </div>

            <div className="bg-[#111114] border border-[#1f1f28] rounded-2xl p-5 shadow-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400">Provenanced Edges</span>
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-extrabold text-slate-100">{networkMetrics.totalEdges || 0}</p>
              <p className="text-[11px] font-mono text-slate-500">Confirmed entity relationships</p>
            </div>

            <div className="bg-[#111114] border border-[#1f1f28] rounded-2xl p-5 shadow-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400">Network Density Score</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-extrabold text-slate-100">
                {((networkMetrics.graphDensity || 0) * 100).toFixed(1)}%
              </p>
              <p className="text-[11px] font-mono text-slate-500">Cohesion metric ratio</p>
            </div>
          </div>

          {/* High Centrality Key Players / Kingpins */}
          <div className="bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-xs font-mono font-bold text-[#6D4AFF] uppercase tracking-wider flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-[#6D4AFF]" />
              <span>TOP NETWORK KINGPINS & CENTRAL HUBS</span>
            </h2>

            <div className="divide-y divide-[#1f1f28]">
              {(networkMetrics.keyNodes || []).map((node: any, idx: number) => (
                <div key={node.id || idx} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-[#171725] border border-[#262638] flex items-center justify-center font-mono text-xs font-bold text-[#6D4AFF]">
                      #{idx + 1}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{node.displayName || node.canonicalValue}</h3>
                      <p className="text-xs font-mono text-cyan-400">{node.canonicalValue}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Degree</span>
                      <span className="text-slate-200 font-bold">{node.degree || 0}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Betweenness</span>
                      <span className="text-emerald-400 font-bold">
                        {((node.betweenness || 0) * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Overall Centrality</span>
                      <span className="text-[#a38cff] font-bold">
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
