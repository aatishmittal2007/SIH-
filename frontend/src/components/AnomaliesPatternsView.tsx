import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

interface AnomaliesPatternsViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole: string;
}

export const AnomaliesPatternsView: React.FC<AnomaliesPatternsViewProps> = () => {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnomalies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/intelligence/anomalies');
      const data = unwrapData(res);
      const list = Array.isArray(data) ? data : (Array.isArray(res.data?.anomalies) ? res.data.anomalies : (Array.isArray(res.data) ? res.data : []));
      setAnomalies(list);
    } catch (err: any) {
      console.error('Failed to load anomalies & patterns', err);
      setError(err.userMessage || 'Failed to fetch anomaly & pattern detection analysis.');
      setAnomalies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#6D4AFF]/20 border border-[#6D4AFF]/40 text-[#6D4AFF] rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">ANOMALIES & BEHAVIORAL PATTERN ENGINE</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated detection of irregular financial bursts, geographic impossible travel, and synchronized cyber activity.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAnomalies}
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
          <p className="text-xs text-slate-400 font-mono">Scanning global telemetry for behavioral anomalies...</p>
        </div>
      ) : !Array.isArray(anomalies) || anomalies.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No High-Risk Behavioral Anomalies Detected</p>
          <p className="text-xs text-slate-500">All entity behavior pattern metrics are within normal standard deviation boundaries.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {anomalies.map((anom, idx) => (
            <div
              key={anom.id || idx}
              className="bg-[#111114] border border-[#1f1f28] hover:border-amber-500/40 rounded-2xl p-5 shadow-xl transition space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md">
                    {anom.type || 'ANOMALY'}
                  </span>
                  <span className="text-xs font-mono text-slate-300 font-bold">
                    Anomaly Score: {((anom.score || 0) * 100).toFixed(0)}%
                  </span>
                </div>

                <span className="text-[11px] font-mono text-[#6D4AFF]">
                  Detected: {anom.timestamp ? new Date(anom.timestamp).toLocaleString() : 'Recent'}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-100">{anom.title || 'Behavioral Anomaly'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{anom.description}</p>
              </div>

              {Array.isArray(anom.affectedEntities) && anom.affectedEntities.length > 0 && (
                <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 pt-2 border-t border-[#1f1f28]">
                  <span>Target Entities:</span>
                  <span className="text-cyan-400">{anom.affectedEntities.join(', ')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
