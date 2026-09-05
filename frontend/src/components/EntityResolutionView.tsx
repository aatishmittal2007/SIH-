import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

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
      const data = unwrapData(res);
      const list = Array.isArray(data) ? data : (Array.isArray(res.data?.candidates) ? res.data.candidates : (Array.isArray(res.data) ? res.data : []));
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

  const handleMerge = async (candidateId: string, primaryEntityId: string, duplicateEntityId: string) => {
    if (userRole === 'ANALYST') {
      alert('Analyst role cannot perform canonical entity merge operations.');
      return;
    }
    setProcessingId(candidateId);
    try {
      await apiClient.post('/entity-resolution/merge', {
        candidateId,
        primaryEntityId,
        duplicateEntityId,
      });
      fetchCandidates();
    } catch (err: any) {
      console.error('Merge failed', err);
      alert(err.userMessage || 'Merge operation failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (candidateId: string) => {
    setProcessingId(candidateId);
    try {
      await apiClient.post('/entity-resolution/reject', { candidateId });
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#6D4AFF]/20 border border-[#6D4AFF]/40 text-[#6D4AFF] rounded-xl">
            <GitMerge className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">ENTITY RESOLUTION PIPELINE</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              AI-assisted deduplication & canonical identity matching engine across disparate intelligence evidence feeds.
            </p>
          </div>
        </div>

        <button
          onClick={fetchCandidates}
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

      {/* Candidates List */}
      <div className="bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#1f1f28] pb-4">
          <h2 className="text-xs font-mono font-bold text-[#6D4AFF] uppercase tracking-wider flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#6D4AFF]" />
            <span>PENDING RESOLUTION MATCH PAIRS ({Array.isArray(candidates) ? candidates.length : 0})</span>
          </h2>

          <span className="text-xs font-mono text-slate-400">
            Threshold Confidence: ≥ 0.70
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#6D4AFF] animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Running entity resolution algorithms...</p>
          </div>
        ) : !Array.isArray(candidates) || candidates.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">All Entity Match Candidates Resolved</p>
            <p className="text-xs text-slate-500">No pending entity duplication candidates require review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className="bg-[#0a0a0c] border border-[#262633] hover:border-[#6D4AFF]/40 rounded-xl p-5 transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {cand.entityA?.type || 'ENTITY'} MATCH
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Match Score: <span className="text-[#a38cff] font-bold">{(cand.score * 100).toFixed(1)}%</span>
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500">
                    Rule: {cand.ruleMatch || 'HEURISTIC_EXACT_NORM'}
                  </span>
                </div>

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-[#111114] border border-[#1f1f28] rounded-xl space-y-1">
                    <p className="text-[10px] font-mono uppercase text-slate-400">Target Entity A (Primary Candidate)</p>
                    <p className="text-sm font-bold text-slate-100">{cand.entityA?.displayName || cand.entityA?.canonicalValue}</p>
                    <p className="text-xs font-mono text-cyan-400">{cand.entityA?.canonicalValue}</p>
                    <p className="text-[11px] font-mono text-slate-500">ID: {cand.entityA?.id}</p>
                  </div>

                  <div className="p-4 bg-[#111114] border border-[#1f1f28] rounded-xl space-y-1">
                    <p className="text-[10px] font-mono uppercase text-slate-400">Target Entity B (Duplicate Candidate)</p>
                    <p className="text-sm font-bold text-slate-100">{cand.entityB?.displayName || cand.entityB?.canonicalValue}</p>
                    <p className="text-xs font-mono text-cyan-400">{cand.entityB?.canonicalValue}</p>
                    <p className="text-[11px] font-mono text-slate-500">ID: {cand.entityB?.id}</p>
                  </div>
                </div>

                {/* Match Rationale */}
                <div className="text-xs text-slate-400 bg-[#14141c] p-3 rounded-lg border border-[#20202e] flex items-center justify-between">
                  <span>Rationale: {cand.reason || 'High similarity detected in canonical value normalization.'}</span>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      disabled={processingId === cand.id}
                      onClick={() => handleReject(cand.id)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject Match</span>
                    </button>
                    <button
                      disabled={processingId === cand.id}
                      onClick={() => handleMerge(cand.id, cand.entityA.id, cand.entityB.id)}
                      className="flex items-center space-x-1 px-4 py-1.5 bg-[#6D4AFF] hover:bg-[#7C5CFC] text-white rounded-lg text-xs font-semibold shadow-lg shadow-[#6D4AFF]/20 transition cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Confirm Merge</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
