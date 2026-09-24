import React, { useState } from 'react';
import {
  Route,
  Search,
  RefreshCw,
  ArrowRight,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

interface PathFinderViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole: string;
}

export const PathFinderView: React.FC<PathFinderViewProps> = () => {
  const [sourceQuery, setSourceQuery] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [pathResult, setPathResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFindPath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceQuery.trim() || !targetQuery.trim()) {
      setError('Please provide both Source Entity and Target Entity identifiers.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `/intelligence/shortest-path?source=${encodeURIComponent(sourceQuery.trim())}&target=${encodeURIComponent(targetQuery.trim())}`
      );
      const rawData: any = unwrapData(res.data);
      if (!rawData) {
        setPathResult(null);
        return;
      }
      const rawNodes = rawData.nodes || rawData.pathNodes || [];
      const nodes = rawNodes.map((n: any) => ({
        id: n.id || n.properties?.id,
        displayName: n.displayName || n.properties?.displayName || n.canonicalValue || n.properties?.canonicalValue || 'Target Entity',
        canonicalValue: n.canonicalValue || n.properties?.canonicalValue || n.displayName || '',
      }));
      const relationships = rawData.relationships || rawData.pathRelationships || [];
      const hops = rawData.hops ?? rawData.hopCount ?? (nodes.length > 0 ? nodes.length - 1 : 0);
      setPathResult({ ...rawData, nodes, relationships, hops });
    } catch (err: any) {
      console.error('Failed to resolve graph path', err);
      setError(err.userMessage || 'No provenanced path discovered between specified target entities.');
      setPathResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.30)] text-[#B026FF] rounded-xl shadow-inner">
            <Route className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono flex items-center gap-2.5">
              <span>SHORT-PATH & SYNDICATE TRAVERSAL</span>
              <span className="tx-badge-purple text-[10px]">NEO4J TRAVERSAL</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Neo4j graph traversal engine tracing shortest evidentiary connections between suspect entities across all cases.
            </p>
          </div>
        </div>
      </div>

      {/* Path Search Form */}
      <form onSubmit={handleFindPath} className="tx-panel p-6 shadow-xl space-y-4">
        <h2 className="text-xs font-mono font-bold text-[#B026FF] uppercase tracking-wider flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#B026FF]" />
          <span>ENTITY PATHFINDER PARAMETERS</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400">Source Entity (Phone, Email, ID, Wallet)</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                placeholder="e.g. +19876543210 or target@domain.com"
                className="tx-input w-full pl-9 pr-4 py-2 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400">Target Entity (Phone, Email, ID, Wallet)</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                placeholder="e.g. 0x71C765... or Target Alias"
                className="tx-input w-full pl-9 pr-4 py-2 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="tx-btn-primary w-full py-3 text-xs font-semibold rounded-xl shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="font-mono">Traversing Neo4j Graph Topology...</span>
            </>
          ) : (
            <>
              <Route className="w-4 h-4" />
              <span className="font-mono">Calculate Shortest Graph Path</span>
            </>
          )}
        </button>
      </form>

      {/* Path Results */}
      {pathResult && (
        <div className="tx-panel p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>PROVENANCED GRAPH TRAVERSAL PATH ({pathResult.hops || 0} HOPS)</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Confidence Score: <span className="text-[#C084FC] font-bold">{((pathResult.confidence || 1.0) * 100).toFixed(0)}%</span>
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 overflow-x-auto py-4">
            {(pathResult.nodes || []).map((node: any, idx: number) => (
              <React.Fragment key={node.id || idx}>
                <div className="tx-panel-elevated p-4 rounded-xl text-center min-w-[200px] shrink-0 space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Hop {idx + 1}</span>
                  <p className="text-sm font-bold text-slate-100 font-mono">{node.displayName || node.canonicalValue}</p>
                  <p className="text-xs font-mono text-[#C084FC]">{node.canonicalValue}</p>
                </div>

                {idx < pathResult.nodes.length - 1 && (
                  <div className="flex flex-col items-center shrink-0 text-[#B026FF]">
                    <span className="text-[10px] font-mono text-slate-400 mb-1 flex items-center space-x-1">
                      <Layers className="w-3 h-3 text-[#B026FF]" />
                      <span>{pathResult.relationships?.[idx]?.type || 'CONNECTED_TO'}</span>
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
