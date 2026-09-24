import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Search,
  RefreshCw,
  Download,
  FileCode,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiClient, safeArray } from '../api/client';

interface EvidenceRepositoryViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole?: string;
}

export const EvidenceRepositoryView: React.FC<EvidenceRepositoryViewProps> = () => {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterCase, setFilterCase] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // Upload modal
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadCaseId, setUploadCaseId] = useState('');
  const [uploadSourceId, setUploadSourceId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('LOG');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchEvidence = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/evidence');
      const list = safeArray(res.data, 'evidence', 'items');
      setEvidenceList(list);
    } catch (err: any) {
      console.error('Failed to load evidence repository', err);
      setError(err.userMessage || 'Failed to fetch evidence repository.');
      setEvidenceList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetaData = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        apiClient.get('/cases'),
        apiClient.get('/sources'),
      ]);
      const caseArr = safeArray<any>(cRes.data, 'cases');
      const sourceArr = safeArray<any>(sRes.data, 'sources');
      setCases(caseArr);
      setSources(sourceArr);
      if (caseArr[0]) setUploadCaseId(caseArr[0].id);
      if (sourceArr[0]) setUploadSourceId(sourceArr[0].id);
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  };

  useEffect(() => {
    fetchEvidence();
    fetchMetaData();
  }, []);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadCaseId || !uploadSourceId) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('caseId', uploadCaseId);
      formData.append('sourceId', uploadSourceId);
      formData.append('title', uploadTitle);
      // Ensure mapped to valid Prisma EvidenceType
      const typeMapping: Record<string, string> = {
        CDR: 'LOG',
        IP_LOG: 'LOG',
        BANK_STATEMENT: 'TRANSACTION',
        CHAT_EXPORT: 'DOCUMENT',
      };
      const validEvidenceType = typeMapping[uploadType] || uploadType;
      formData.append('type', validEvidenceType);

      await apiClient.post('/evidence/upload', formData);

      setUploadModal(false);
      setUploadTitle('');
      setUploadFile(null);
      fetchEvidence();
    } catch (err: any) {
      console.error('Upload failed', err);
      alert(err.userMessage || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (id: string, fileName: string) => {
    apiClient.get(`/evidence/${id}/download`, { responseType: 'blob' })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((err: any) => {
        alert(err.userMessage || 'Download failed');
      });
  };

  // Filtered items
  const safeEvidenceList = Array.isArray(evidenceList) ? evidenceList : [];
  const filteredEvidence = safeEvidenceList.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.hash.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || item.type === filterType;
    const matchesCase = filterCase === 'ALL' || item.caseId === filterCase;
    return matchesSearch && matchesType && matchesCase;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel corner-bracket p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#DC2626]/40 to-[#B026FF]/40 pointer-events-none" />
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#DC2626]/15 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.35)] text-[#B026FF] rounded-xl shadow-md shadow-[#DC2626]/10">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">EVIDENCE REPOSITORY</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Secure chain-of-custody vault with SHA-256 integrity verification, automated NLP parsing, and entity extraction.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchEvidence}
            className="tx-btn-secondary p-2.5 text-xs font-semibold cursor-pointer"
            title="Refresh Evidence Vault"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setUploadModal(true)}
            className="tx-btn-primary flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>UPLOAD EVIDENCE</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl text-[#EF4444] text-xs font-mono">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tx-panel p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by title, file name, or SHA-256 hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tx-input w-full pl-9 pr-4 py-2 text-xs"
          />
        </div>

        <div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="tx-input w-full px-3.5 py-2 text-xs"
          >
            <option value="ALL">All Evidence Types</option>
            <option value="CDR">CDR Log</option>
            <option value="BANK_STATEMENT">Bank Statement</option>
            <option value="CHAT_EXPORT">Chat Export</option>
            <option value="IP_LOG">IP Log</option>
            <option value="IMAGE">Image</option>
            <option value="AUDIO">Audio Intercept</option>
            <option value="DOCUMENT">Official Document</option>
          </select>
        </div>

        <div>
          <select
            value={filterCase}
            onChange={(e) => setFilterCase(e.target.value)}
            className="tx-input w-full px-3.5 py-2 text-xs"
          >
            <option value="ALL">All Associated Cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.caseNumber} - {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Repository Table */}
      <div className="tx-panel overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#B026FF] animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Loading encrypted evidence records...</p>
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No Evidence Records Found</p>
            <p className="text-xs text-slate-500 font-mono">Try adjusting search parameters or upload new evidence.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0D0A12] border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Title / File</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Associated Case</th>
                  <th className="py-3.5 px-4">Source Agency</th>
                  <th className="py-3.5 px-4">SHA-256 Hash</th>
                  <th className="py-3.5 px-4">Uploaded</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredEvidence.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/[0.03] transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-[#7C3AED]/15 text-[#B026FF] rounded-lg">
                          <FileCode className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100">{ev.title}</p>
                          <p className="text-[11px] font-mono text-slate-400">{ev.fileName}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <span className="px-2 py-0.5 bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30 rounded">
                        {ev.type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#B026FF]">
                      {ev.case?.caseNumber || ev.caseId}
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      {ev.source?.name || 'Direct Intercept'}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 max-w-[150px] truncate" title={ev.hash}>
                      {ev.hash}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {new Date(ev.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDownload(ev.id, ev.fileName)}
                        className="tx-btn-secondary flex items-center space-x-1 px-3 py-1 text-[11px] font-mono cursor-pointer ml-auto hover:text-[#B026FF]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md tx-panel corner-bracket border border-[rgba(139,92,246,0.3)] p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-mono font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <Upload className="w-4 h-4 text-[#B026FF]" />
              <span>UPLOAD EVIDENCE TO VAULT</span>
            </h3>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Evidence Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Target Suspect WhatsApp Export"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Evidence Category</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-xs"
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

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Target Case Dossier</label>
                <select
                  value={uploadCaseId}
                  onChange={(e) => setUploadCaseId(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-xs"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseNumber} - {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Intelligence Source</label>
                <select
                  value={uploadSourceId}
                  onChange={(e) => setUploadSourceId(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-xs"
                >
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">File Document</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="tx-input w-full px-3 py-2 text-xs text-slate-300 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setUploadModal(false)}
                  className="tx-btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="tx-btn-primary flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Processing Hash...' : 'Upload & Compute Hash'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
