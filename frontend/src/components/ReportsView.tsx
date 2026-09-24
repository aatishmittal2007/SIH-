import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  FileCheck,
  Clock,
  Shield,
  FolderKanban
} from 'lucide-react';
import { apiClient, unwrapData, safeArray } from '../api/client';

interface ReportsViewProps {
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  userRole: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ selectedCaseId, userRole }) => {
  const [caseIdInput, setCaseIdInput] = useState(selectedCaseId || '');
  const [cases, setCases] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reportFormat, setReportFormat] = useState('JSON');
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [includeGraph, setIncludeGraph] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available cases for selection
  const fetchCases = async () => {
    try {
      const res = await apiClient.get('/cases');
      const list = safeArray<any>(res.data, 'cases');
      setCases(list);
      if (!caseIdInput && list.length > 0) {
        setCaseIdInput(list[0].id);
      }
    } catch (err) {
      console.warn('Could not fetch cases list for reports', err);
    }
  };

  // Fetch existing reports
  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await apiClient.get('/reports');
      const list = safeArray(res.data, 'reports', 'items');
      setReports(list);
    } catch (err) {
      console.warn('Could not fetch reports list', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchCases();
    fetchReports();
  }, []);

  useEffect(() => {
    if (selectedCaseId) {
      setCaseIdInput(selectedCaseId);
    }
  }, [selectedCaseId]);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseIdInput.trim()) {
      setError('Please select or specify a Case Identifier to generate dossier.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/reports/generate', {
        caseId: caseIdInput.trim(),
        format: reportFormat,
        includeEvidence,
        includeGraph,
      });
      const data = unwrapData<any>(res.data) || res.data;
      setGeneratedReport(data);
      fetchReports();
    } catch (err: any) {
      console.error('Failed to generate report', err);
      setError(err.response?.data?.error || err.userMessage || 'Failed to generate court-ready forensic report.');
      setGeneratedReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (reportId: string, title?: string, format?: string) => {
    try {
      const res = await apiClient.get(`/reports/${reportId}/download`, { responseType: 'blob' });
      const ext = (format || 'json').toLowerCase();
      const fileName = title ? `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}` : `report-${reportId}.${ext}`;
      const mimeType = String(res.headers['content-type'] || 'application/json');
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to download report', err);
      alert('Failed to download report: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.30)] text-[#B026FF] rounded-xl shadow-inner">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono flex items-center gap-2.5">
              <span>FORENSIC REPORT GENERATOR</span>
              <span className="tx-badge-purple text-[10px]">EVIDENTIARY AUDIT</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Court-ready criminal intelligence dossier generation with SHA-256 evidence chain-of-custody verification.
            </p>
          </div>
        </div>
      </div>

      {/* Report Generator Form */}
      <form onSubmit={handleGenerateReport} className="tx-panel p-6 shadow-xl space-y-4">
        <h2 className="text-xs font-mono font-bold text-[#B026FF] uppercase tracking-wider flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#B026FF]" />
          <span>DOSSIER SPECIFICATION PARAMETERS</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400">Target Case</label>
            {cases.length > 0 ? (
              <select
                value={caseIdInput}
                onChange={(e) => setCaseIdInput(e.target.value)}
                className="tx-input w-full px-3.5 py-2 font-mono text-xs"
              >
                <option value="">-- Select Case --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} - {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={caseIdInput}
                onChange={(e) => setCaseIdInput(e.target.value)}
                placeholder="e.g. Case UUID or Identifier"
                className="tx-input w-full px-3.5 py-2 font-mono text-xs"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400">Output Export Format</label>
            <select
              value={reportFormat}
              onChange={(e) => setReportFormat(e.target.value)}
              className="tx-input w-full px-3.5 py-2 font-mono text-xs"
            >
              <option value="JSON">Intelligence JSON Dossier</option>
              <option value="PDF">Court-Ready PDF Dossier</option>
              <option value="CSV">Forensic CSV Export</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeEvidence}
              onChange={(e) => setIncludeEvidence(e.target.checked)}
              className="rounded bg-[#15121C] border-white/[0.08] text-[#7C3AED] focus:ring-0"
            />
            <span className="text-xs font-mono text-slate-300">Include SHA-256 Chain-of-Custody Manifest</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeGraph}
              onChange={(e) => setIncludeGraph(e.target.checked)}
              className="rounded bg-[#15121C] border-white/[0.08] text-[#7C3AED] focus:ring-0"
            />
            <span className="text-xs font-mono text-slate-300">Include Network Graph Topologies</span>
          </label>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="tx-btn-primary w-full py-3 text-xs font-semibold rounded-xl shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="font-mono">Compiling Intelligence Dossier...</span>
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4" />
              <span className="font-mono">Compile Forensic Dossier</span>
            </>
          )}
        </button>
      </form>

      {/* Generated Report Summary */}
      {generatedReport && (
        <div className="tx-panel border-emerald-500/30 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100 font-mono">Dossier Compilation Complete</h3>
            </div>

            <button
              onClick={() => handleDownload(generatedReport.id, generatedReport.title, generatedReport.format)}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold font-mono transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download ({generatedReport.format || reportFormat})</span>
            </button>
          </div>

          <div className="tx-panel-elevated p-4 rounded-xl space-y-2 font-mono text-xs text-slate-300 border border-white/[0.08]">
            <p><span className="text-slate-500">Dossier ID:</span> {generatedReport.id}</p>
            <p><span className="text-slate-500">Title:</span> {generatedReport.title}</p>
            <p><span className="text-slate-500">Case Reference:</span> {generatedReport.caseId || caseIdInput}</p>
            <p><span className="text-slate-500">Classification:</span> <span className="text-amber-400 font-bold">LAW ENFORCEMENT SENSITIVE</span></p>
            <p><span className="text-slate-500">Generated By:</span> {userRole}</p>
          </div>
        </div>
      )}

      {/* Existing Reports Section */}
      <div className="tx-panel p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#B026FF]" />
            <span>GENERATED INTELLIGENCE REPORTS ARCHIVE</span>
          </h2>
          <button
            onClick={fetchReports}
            className="tx-btn-secondary p-1.5 rounded-lg transition"
            title="Refresh reports"
          >
            <RefreshCw className={`w-4 h-4 ${loadingReports ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/[0.1] rounded-xl text-slate-500 text-xs font-mono">
            No generated reports archived yet. Compile a case dossier above.
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((rpt) => (
              <div
                key={rpt.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 tx-panel-elevated hover:border-[rgba(139,92,246,0.40)] rounded-xl gap-3 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="tx-badge-purple text-[10px]">
                      {rpt.format || 'JSON'}
                    </span>
                    <span className="text-xs font-semibold text-slate-100 font-mono">
                      {rpt.title || `Report for ${rpt.caseNumber || rpt.caseId}`}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center space-x-1">
                      <FolderKanban className="w-3 h-3 text-slate-500" />
                      <span>{rpt.caseNumber ? `Case ${rpt.caseNumber}` : rpt.caseTitle || rpt.caseId}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{rpt.createdAt ? new Date(rpt.createdAt).toLocaleDateString() : 'Recent'}</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload(rpt.id, rpt.title, rpt.format)}
                  className="tx-btn-secondary flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer self-start sm:self-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
