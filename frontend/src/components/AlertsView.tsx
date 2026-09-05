import React, { useState, useEffect } from 'react';
import {
  Bell,
  RefreshCw,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

interface AlertsViewProps {
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  userRole?: string;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ selectedCaseId }) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const url = selectedCaseId ? `/alerts?caseId=${selectedCaseId}` : '/alerts';
      const res = await apiClient.get(url);
      const data = unwrapData(res);
      const list = Array.isArray(data) ? data : (Array.isArray(res.data?.alerts) ? res.data.alerts : (Array.isArray(res.data) ? res.data : []));
      setAlerts(list);
    } catch (err) {
      console.error('Failed to load alerts', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [selectedCaseId]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-xl">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">CRITICAL ALERT DISPATCH</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time intelligence trigger notifications, suspect movement alerts, and new evidence match logs.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAlerts}
          className="p-2.5 bg-[#17171f] hover:bg-[#20202b] text-slate-300 border border-[#262633] rounded-xl text-xs font-semibold transition cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Fetching active intelligence alerts...</p>
        </div>
      ) : !Array.isArray(alerts) || alerts.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">All Systems Nominal — Zero Critical Alerts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((al, idx) => (
            <div
              key={al.id || idx}
              className="bg-[#111114] border border-[#1f1f28] hover:border-amber-500/40 rounded-2xl p-5 shadow-xl transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
                    {al.severity || 'HIGH'}
                  </span>
                  <span className="text-xs font-bold text-slate-100">{al.title || 'Intelligence Alert'}</span>
                </div>
                <p className="text-xs text-slate-400">{al.message || al.description}</p>
              </div>

              <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span>{al.timestamp ? new Date(al.timestamp).toLocaleString() : 'Just now'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
