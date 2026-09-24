import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { apiClient, safeArray } from '../api/client';

interface EntityResolutionViewProps {
  userRole: string;
}

export const EntityResolutionView: React.FC<EntityResolutionViewProps> = ({ userRole }) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/entity-resolution/candidates');
      const list = safeArray(res.data, 'candidates');
      setCandidates(list);
    } catch (err: any) {
      console.error('Failed to fetch resolution candidates', err);
      setError(err.userMessage || 'Failed to fetch entity resolution candidate pipeline.');
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleConfirm = async (candidateId: string) => {
    if (userRole === 'ANALYST') {
      alert('Analyst role cannot perform canonical entity confirm operations.');
      return;
    }
    setProcessingId(candidateId);
    try {
      await apiClient.post(`/entity-resolution/candidates/${candidateId}/confirm`, {
        comment: 'Confirmed from Entity Resolution Pipeline',
      });
      fetchCandidates();
    } catch (err: any) {
      console.error('Confirmation failed', err);
      alert(err.userMessage || 'Confirm operation failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (candidateId: string) => {
    if (userRole === 'ANALYST') {
      alert('Analyst role cannot perform canonical entity reject operations.');
      return;
    }
    setProcessingId(candidateId);
    try {
      await apiClient.post(`/entity-resolution/candidates/${candidateId}/reject`, {
        comment: 'Rejected from Entity Resolution Pipeline',
      });
      fetchCandidates();
    } catch (err: any) {
      console.error('Rejection failed', err);
      alert(err.userMessage || 'Rejection operation failed');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel corner-bracket p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.35)] text-[#B026FF] rounded-xl shadow-md shadow-[#DC2626]/10">
            <GitMerge className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">ENTITY RESOLUTION PIPELINE</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              AI-assisted deduplication & canonical identity matching engine across disparate intelligence evidence feeds.
            </p>
          </div>
        </div>

        <button
          onClick={fetchCandidates}
          className="tx-btn-secondary p-2.5 text-xs font-semibold cursor-pointer self-start md:self-auto"
          title="Refresh Match Pipeline"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl text-[#EF4444] text-xs font-mono">
          {error}
        </div>
      )}

      {/* Candidates List */}
      <div className="tx-panel p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <h2 className="text-xs font-mono font-bold text-[#B026FF] uppercase tracking-wider flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#B026FF]" />
            <span>PENDING RESOLUTION MATCH PAIRS ({Array.isArray(candidates) ? candidates.length : 0})</span>
          </h2>

          <span className="text-xs font-mono text-slate-400">
            Threshold Confidence: ≥ 0.70
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#B026FF] animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Running entity resolution algorithms...</p>
          </div>
        ) : !Array.isArray(candidates) || candidates.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">All Entity Match Candidates Resolved</p>
            <p className="text-xs text-slate-500 font-mono">No pending entity duplication candidates require review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {candidates.map((cand) => {
              const entityA = cand.sourceEntity || cand.entityA || {};
              const entityB = cand.targetEntity || cand.entityB || {};
              const score = typeof cand.similarityScore === 'number' ? cand.similarityScore : (typeof cand.score === 'number' ? cand.score : 0);
              const matchRule = cand.matchType || cand.ruleMatch || 'HEURISTIC_EXACT_NORM';

              return (
                <div
                  key={cand.id}
                  className="tx-panel-elevated hover:border-[rgba(176,38,255,0.4)] p-5 transition space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-[#B026FF] bg-[#7C3AED]/15 px-2 py-0.5 rounded border border-[#7C3AED]/30">
                        {entityA?.type || 'ENTITY'} MATCH
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        Match Score: <span className="text-[#B026FF] font-bold">{(score * 100).toFixed(1)}%</span>
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-500">
                      Rule: {matchRule}
                    </span>
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 bg-[#0D0A12] border border-white/[0.08] rounded-xl space-y-1">
                      <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">Target Entity A (Primary Candidate)</p>
                      <p className="text-sm font-bold text-slate-100">{entityA?.displayName || entityA?.canonicalValue || 'Unknown'}</p>
                      <p className="text-xs font-mono text-[#B026FF]">{entityA?.canonicalValue}</p>
                      <p className="text-[11px] font-mono text-slate-500">ID: {entityA?.id}</p>
                    </div>

                    <div className="p-4 bg-[#0D0A12] border border-white/[0.08] rounded-xl space-y-1">
                      <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">Target Entity B (Duplicate Candidate)</p>
                      <p className="text-sm font-bold text-slate-100">{entityB?.displayName || entityB?.canonicalValue || 'Unknown'}</p>
                      <p className="text-xs font-mono text-[#B026FF]">{entityB?.canonicalValue}</p>
                      <p className="text-[11px] font-mono text-slate-500">ID: {entityB?.id}</p>
                    </div>
                  </div>

                  {/* Match Rationale */}
                  <div className="text-xs text-slate-400 bg-[#0D0A12] p-3 rounded-lg border border-white/[0.06] flex items-center justify-between">
                    <span className="font-mono">Rationale: {cand.reason || 'High similarity detected in canonical value normalization.'}</span>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        disabled={processingId === cand.id}
                        onClick={() => handleReject(cand.id)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-[#DC2626]/15 hover:bg-[#DC2626]/25 text-[#EF4444] border border-[#DC2626]/30 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject Match</span>
                      </button>
                      <button
                        disabled={processingId === cand.id}
                        onClick={() => handleConfirm(cand.id)}
                        className="tx-btn-primary flex items-center space-x-1 px-4 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Confirm Match</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
