import React, { useState, useEffect } from 'react';
import {
  Zap,
  RefreshCw,
  AlertOctagon,
  CheckCircle2,
  FileText,
  Check
} from 'lucide-react';
import { apiClient, safeArray } from '../api/client';

interface ContradictionsViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole?: string;
}

export const ContradictionsView: React.FC<ContradictionsViewProps> = ({ userRole = 'INVESTIGATOR' }) => {
  const [contradictions, setContradictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchContradictions = async () => {
    setLoading(true);
    setError(null);
    try {
      // Backend mounts on both /contradictions and /intelligence/contradictions
      const res = await apiClient.get('/contradictions');
      const list = safeArray(res.data, 'contradictions');
      setContradictions(list);
    } catch (err: any) {
      console.error('Failed to load contradictions', err);
      setError(err.userMessage || 'Failed to fetch statement & timeline contradiction analysis.');
      setContradictions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveContradiction = async (id: string) => {
    setResolvingId(id);
    try {
      await apiClient.patch(`/contradictions/${id}/resolve`, {
        resolutionNotes: 'Analytical verification confirmed and resolved by investigator',
      });
      await fetchContradictions();
    } catch (err: any) {
      console.error('Failed to resolve contradiction', err);
      alert(err.userMessage || 'Failed to resolve contradiction.');
    } finally {
      setResolvingId(null);
    }
  };

  useEffect(() => {
    fetchContradictions();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(220,38,38,0.30)] text-[#EF4444] rounded-xl shadow-inner">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono flex items-center gap-2.5">
              <span>CONTRADICTION & ALIBI CONFLICT DETECTOR</span>
              <span className="tx-badge-red text-[10px]">CONFLICT AUDIT</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated cross-examination engine finding conflicting witness statements, impossible alibis, and timeline collisions.
            </p>
          </div>
        </div>

        <button
          onClick={fetchContradictions}
          className="tx-btn-secondary p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer self-start md:self-auto"
          title="Refresh Contradictions"
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
          <RefreshCw className="w-8 h-8 text-[#EF4444] animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Cross-referencing timeline events for contradictions...</p>
        </div>
      ) : !Array.isArray(contradictions) || contradictions.length === 0 ? (
        <div className="py-16 text-center space-y-3 tx-panel rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No Factual or Timeline Contradictions Found</p>
          <p className="text-xs text-slate-500">All evidence statements and temporal events are logically consistent across cases.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contradictions.map((contra, idx) => {
            const claims = Array.isArray(contra.claims) ? contra.claims : [];
            const isResolved = contra.status === 'RESOLVED';

            return (
              <div
                key={contra.id || idx}
                className={`tx-panel p-5 shadow-xl transition space-y-3 ${
                  isResolved ? 'border-emerald-500/30 opacity-75' : 'hover:border-rose-500/50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="tx-badge-red text-xs font-mono font-bold px-2.5 py-0.5 flex items-center space-x-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#EF4444]" />
                      <span>{contra.severity || 'HIGH'} SEVERITY</span>
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      isResolved ? 'tx-badge-green' : 'tx-badge-red'
                    }`}>
                      {contra.status || 'UNRESOLVED'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] font-mono text-slate-400">
                      Type: <span className="text-[#C084FC]">{contra.type || contra.category || 'STATEMENT_CONFLICT'}</span>
                    </span>
                    {!isResolved && (userRole === 'ADMIN' || userRole === 'INVESTIGATOR') && (
                      <button
                        disabled={resolvingId === contra.id}
                        onClick={() => handleResolveContradiction(contra.id)}
                        className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold font-mono transition cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-100 font-mono">{contra.title || contra.type || 'Statement Contradiction'}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{contra.description}</p>
                </div>

                {claims.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {claims.map((claim: any, cIdx: number) => (
                      <div key={claim.id || cIdx} className="tx-panel-elevated p-3 border border-rose-500/20 rounded-xl space-y-1">
                        <span className="text-[10px] font-mono uppercase text-rose-400 font-bold">
                          Claim {cIdx + 1}: {claim.claimType || 'Statement'}
                        </span>
                        <p className="text-xs text-slate-300">{claim.claimText || claim.statement || claim.description || 'Conflicting statement record'}</p>
                        {claim.evidence && (
                          <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-400 pt-1 border-t border-white/[0.08]">
                            <FileText className="w-3 h-3 text-[#B026FF]" />
                            <span>Evidence: {claim.evidence.title}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (contra.factA || contra.factB) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="tx-panel-elevated p-3 border border-rose-500/20 rounded-xl space-y-1">
                      <span className="text-[10px] font-mono uppercase text-rose-400 font-bold">Fact A</span>
                      <p className="text-xs text-slate-300">{contra.factA}</p>
                    </div>
                    <div className="tx-panel-elevated p-3 border border-rose-500/20 rounded-xl space-y-1">
                      <span className="text-[10px] font-mono uppercase text-rose-400 font-bold">Fact B</span>
                      <p className="text-xs text-slate-300">{contra.factB}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
