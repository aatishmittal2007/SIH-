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
import { apiClient, unwrapData } from '../api/client';

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
  const [uploadType, setUploadType] = useState('CDR');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchEvidence = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/evidence');
      const data = unwrapData(res);
      const list = Array.isArray(data) ? data : (Array.isArray(res.data) ? res.data : (res.data?.evidence || res.data?.items || []));
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
      const cData = unwrapData(cRes);
      const sData = unwrapData(sRes);
      const caseArr = Array.isArray(cData) ? cData : (Array.isArray(cRes.data) ? cRes.data : []);
      const sourceArr = Array.isArray(sData) ? sData : (Array.isArray(sRes.data) ? sRes.data : []);
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
      formData.append('type', uploadType);

      await apiClient.post('/evidence/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#6D4AFF]/20 border border-[#6D4AFF]/40 text-[#6D4AFF] rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">EVIDENCE REPOSITORY</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Secure chain-of-custody vault with SHA-256 integrity verification, automated NLP parsing, and entity extraction.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchEvidence}
            className="p-2.5 bg-[#17171f] hover:bg-[#20202b] text-slate-300 border border-[#262633] rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setUploadModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-[#6D4AFF] hover:bg-[#7C5CFC] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#6D4AFF]/30 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>UPLOAD EVIDENCE</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#111114] border border-[#1f1f28] p-4 rounded-2xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by title, file name, or SHA-256 hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#6D4AFF]"
          />
        </div>

        <div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3.5 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-300 focus:outline-none focus:border-[#6D4AFF]"
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
            className="w-full px-3.5 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-300 focus:outline-none focus:border-[#6D4AFF]"
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
      <div className="bg-[#111114] border border-[#1f1f28] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#6D4AFF] animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Loading encrypted evidence records...</p>
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No Evidence Records Found</p>
            <p className="text-xs text-slate-500">Try adjusting search parameters or upload new evidence.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0a0a0c] border-b border-[#1f1f28] text-slate-400 font-mono uppercase text-[11px]">
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
              <tbody className="divide-y divide-[#1f1f28]/60">
                {filteredEvidence.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#14141c] transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-[#171725] text-[#6D4AFF] rounded-lg">
                          <FileCode className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100">{ev.title}</p>
                          <p className="text-[11px] font-mono text-slate-400">{ev.fileName}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <span className="px-2 py-0.5 bg-[#171725] border border-[#262638] text-slate-300 rounded">
                        {ev.type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-cyan-400">
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
                        className="flex items-center space-x-1 px-3 py-1 bg-[#6D4AFF]/10 hover:bg-[#6D4AFF]/20 text-[#a38cff] border border-[#6D4AFF]/30 rounded-lg text-[11px] font-mono transition cursor-pointer ml-auto"
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
          <div className="w-full max-w-md bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-mono font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <Upload className="w-4 h-4 text-[#6D4AFF]" />
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
                  className="w-full px-3 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Evidence Category</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
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

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Target Case Dossier</label>
                <select
                  value={uploadCaseId}
                  onChange={(e) => setUploadCaseId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
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
                  className="w-full px-3 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#6D4AFF]"
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
                  className="w-full px-3 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-300 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#1f1f28]">
                <button
                  type="button"
                  onClick={() => setUploadModal(false)}
                  className="px-4 py-2 bg-[#17171f] hover:bg-[#20202b] text-slate-300 border border-[#262633] rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-[#6D4AFF] hover:bg-[#7C5CFC] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#6D4AFF]/30 transition cursor-pointer disabled:opacity-50"
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
