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
        formData.append('type', evidenceType);

        await apiClient.post('/evidence/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
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
          <span className="w-2 h-2 rounded-full bg-[#6D4AFF]"></span>
          <span>CASE INTAKE PORTAL</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex items-center space-x-4 border-b border-[#1f1f28] pb-6">
          <div className="p-3 bg-[#6D4AFF]/20 border border-[#6D4AFF]/40 text-[#6D4AFF] rounded-2xl">
            <FolderPlus className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">INITIALIZE NEW INVESTIGATION CASE</h1>
            <p className="text-xs text-slate-400 mt-1">
              Create an official case dossier, register initial evidence, and initialize entity analysis graph node.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Case Details */}
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-bold text-[#6D4AFF] uppercase tracking-wider flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#6D4AFF]" />
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
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Priority Classification</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
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
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Executive Case Brief & Scope</label>
                <textarea
                  rows={4}
                  placeholder="Detailed breakdown of intelligence reports, target suspects, jurisdiction notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Initial Evidence Registration */}
          <div className="space-y-4 pt-4 border-t border-[#1f1f28]">
            <h2 className="text-xs font-mono font-bold text-[#6D4AFF] uppercase tracking-wider flex items-center space-x-2">
              <Upload className="w-4 h-4 text-[#6D4AFF]" />
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
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Evidence Type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
                >
                  <option value="CDR">CDR Log</option>
                  <option value="BANK_STATEMENT">Bank Statement</option>
                  <option value="CHAT_EXPORT">Chat Export</option>
                  <option value="IP_LOG">IP Log</option>
                  <option value="IMAGE">Image</option>
                  <option value="AUDIO">Audio Intercept</option>
                  <option value="DOCUMENT">Official Document</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Intelligence Source Agency</label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
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
                  className="w-full px-3 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-300 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-[#1f1f28]">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 bg-[#17171f] hover:bg-[#20202b] text-slate-300 border border-[#262633] rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2.5 bg-[#6D4AFF] hover:bg-[#7C5CFC] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#6D4AFF]/30 transition cursor-pointer disabled:opacity-50"
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
