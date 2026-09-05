import React, { useState } from 'react';
import {
  FileText,
  Download,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

interface ReportsViewProps {
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  userRole: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ selectedCaseId, userRole }) => {
  const [caseIdInput, setCaseIdInput] = useState(selectedCaseId || '');
  const [reportFormat, setReportFormat] = useState('PDF');
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [includeGraph, setIncludeGraph] = useState(true);
  const [loading, setLoading] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseIdInput.trim()) {
      setError('Please specify a Case Identifier to generate dossier.');
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
      const data = unwrapData(res);
      setGeneratedReport(data || res.data || null);
    } catch (err: any) {
      console.error('Failed to generate report', err);
      setError(err.userMessage || 'Failed to generate court-ready forensic report.');
      setGeneratedReport(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#6D4AFF]/20 border border-[#6D4AFF]/40 text-[#6D4AFF] rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">FORENSIC REPORT GENERATOR</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Court-ready criminal intelligence dossier generation with SHA-256 evidence chain-of-custody verification.
            </p>
          </div>
        </div>
      </div>

      {/* Report Generator Form */}
      <form onSubmit={handleGenerateReport} className="bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-xs font-mono font-bold text-[#6D4AFF] uppercase tracking-wider flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#6D4AFF]" />
          <span>DOSSIER SPECIFICATION PARAMETERS</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400">Target Case ID or Case Number</label>
            <input
              type="text"
              value={caseIdInput}
              onChange={(e) => setCaseIdInput(e.target.value)}
              placeholder="e.g. CASE-2026-001 or ID"
              className="w-full px-3.5 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#6D4AFF]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400">Output Export Format</label>
            <select
              value={reportFormat}
              onChange={(e) => setReportFormat(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-300 focus:outline-none focus:border-[#6D4AFF]"
            >
              <option value="PDF">Court-Ready PDF Dossier</option>
              <option value="JSON">Raw Intelligence JSON Data</option>
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
              className="rounded bg-[#0a0a0c] border-[#262633] text-[#6D4AFF] focus:ring-0"
            />
            <span className="text-xs font-mono text-slate-300">Include SHA-256 Chain-of-Custody Manifest</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeGraph}
              onChange={(e) => setIncludeGraph(e.target.checked)}
              className="rounded bg-[#0a0a0c] border-[#262633] text-[#6D4AFF] focus:ring-0"
            />
            <span className="text-xs font-mono text-slate-300">Include Neo4j Network Topology Diagram</span>
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
          className="w-full py-3 bg-[#6D4AFF] hover:bg-[#7C5CFC] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#6D4AFF]/20 transition flex items-center justify-center space-x-2 cursor-pointer"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Compiling Intelligence Dossier...</span>
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4" />
              <span>Compile Forensic Dossier</span>
            </>
          )}
        </button>
      </form>

      {/* Generated Report Summary */}
      {generatedReport && (
        <div className="bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#1f1f28] pb-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100">Dossier Compilation Complete</h3>
            </div>

            <a
              href={generatedReport.downloadUrl || '#'}
              download
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download ({reportFormat})</span>
            </a>
          </div>

          <div className="p-4 bg-[#0a0a0c] border border-[#262633] rounded-xl space-y-2 font-mono text-xs text-slate-300">
            <p><span className="text-slate-500">Dossier ID:</span> {generatedReport.reportId || 'RPT-2026-9981'}</p>
            <p><span className="text-slate-500">Case Reference:</span> {generatedReport.caseNumber || caseIdInput}</p>
            <p><span className="text-slate-500">Export Classification:</span> <span className="text-amber-400 font-bold">LAW ENFORCEMENT SENSITIVE</span></p>
            <p><span className="text-slate-500">Generated By:</span> {userRole}</p>
          </div>
        </div>
      )}
    </div>
  );
};
