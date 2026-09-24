import React, { useState, useEffect } from 'react';
import {
  Bell,
  RefreshCw,
  Clock,
  ShieldCheck,
  Play,
  Check,
  AlertTriangle
} from 'lucide-react';
import { apiClient, safeArray } from '../api/client';

interface AlertsViewProps {
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  userRole?: string;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ selectedCaseId, userRole = 'INVESTIGATOR' }) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = selectedCaseId ? `/alerts?caseId=${selectedCaseId}` : '/alerts';
      const res = await apiClient.get(url);
      const list = safeArray(res.data, 'alerts');
      setAlerts(list);
    } catch (err: any) {
      console.error('Failed to load alerts', err);
      setError(err.userMessage || 'Failed to fetch active alerts.');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAlerts = async () => {
    setGenerating(true);
    setError(null);
    try {
      await apiClient.post('/alerts/generate', {
        caseId: selectedCaseId || undefined,
      });
      await fetchAlerts();
    } catch (err: any) {
      console.error('Failed to generate alerts', err);
      setError(err.userMessage || 'Failed to trigger alert generation.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await apiClient.patch(`/alerts/${id}`, { status: 'ACKNOWLEDGED' });
      await fetchAlerts();
    } catch (err: any) {
      console.error('Failed to update alert status', err);
      alert(err.userMessage || 'Failed to acknowledge alert.');
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [selectedCaseId]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#F59E0B]/20 to-[#DC2626]/20 border border-[rgba(245,158,11,0.30)] text-[#F59E0B] rounded-xl shadow-inner">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono flex items-center gap-2.5">
              <span>CRITICAL ALERT DISPATCH</span>
              <span className="tx-badge-red text-[10px]">LIVE DISPATCH</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time intelligence trigger notifications, suspect movement alerts, and new evidence match logs.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {(userRole === 'ADMIN' || userRole === 'INVESTIGATOR') && (
            <button
              onClick={handleGenerateAlerts}
              disabled={generating}
              className="tx-btn-primary flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{generating ? 'Evaluating...' : 'Scan Alerts'}</span>
            </button>
          )}

          <button
            onClick={fetchAlerts}
            className="tx-btn-secondary p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Refresh Alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center space-y-3 tx-panel rounded-2xl">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Fetching active intelligence alerts...</p>
        </div>
      ) : !Array.isArray(alerts) || alerts.length === 0 ? (
        <div className="py-16 text-center space-y-3 tx-panel rounded-2xl">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-300 font-mono">All Systems Nominal — Zero Critical Alerts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((al, idx) => {
            const isAck = al.status === 'ACKNOWLEDGED';
            const isHigh = al.severity === 'HIGH' || al.severity === 'CRITICAL';

            return (
              <div
                key={al.id || idx}
                className={`tx-panel rounded-2xl p-5 shadow-xl transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isAck ? 'opacity-70 border-white/[0.06]' : 'hover:border-amber-500/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                      isHigh ? 'tx-badge-red' : 'tx-badge-amber'
                    }`}>
                      {al.severity || 'HIGH'}
                    </span>
                    <span className="text-xs font-bold text-slate-100 font-mono">{al.title || 'Intelligence Alert'}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#15121C] text-slate-400 border border-white/[0.08]">
                      {al.status || 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{al.message || al.description}</p>
                </div>

                <div className="flex items-center space-x-4 shrink-0">
                  <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{al.createdAt || al.timestamp ? new Date(al.createdAt || al.timestamp).toLocaleString() : 'Recent'}</span>
                  </div>

                  {!isAck && (
                    <button
                      onClick={() => handleAcknowledge(al.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold font-mono transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
