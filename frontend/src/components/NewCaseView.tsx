import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  ArrowLeft,
  FileText,
  Upload,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { apiClient } from '../api/client';

interface NewCaseViewProps {
  onCaseCreated: (caseId: string) => void;
  onCancel: () => void;
  userRole?: string;
}

export const NewCaseView: React.FC<NewCaseViewProps> = ({ onCaseCreated, onCancel }) => {
  const [caseNumber, setCaseNumber] = useState(`CASE-${Date.now().toString().slice(-6)}`);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [sources, setSources] = useState<any[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  
  // Initial evidence file attachment
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceType, setEvidenceType] = useState('CDR');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/sources')
      .then((res) => {
        setSources(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedSourceId(res.data[0].id);
        }
      })
      .catch((err) => console.error('Failed to load sources', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create Case
      const caseRes = await apiClient.post('/cases', {
        caseNumber,
        title,
        description,
        priority,
      });

      const newCase = caseRes.data;

      // 2. Upload initial evidence file if attached
      if (evidenceFile && selectedSourceId) {
        const formData = new FormData();
        formData.append('file', evidenceFile);
        formData.append('caseId', newCase.id);
        formData.append('sourceId', selectedSourceId);
        formData.append('title', evidenceTitle || 'Initial Case Evidence');
        const typeMapping: Record<string, string> = {
          CDR: 'LOG',
          IP_LOG: 'LOG',
          BANK_STATEMENT: 'TRANSACTION',
          CHAT_EXPORT: 'DOCUMENT',
        };
        const validEvidenceType = typeMapping[evidenceType] || evidenceType;
        formData.append('type', validEvidenceType);

        await apiClient.post('/evidence/upload', formData);
      }

      onCaseCreated(newCase.id);
    } catch (err: any) {
      console.error('Case intake creation failed', err);
      setError(err.userMessage || 'Failed to create case intake record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="flex items-center space-x-2 text-xs font-mono text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO CASE LIST</span>
        </button>

        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-status-red-purple"></span>
          <span className="text-[#B026FF] font-semibold">CASE INTAKE PORTAL</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="tx-panel corner-bracket-full p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex items-center space-x-4 border-b border-white/[0.08] pb-6">
          <div className="p-3 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.35)] text-[#B026FF] rounded-2xl shadow-lg shadow-[#DC2626]/10">
            <FolderPlus className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">INITIALIZE NEW INVESTIGATION CASE</h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Create official case dossier, register initial evidence, and initialize entity analysis graph node.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl text-[#EF4444] text-xs font-mono flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-[#EF4444]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Case Details */}
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-bold text-[#B026FF] uppercase tracking-wider flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#B026FF]" />
              <span>1. PRIMARY DOSSIER DETAILS</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Case Reference Number</label>
                <input
                  type="text"
                  required
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  className="tx-input w-full px-3.5 py-2.5 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Priority Classification</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="tx-input w-full px-3.5 py-2.5 text-xs"
                >
                  <option value="LOW">LOW PRIORITY</option>
                  <option value="MEDIUM">MEDIUM PRIORITY</option>
                  <option value="HIGH">HIGH PRIORITY</option>
                  <option value="CRITICAL">CRITICAL PRIORITY</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Investigation Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operation Shadow: Cross-Border Financial Syndicate Investigation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="tx-input w-full px-3.5 py-2.5 text-xs"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Executive Case Brief & Scope</label>
                <textarea
                  rows={4}
                  placeholder="Detailed breakdown of intelligence reports, target suspects, jurisdiction notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="tx-input w-full px-3.5 py-2.5 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Initial Evidence Registration */}
          <div className="space-y-4 pt-4 border-t border-white/[0.08]">
            <h2 className="text-xs font-mono font-bold text-[#B026FF] uppercase tracking-wider flex items-center space-x-2">
              <Upload className="w-4 h-4 text-[#B026FF]" />
              <span>2. INITIAL EVIDENCE FILE ATTACHMENT (OPTIONAL)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Evidence Record Title</label>
                <input
                  type="text"
                  placeholder="e.g. Target Alpha CDR Extract"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  className="tx-input w-full px-3.5 py-2.5 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Evidence Type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="tx-input w-full px-3.5 py-2.5 text-xs"
                >
                  <option value="LOG">Call Detail Records (CDR) / System Logs</option>
                  <option value="DOCUMENT">Official Document / Chat Export</option>
                  <option value="TRANSACTION">Bank Statement / Transaction</option>
                  <option value="REPORT">Intelligence Report</option>
                  <option value="IMAGE">Image Evidence</option>
                  <option value="AUDIO">Audio Intercept</option>
                  <option value="VIDEO">Video Surveillance</option>
                  <option value="OTHER">Other Evidence</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Intelligence Source Agency</label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="tx-input w-full px-3.5 py-2.5 text-xs"
                >
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Evidence File (PDF/CSV/TXT)</label>
                <input
                  type="file"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                  className="tx-input w-full px-3 py-2 text-xs text-slate-300 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onCancel}
              className="tx-btn-secondary px-5 py-2.5 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="tx-btn-primary flex items-center space-x-2 px-6 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Creating Dossier...' : 'CREATE INVESTIGATION DOSSIER'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
