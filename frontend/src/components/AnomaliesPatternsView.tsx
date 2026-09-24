import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Play
} from 'lucide-react';
import { apiClient, safeArray } from '../api/client';

interface AnomaliesPatternsViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole?: string;
}

export const AnomaliesPatternsView: React.FC<AnomaliesPatternsViewProps> = ({ userRole = 'INVESTIGATOR' }) => {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnomalies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/intelligence/anomalies');
      const list = safeArray(res.data, 'anomalies', 'patterns');
      setAnomalies(list);
    } catch (err: any) {
      console.error('Failed to load anomalies & patterns', err);
      setError(err.userMessage || 'Failed to fetch anomaly & pattern detection analysis.');
      setAnomalies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectPatterns = async () => {
    setDetecting(true);
    setError(null);
    try {
      await apiClient.post('/patterns/detect', {});
      await fetchAnomalies();
    } catch (err: any) {
      console.error('Failed to run pattern detection', err);
      setError(err.userMessage || 'Failed to run pattern detection.');
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#F59E0B]/20 to-[#DC2626]/20 border border-[rgba(245,158,11,0.30)] text-[#F59E0B] rounded-xl shadow-inner">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono flex items-center gap-2.5">
              <span>ANOMALIES & BEHAVIORAL PATTERN ENGINE</span>
              <span className="tx-badge-amber text-[10px]">TELEMETRY SCAN</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated detection of irregular financial bursts, geographic impossible travel, and synchronized cyber activity.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {(userRole === 'ADMIN' || userRole === 'INVESTIGATOR') && (
            <button
              onClick={handleDetectPatterns}
              disabled={detecting}
              className="tx-btn-primary flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{detecting ? 'Scanning Telemetry...' : 'Detect Patterns'}</span>
            </button>
          )}

          <button
            onClick={fetchAnomalies}
            className="tx-btn-secondary p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Refresh Anomalies"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center space-y-3 tx-panel rounded-2xl">
          <RefreshCw className="w-8 h-8 text-[#B026FF] animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Scanning global telemetry for behavioral anomalies...</p>
        </div>
      ) : !Array.isArray(anomalies) || anomalies.length === 0 ? (
        <div className="py-16 text-center space-y-3 tx-panel rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No High-Risk Behavioral Anomalies Detected</p>
          <p className="text-xs text-slate-500">All entity behavior pattern metrics are within normal standard deviation boundaries.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {anomalies.map((anom, idx) => (
            <div
              key={anom.id || idx}
              className="tx-panel hover:border-amber-500/50 rounded-2xl p-5 shadow-xl transition space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="tx-badge-amber text-xs font-mono font-bold px-2.5 py-0.5">
                    {anom.type || 'ANOMALY'}
                  </span>
                  <span className="text-xs font-mono text-slate-200 font-bold">
                    Anomaly Score: <span className="text-amber-400">{((anom.score || 0) * 100).toFixed(0)}%</span>
                  </span>
                </div>

                <span className="text-[11px] font-mono text-[#B026FF]">
                  Detected: {anom.timestamp ? new Date(anom.timestamp).toLocaleString() : 'Recent'}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100 font-mono">{anom.title || 'Behavioral Anomaly'}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{anom.description}</p>
              </div>

              {Array.isArray(anom.affectedEntities) && anom.affectedEntities.length > 0 && (
                <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 pt-2 border-t border-white/[0.08]">
                  <span className="text-slate-500">Target Entities:</span>
                  <span className="text-[#C084FC]">{anom.affectedEntities.join(', ')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
