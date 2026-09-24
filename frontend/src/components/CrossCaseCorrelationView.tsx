import React, { useState, useEffect } from 'react';
import {
  Link2,
  RefreshCw,
  Shield,
  Layers,
  ArrowRight,
  Play
} from 'lucide-react';
import { apiClient, safeArray } from '../api/client';

interface CrossCaseCorrelationViewProps {
  onSelectCase: (caseId: string) => void;
  userRole: string;
}

export const CrossCaseCorrelationView: React.FC<CrossCaseCorrelationViewProps> = ({ onSelectCase, userRole }) => {
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningEngine, setRunningEngine] = useState(false);
  const [minScore, setMinScore] = useState<number>(0.5);
  const [error, setError] = useState<string | null>(null);

  const fetchCorrelations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/correlations?minScore=${minScore}`);
      const list = safeArray(res.data, 'correlations');
      setCorrelations(list);
    } catch (err: any) {
      console.error('Failed to load correlations', err);
      setError(err.userMessage || 'Failed to fetch cross-case correlation matrix.');
      setCorrelations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCorrelation = async () => {
    setRunningEngine(true);
    setError(null);
    try {
      await apiClient.post('/correlations/run', {});
      await fetchCorrelations();
    } catch (err: any) {
      console.error('Failed to run correlation engine', err);
      setError(err.userMessage || 'Failed to trigger cross-case correlation engine.');
    } finally {
      setRunningEngine(false);
    }
  };

  useEffect(() => {
    fetchCorrelations();
  }, [minScore]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel corner-bracket p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.35)] text-[#B026FF] rounded-xl shadow-md shadow-[#DC2626]/10">
            <Link2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">CROSS-CASE CORRELATION ENGINE</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Automated detection of shared entities, overlapping suspects, and cross-jurisdictional syndicate connections.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-[#0D0A12] border border-white/[0.08] px-3 py-1.5 rounded-xl">
            <span className="text-xs font-mono text-slate-400">Score Threshold:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="bg-transparent text-xs font-mono text-[#B026FF] focus:outline-none cursor-pointer"
            >
              <option value="0.3" className="bg-[#111019] text-slate-200">30% (Loose)</option>
              <option value="0.5" className="bg-[#111019] text-slate-200">50% (Standard)</option>
              <option value="0.7" className="bg-[#111019] text-slate-200">70% (Strict)</option>
              <option value="0.9" className="bg-[#111019] text-slate-200">90% (High Confidence)</option>
            </select>
          </div>

          {(userRole === 'ADMIN' || userRole === 'INVESTIGATOR') && (
            <button
              onClick={handleRunCorrelation}
              disabled={runningEngine}
              className="tx-btn-primary flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${runningEngine ? 'animate-spin' : ''}`} />
              <span>{runningEngine ? 'Analyzing...' : 'Run Correlation'}</span>
            </button>
          )}

          <button
            onClick={fetchCorrelations}
            className="tx-btn-secondary p-2.5 text-xs font-semibold cursor-pointer"
            title="Refresh Correlation Graph"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl text-[#EF4444] text-xs font-mono">
          {error}
        </div>
      )}

      {/* Correlation Grid */}
      {loading ? (
        <div className="py-16 text-center space-y-3 tx-panel">
          <RefreshCw className="w-8 h-8 text-[#B026FF] animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Calculating cross-case correlation index...</p>
        </div>
      ) : correlations.length === 0 ? (
        <div className="py-16 text-center space-y-3 tx-panel">
          <Shield className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No cross-case correlations found</p>
          <p className="text-xs text-slate-500 font-mono">Try lowering confidence score threshold or running the correlation engine.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {correlations.map((corr, idx) => {
            const caseA = corr.sourceCase || corr.caseA || {};
            const caseB = corr.targetCase || corr.caseB || {};
            const scoreVal = typeof corr.score === 'number' ? corr.score : (typeof corr.confidence === 'number' ? corr.confidence : 0);
            const signals = Array.isArray(corr.signals) ? corr.signals : [];

            return (
              <div
                key={corr.id || idx}
                className="tx-panel hover:bg-[#15121C] hover:border-[rgba(176,38,255,0.4)] p-5 shadow-xl transition space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      MATCH CONFIDENCE: {(scoreVal * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30">
                      {corr.status || 'ACTIVE'}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500">
                    Signals: {signals.length > 0 ? signals.length : (corr.sharedEntityCount || 1)}
                  </span>
                </div>

                {/* Linked Cases */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => caseA?.id && onSelectCase(caseA.id)}
                    className="p-3 bg-[#0D0A12] border border-white/[0.08] hover:border-[rgba(176,38,255,0.4)] rounded-xl text-left transition group cursor-pointer"
                  >
                    <p className="text-[10px] font-mono uppercase text-slate-500 font-bold">Source Case A</p>
                    <p className="text-xs font-bold text-slate-200 group-hover:text-[#B026FF] transition mt-0.5">
                      {caseA?.title || 'Case A'}
                    </p>
                    <p className="text-[11px] font-mono text-[#B026FF] mt-1 font-semibold">
                      {caseA?.caseNumber || corr.sourceCaseId || corr.caseAId || 'N/A'}
                    </p>
                  </button>

                  <button
                    onClick={() => caseB?.id && onSelectCase(caseB.id)}
                    className="p-3 bg-[#0D0A12] border border-white/[0.08] hover:border-[rgba(176,38,255,0.4)] rounded-xl text-left transition group cursor-pointer"
                  >
                    <p className="text-[10px] font-mono uppercase text-slate-500 font-bold">Linked Case B</p>
                    <p className="text-xs font-bold text-slate-200 group-hover:text-[#B026FF] transition mt-0.5">
                      {caseB?.title || 'Case B'}
                    </p>
                    <p className="text-[11px] font-mono text-[#B026FF] mt-1 font-semibold">
                      {caseB?.caseNumber || corr.targetCaseId || corr.caseBId || 'N/A'}
                    </p>
                  </button>
                </div>

                {/* Signals / Shared Entities */}
                {signals.length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-white/[0.08]">
                    <p className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center space-x-1">
                      <Layers className="w-3 h-3 text-[#B026FF]" />
                      <span>Correlation Signals</span>
                    </p>
                    <div className="space-y-1">
                      {signals.slice(0, 3).map((sig: any, i: number) => (
                        <p key={i} className="text-[11px] font-mono text-slate-300 bg-[#0D0A12] border border-white/[0.08] px-2.5 py-1 rounded">
                          {sig.description || sig.type}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback shared entities */}
                {signals.length === 0 && corr.sharedEntities && corr.sharedEntities.length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-white/[0.08]">
                    <p className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center space-x-1">
                      <Layers className="w-3 h-3 text-[#B026FF]" />
                      <span>Shared Canonical Entities</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {corr.sharedEntities.map((se: any, i: number) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono bg-[#0D0A12] border border-white/[0.08] text-slate-200 px-2 py-0.5 rounded"
                        >
                          {se.canonicalValue || se.displayName || 'Entity'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/[0.06]">
                  <span className="text-[11px] font-mono">Analytical Signal</span>
                  <span className="flex items-center space-x-1 text-[#B026FF] font-semibold">
                    <span>Verified Connection</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
