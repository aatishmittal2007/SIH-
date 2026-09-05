import React, { useState, useEffect } from 'react';
import {
  Link2,
  RefreshCw,
  Shield,
  Layers,
  ArrowRight
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

interface CrossCaseCorrelationViewProps {
  onSelectCase: (caseId: string) => void;
  userRole: string;
}

export const CrossCaseCorrelationView: React.FC<CrossCaseCorrelationViewProps> = ({ onSelectCase }) => {
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState<number>(0.5);
  const [error, setError] = useState<string | null>(null);

  const fetchCorrelations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/correlations?minScore=${minScore}`);
      const data = unwrapData(res);
      const list = Array.isArray(data) ? data : (Array.isArray(res.data?.correlations) ? res.data.correlations : (Array.isArray(res.data) ? res.data : []));
      setCorrelations(list);
    } catch (err: any) {
      console.error('Failed to load correlations', err);
      setError(err.userMessage || 'Failed to fetch cross-case correlation matrix.');
      setCorrelations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrelations();
  }, [minScore]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#6D4AFF]/20 border border-[#6D4AFF]/40 text-[#6D4AFF] rounded-xl">
            <Link2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">CROSS-CASE CORRELATION ENGINE</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated detection of shared entities, overlapping suspects, and cross-jurisdictional syndicate connections.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-[#0a0a0c] border border-[#262633] px-3 py-1.5 rounded-xl">
            <span className="text-xs font-mono text-slate-400">Score Threshold:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="bg-transparent text-xs font-mono text-[#a38cff] focus:outline-none cursor-pointer"
            >
              <option value="0.3">30% (Loose)</option>
              <option value="0.5">50% (Standard)</option>
              <option value="0.7">70% (Strict)</option>
              <option value="0.9">90% (High Confidence)</option>
            </select>
          </div>

          <button
            onClick={fetchCorrelations}
            className="p-2.5 bg-[#17171f] hover:bg-[#20202b] text-slate-300 border border-[#262633] rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Correlation Grid */}
      {loading ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <RefreshCw className="w-8 h-8 text-[#6D4AFF] animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Calculating cross-case correlation index...</p>
        </div>
      ) : correlations.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <Shield className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No Cross-Case Links Detected</p>
          <p className="text-xs text-slate-500">Try lowering the confidence score threshold.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {correlations.map((corr, idx) => (
            <div
              key={corr.id || idx}
              className="bg-[#111114] border border-[#1f1f28] hover:border-[#6D4AFF]/40 rounded-2xl p-5 shadow-xl transition space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    MATCH CONFIDENCE: {(corr.score * 100).toFixed(0)}%
                  </span>
                </div>

                <span className="text-[11px] font-mono text-slate-500">
                  Shared: {corr.sharedEntityCount || 1} Entities
                </span>
              </div>

              {/* Linked Cases */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => corr.caseA?.id && onSelectCase(corr.caseA.id)}
                  className="p-3 bg-[#0a0a0c] border border-[#262633] hover:border-[#6D4AFF]/50 rounded-xl text-left transition group"
                >
                  <p className="text-[10px] font-mono uppercase text-slate-500">Source Case A</p>
                  <p className="text-xs font-bold text-slate-200 group-hover:text-[#6D4AFF] transition mt-0.5">
                    {corr.caseA?.title || 'Case A'}
                  </p>
                  <p className="text-[11px] font-mono text-cyan-400 mt-1">
                    {corr.caseA?.caseNumber || corr.caseAId}
                  </p>
                </button>

                <button
                  onClick={() => corr.caseB?.id && onSelectCase(corr.caseB.id)}
                  className="p-3 bg-[#0a0a0c] border border-[#262633] hover:border-[#6D4AFF]/50 rounded-xl text-left transition group"
                >
                  <p className="text-[10px] font-mono uppercase text-slate-500">Linked Case B</p>
                  <p className="text-xs font-bold text-slate-200 group-hover:text-[#6D4AFF] transition mt-0.5">
                    {corr.caseB?.title || 'Case B'}
                  </p>
                  <p className="text-[11px] font-mono text-cyan-400 mt-1">
                    {corr.caseB?.caseNumber || corr.caseBId}
                  </p>
                </button>
              </div>

              {/* Common Entities list */}
              {corr.sharedEntities && corr.sharedEntities.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-[#1f1f28]">
                  <p className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-[#6D4AFF]" />
                    <span>Shared Canonical Entities</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {corr.sharedEntities.map((se: any, i: number) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono bg-[#171725] border border-[#262638] text-slate-200 px-2 py-0.5 rounded"
                      >
                        {se.canonicalValue || se.displayName || 'Entity'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1f1f28]/60">
                <span className="text-[11px] font-mono">Provenances verified</span>
                <span className="flex items-center space-x-1 text-[#a38cff] font-semibold">
                  <span>Explore Correlation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
