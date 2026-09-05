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
      formData.append('title', evidenceTitle);
      formData.append('type', evidenceType);

      await apiClient.post('/evidence/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

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
      <div className="p-6 bg-[#111114] border border-[#1f1f28] rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono font-bold text-[#6D4AFF] bg-[#6D4AFF]/10 px-2.5 py-1 rounded-md border border-[#6D4AFF]/20">
                {caseData.caseNumber}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                {caseData.status}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                {caseData.priority} PRIORITY
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-100 mt-2">{caseData.title}</h1>
            <p className="text-xs text-slate-400 mt-1">{caseData.description || 'No case description provided.'}</p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-[#0a0a0c] p-3 rounded-xl border border-[#262633] shrink-0">
            <Shield className="w-4 h-4 text-[#6D4AFF]" />
            <div>
              <p className="font-semibold text-slate-200">Investigator Lead</p>
              <p>{caseData.createdBy?.name} ({caseData.createdBy?.email})</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 border-b border-[#1f1f28] pt-2 text-xs">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-mono font-semibold transition cursor-pointer ${
              activeTab === 'evidence'
                ? 'border-[#6D4AFF] text-[#6D4AFF]'
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
                ? 'border-[#6D4AFF] text-[#6D4AFF]'
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
                ? 'border-[#6D4AFF] text-[#6D4AFF]'
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
                ? 'border-[#6D4AFF] text-[#6D4AFF]'
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
                className="flex items-center space-x-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Evidence File</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {caseData.evidence?.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-slate-500 text-sm">
                No evidence files uploaded for this case yet.
              </div>
            ) : (
              caseData.evidence?.map((ev: any) => (
                <div
                  key={ev.id}
                  className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-slate-800 rounded-xl text-blue-400">
                      <FileCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{ev.title}</h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                        <span className="font-mono">{ev.fileName}</span>
                        <span>•</span>
                        <span>{ev.type}</span>
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
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      <span>NLP Processing & Entities</span>
                    </button>

                    <button
                      onClick={() => handleDownloadEvidence(ev.id, ev.fileName)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400" />
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
                className="flex items-center space-x-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add / Link Entity</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {caseData.caseEntities?.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-slate-500 text-sm md:col-span-2">
                No entities linked to this case.
              </div>
            ) : (
              caseData.caseEntities?.map((ce: any) => (
                <div key={ce.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {ce.entity.type}
                    </span>
                    <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Role: {ce.role}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-100">{ce.entity.displayName || ce.entity.canonicalValue}</h4>
                  <p className="text-xs font-mono text-slate-400">Value: {ce.entity.canonicalValue}</p>
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
                className="flex items-center space-x-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Timeline Event</span>
              </button>
            )}
          </div>

          <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-800">
            {caseData.events?.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-slate-500 text-sm">
                No events recorded in this case timeline.
              </div>
            ) : (
              caseData.events?.map((ev: any) => (
                <div key={ev.id} className="relative pl-9 p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                  <div className="absolute left-2.5 top-5 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-950" />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono font-semibold text-blue-400">{new Date(ev.timestamp).toLocaleString()}</span>
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[11px]">{ev.type}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-100">{ev.description}</p>
                  <p className="text-xs text-slate-500">Source: {ev.source?.name}</p>
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
              <div key={asg.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center space-x-3">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{asg.user?.name}</h4>
                  <p className="text-xs text-slate-400">{asg.user?.role} • Assigned on {new Date(asg.assignedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Evidence Type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm"
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

              <div>
                <label className="text-slate-300 font-medium block mb-1">Intelligence Source</label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm"
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModal(false)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-3.5 py-2 bg-blue-600 text-white rounded-lg font-semibold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Add & Link Entity to Case</h3>
            <form onSubmit={handleCreateAndLinkEntity} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Entity Type</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm"
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Case Role</label>
                <select
                  value={entityRole}
                  onChange={(e) => setEntityRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm"
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
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkingEntity}
                  className="px-3.5 py-2 bg-blue-600 text-white rounded-lg font-semibold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Timestamp</label>
                <input
                  type="datetime-local"
                  required
                  value={eventTimestamp}
                  onChange={(e) => setEventTimestamp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm"
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEventModal(false)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingEvent}
                  className="px-3.5 py-2 bg-blue-600 text-white rounded-lg font-semibold"
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
