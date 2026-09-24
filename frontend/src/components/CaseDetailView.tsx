import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Users,
  Plus,
  Shield,
  Upload,
  Download,
  FileCode,
  Tag,
  Clock,
  Sparkles
} from 'lucide-react';
import { apiClient } from '../api/client';
import { EvidenceProcessingView } from './EvidenceProcessingView';

interface CaseDetailViewProps {
  caseId: string;
  onBack: () => void;
  userRole: string;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({ caseId, onBack, userRole }) => {
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'evidence' | 'entities' | 'events' | 'assignments'>('evidence');
  const [sources, setSources] = useState<any[]>([]);

  // Modals / forms state
  const [uploadModal, setUploadModal] = useState(false);
  const [entityModal, setEntityModal] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [selectedEvidenceForProcessingId, setSelectedEvidenceForProcessingId] = useState<string | null>(null);

  // Evidence upload form
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceType, setEvidenceType] = useState('CDR');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Entity link form
  const [entityType, setEntityType] = useState('PHONE');
  const [canonicalValue, setCanonicalValue] = useState('');
  const [entityRole, setEntityRole] = useState('SUSPECT');
  const [linkingEntity, setLinkingEntity] = useState(false);

  // Event form
  const [eventType, setEventType] = useState('COMMUNICATION_INTERCEPT');
  const [eventDescription, setEventDescription] = useState('');
  const [eventTimestamp, setEventTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [creatingEvent, setCreatingEvent] = useState(false);

  const fetchCaseDetails = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/cases/${caseId}`);
      setCaseData(res.data);
    } catch (err) {
      console.error('Failed to fetch case details', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSources = async () => {
    try {
      const res = await apiClient.get('/sources');
      setSources(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedSourceId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch sources', err);
    }
  };

  useEffect(() => {
    fetchCaseDetails();
    fetchSources();
  }, [caseId]);

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedSourceId) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('caseId', caseId);
      formData.append('sourceId', selectedSourceId);
      const typeMapping: Record<string, string> = {
        CDR: 'LOG',
        IP_LOG: 'LOG',
        BANK_STATEMENT: 'TRANSACTION',
        CHAT_EXPORT: 'DOCUMENT',
      };
      const validEvidenceType = typeMapping[evidenceType] || evidenceType;
      formData.append('type', validEvidenceType);

      await apiClient.post('/evidence/upload', formData);

      setUploadModal(false);
      setEvidenceTitle('');
      setSelectedFile(null);
      fetchCaseDetails();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateAndLinkEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkingEntity(true);
    try {
      // 1. Create entity
      const entityRes = await apiClient.post('/entities', {
        type: entityType,
        canonicalValue,
      });

      // 2. Link entity to case
      await apiClient.post('/entities/link-case', {
        caseId,
        entityId: entityRes.data.id,
        role: entityRole,
        confidence: 0.95,
      });

      setEntityModal(false);
      setCanonicalValue('');
      fetchCaseDetails();
    } catch (err) {
      console.error('Failed to link entity', err);
    } finally {
      setLinkingEntity(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSourceId) return;
    setCreatingEvent(true);
    try {
      await apiClient.post('/events', {
        caseId,
        sourceId: selectedSourceId,
        type: eventType,
        description: eventDescription,
        timestamp: new Date(eventTimestamp).toISOString(),
      });

      setEventModal(false);
      setEventDescription('');
      fetchCaseDetails();
    } catch (err) {
      console.error('Failed to log event', err);
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleDownloadEvidence = async (evidenceId: string, fileName: string) => {
    try {
      const response = await apiClient.get(`/evidence/${evidenceId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  if (loading || !caseData) {
    return <div className="p-12 text-center text-slate-400">Loading investigation workspace...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-sm text-slate-400 hover:text-slate-200 transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Case Dashboard</span>
      </button>

      {/* Case Header Banner */}
      <div className="p-6 tx-panel corner-bracket space-y-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#DC2626]/40 to-[#B026FF]/40 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono font-bold text-[#B026FF] bg-[#7C3AED]/15 px-2.5 py-1 rounded-md border border-[#7C3AED]/30">
                {caseData.caseNumber}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                {caseData.status}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                {caseData.priority} PRIORITY
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-100 mt-2 tracking-tight">{caseData.title}</h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">{caseData.description || 'No case description provided.'}</p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 tx-panel-elevated p-3 rounded-xl shrink-0">
            <Shield className="w-4 h-4 text-[#B026FF]" />
            <div>
              <p className="font-semibold text-slate-200">Investigator Lead</p>
              <p className="font-mono text-slate-400">{caseData.createdBy?.name} ({caseData.createdBy?.email})</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 border-b border-white/[0.08] pt-2 text-xs">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-mono font-semibold transition cursor-pointer ${
              activeTab === 'evidence'
                ? 'border-[#7C3AED] text-[#B026FF]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Evidence ({caseData._count?.evidence || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('entities')}
            className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-mono font-semibold transition cursor-pointer ${
              activeTab === 'entities'
                ? 'border-[#7C3AED] text-[#B026FF]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Entities ({caseData._count?.caseEntities || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-mono font-semibold transition cursor-pointer ${
              activeTab === 'events'
                ? 'border-[#7C3AED] text-[#B026FF]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Timeline Events ({caseData._count?.events || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-mono font-semibold transition cursor-pointer ${
              activeTab === 'assignments'
                ? 'border-[#7C3AED] text-[#B026FF]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Assignees ({caseData.assignments?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Tab Content Panels */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-200">Registered Evidence Records</h3>
            {userRole !== 'ANALYST' && (
              <button
                onClick={() => setUploadModal(true)}
                className="tx-btn-primary flex items-center space-x-2 px-3.5 py-2 text-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Evidence File</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {caseData.evidence?.length === 0 ? (
              <div className="p-8 text-center tx-panel text-slate-500 text-sm font-mono">
                No evidence files uploaded for this case yet.
              </div>
            ) : (
              caseData.evidence?.map((ev: any) => (
                <div
                  key={ev.id}
                  className="p-4 tx-panel-elevated flex items-center justify-between hover:border-[rgba(139,92,246,0.3)] transition"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-br from-[#DC2626]/15 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.3)] rounded-xl text-[#B026FF]">
                      <FileCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{ev.title}</h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5 font-mono">
                        <span className="text-slate-300">{ev.fileName}</span>
                        <span>•</span>
                        <span className="text-[#B026FF]">{ev.type}</span>
                        <span>•</span>
                        <span>Source: {ev.source?.name}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center space-x-1">
                        <span>SHA-256:</span>
                        <span className="text-slate-400">{ev.hash}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedEvidenceForProcessingId(ev.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#7C3AED]/15 hover:bg-[#7C3AED]/25 text-[#B026FF] border border-[#7C3AED]/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#B026FF]" />
                      <span>NLP Processing & Entities</span>
                    </button>

                    <button
                      onClick={() => handleDownloadEvidence(ev.id, ev.fileName)}
                      className="tx-btn-secondary flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'entities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-200">Associated Entities</h3>
            {userRole !== 'ANALYST' && (
              <button
                onClick={() => setEntityModal(true)}
                className="tx-btn-primary flex items-center space-x-2 px-3.5 py-2 text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add / Link Entity</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {caseData.caseEntities?.length === 0 ? (
              <div className="p-8 text-center tx-panel text-slate-500 text-sm md:col-span-2 font-mono">
                No entities linked to this case.
              </div>
            ) : (
              caseData.caseEntities?.map((ce: any) => (
                <div key={ce.id} className="p-4 tx-panel-elevated space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-[#B026FF] bg-[#7C3AED]/15 px-2 py-0.5 rounded border border-[#7C3AED]/30">
                      {ce.entity.type}
                    </span>
                    <span className="text-xs font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                      Role: {ce.role}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-100">{ce.entity.displayName || ce.entity.canonicalValue}</h4>
                  <p className="text-xs font-mono text-slate-400">Value: <span className="text-slate-200">{ce.entity.canonicalValue}</span></p>
                  <p className="text-xs font-mono text-slate-500">Normalized: {ce.entity.normalizedValue}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-200">Chronological Event Timeline</h3>
            {userRole !== 'ANALYST' && (
              <button
                onClick={() => setEventModal(true)}
                className="tx-btn-primary flex items-center space-x-2 px-3.5 py-2 text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Timeline Event</span>
              </button>
            )}
          </div>

          <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-white/[0.08]">
            {caseData.events?.length === 0 ? (
              <div className="p-8 text-center tx-panel text-slate-500 text-sm font-mono">
                No events recorded in this case timeline.
              </div>
            ) : (
              caseData.events?.map((ev: any) => (
                <div key={ev.id} className="relative pl-9 p-4 tx-panel-elevated space-y-1">
                  <div className="absolute left-2.5 top-5 w-3 h-3 bg-[#EF4444] rounded-full border-2 border-[#08070B] shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono font-semibold text-[#B026FF]">{new Date(ev.timestamp).toLocaleString()}</span>
                    <span className="px-2 py-0.5 bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30 rounded text-[11px] font-mono">{ev.type}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-100">{ev.description}</p>
                  <p className="text-xs text-slate-500 font-mono">Source: {ev.source?.name}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Assigned Case Team</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {caseData.assignments?.map((asg: any) => (
              <div key={asg.id} className="p-4 tx-panel-elevated flex items-center space-x-3">
                <div className="p-2.5 bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#B026FF] rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{asg.user?.name}</h4>
                  <p className="text-xs text-slate-400 font-mono">{asg.user?.role} • Assigned {new Date(asg.assignedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md tx-panel corner-bracket p-6 shadow-2xl space-y-4 border border-[rgba(139,92,246,0.3)]">
            <h3 className="text-lg font-bold text-slate-100">Upload Evidence Record</h3>
            <form onSubmit={handleUploadEvidence} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Evidence Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call Detail Record Extract"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Evidence Type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm"
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

              <div>
                <label className="text-slate-300 font-medium block mb-1">Intelligence Source</label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm"
                >
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Select File</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="tx-input w-full px-3 py-2 text-xs text-slate-300 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModal(false)}
                  className="tx-btn-secondary px-3.5 py-2 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="tx-btn-primary px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload & Compute Hash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entity Modal */}
      {entityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md tx-panel corner-bracket p-6 shadow-2xl space-y-4 border border-[rgba(139,92,246,0.3)]">
            <h3 className="text-lg font-bold text-slate-100">Add & Link Entity to Case</h3>
            <form onSubmit={handleCreateAndLinkEntity} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Entity Type</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm"
                >
                  <option value="PHONE">Phone Number</option>
                  <option value="EMAIL">Email Address</option>
                  <option value="PERSON">Person / Alias</option>
                  <option value="BANK_ACCOUNT">Bank Account</option>
                  <option value="CRYPTO_WALLET">Crypto Wallet</option>
                  <option value="LOCATION">Location</option>
                  <option value="VEHICLE">Vehicle Number</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Canonical Value</label>
                <input
                  type="text"
                  required
                  placeholder="+919876543210 or target@domain.com"
                  value={canonicalValue}
                  onChange={(e) => setCanonicalValue(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Case Role</label>
                <select
                  value={entityRole}
                  onChange={(e) => setEntityRole(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm"
                >
                  <option value="PRIMARY_SUSPECT">Primary Suspect</option>
                  <option value="CO_CONSPIRATOR">Co-Conspirator</option>
                  <option value="VICTIM">Victim</option>
                  <option value="WITNESS">Witness</option>
                  <option value="RELAY_NODE">Relay Node</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEntityModal(false)}
                  className="tx-btn-secondary px-3.5 py-2 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkingEntity}
                  className="tx-btn-primary px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {linkingEntity ? 'Linking...' : 'Link Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {eventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md tx-panel corner-bracket p-6 shadow-2xl space-y-4 border border-[rgba(139,92,246,0.3)]">
            <h3 className="text-lg font-bold text-slate-100">Log Timeline Event</h3>
            <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Event Type</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CDR_CALL_INTERCEPT"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Timestamp</label>
                <input
                  type="datetime-local"
                  required
                  value={eventTimestamp}
                  onChange={(e) => setEventTimestamp(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Description</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Details of the event..."
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEventModal(false)}
                  className="tx-btn-secondary px-3.5 py-2 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingEvent}
                  className="tx-btn-primary px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {creatingEvent ? 'Saving...' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Evidence Processing & Entities Detail Modal */}
      {selectedEvidenceForProcessingId && (
        <EvidenceProcessingView
          evidenceId={selectedEvidenceForProcessingId}
          onClose={() => setSelectedEvidenceForProcessingId(null)}
          onRefreshCase={fetchCaseDetails}
        />
      )}
    </div>
  );
};
