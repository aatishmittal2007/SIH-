import React, { useState, useEffect } from 'react';
import {
  Zap,
  RefreshCw,
  AlertOctagon,
  CheckCircle2
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

interface ContradictionsViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole: string;
}

export const ContradictionsView: React.FC<ContradictionsViewProps> = () => {
  const [contradictions, setContradictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContradictions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/intelligence/contradictions');
      const data = unwrapData(res);
      const list = Array.isArray(data) ? data : (Array.isArray(res.data?.contradictions) ? res.data.contradictions : (Array.isArray(res.data) ? res.data : []));
      setContradictions(list);
    } catch (err: any) {
      console.error('Failed to load contradictions', err);
      setError(err.userMessage || 'Failed to fetch statement & timeline contradiction analysis.');
      setContradictions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContradictions();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-400 rounded-xl">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">CONTRADICTION & ALIBI CONFLICT DETECTOR</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated cross-examination engine finding conflicting witness statements, impossible alibis, and timeline collisions.
            </p>
          </div>
        </div>

        <button
          onClick={fetchContradictions}
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
          <RefreshCw className="w-8 h-8 text-rose-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Cross-referencing timeline events for contradictions...</p>
        </div>
      ) : !Array.isArray(contradictions) || contradictions.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No Factual or Timeline Contradictions Found</p>
          <p className="text-xs text-slate-500">All evidence statements and temporal events are logically consistent across cases.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contradictions.map((contra, idx) => (
            <div
              key={contra.id || idx}
              className="bg-[#111114] border border-[#1f1f28] hover:border-rose-500/40 rounded-2xl p-5 shadow-xl transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-md flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-rose-400" />
                  <span>CONFLICT CONFIDENCE: {((contra.confidence || 0) * 100).toFixed(0)}%</span>
                </span>

                <span className="text-[11px] font-mono text-slate-500">
                  Category: {contra.category || 'STATEMENT_VS_LOCATION'}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-100">{contra.title || 'Statement Contradiction'}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{contra.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-[#0a0a0c] border border-rose-500/20 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono uppercase text-rose-400 font-bold">Conflicting Fact A</span>
                  <p className="text-xs text-slate-300">{contra.factA}</p>
                </div>
                <div className="p-3 bg-[#0a0a0c] border border-rose-500/20 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono uppercase text-rose-400 font-bold">Conflicting Fact B</span>
                  <p className="text-xs text-slate-300">{contra.factB}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
