import React, { useState, useEffect } from 'react';
import {
  FileText,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  X,
  Play,
  Zap,
  Info
} from 'lucide-react';
import { apiClient, unwrapData, safeArray } from '../api/client';

interface EvidenceProcessingViewProps {
  evidenceId: string;
  onClose: () => void;
  onRefreshCase?: () => void;
}

export const EvidenceProcessingView: React.FC<EvidenceProcessingViewProps> = ({
  evidenceId,
  onClose,
  onRefreshCase,
}) => {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [evidence, setEvidence] = useState<any>(null);
  const [document, setDocument] = useState<any>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [mentions, setMentions] = useState<any[]>([]);
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(0);
  const [activeSubTab, setActiveSubTab] = useState<'entities' | 'text' | 'chunks'>('entities');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProcessingDetails = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch base evidence status
      const evRes = await apiClient.get(`/evidence/${evidenceId}`);
      const evData = unwrapData<any>(evRes.data) || evRes.data;
      setEvidence(evData);

      // 2. Fetch extracted text document if available
      try {
        const docRes = await apiClient.get(`/evidence/${evidenceId}/extracted-text`);
        const docData = unwrapData<any>(docRes.data) || docRes.data?.data || docRes.data;
        setDocument(docData);
      } catch {
        setDocument(null);
      }

      // 3. Fetch chunks
      try {
        const chunkRes = await apiClient.get(`/evidence/${evidenceId}/chunks`);
        const chunkList = safeArray(chunkRes.data, 'chunks');
        setChunks(chunkList);
      } catch {
        setChunks([]);
      }

      // 4. Fetch entity mentions
      try {
        const mentionRes = await apiClient.get(`/evidence/${evidenceId}/entity-mentions`);
        const mentionList = safeArray(mentionRes.data, 'mentions', 'entityMentions');
        setMentions(mentionList);
      } catch {
        setMentions([]);
      }
    } catch (err: any) {
      console.error('Failed to load evidence details', err);
      setErrorMsg(err.response?.data?.error || 'Failed to load processing details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcessingDetails();
  }, [evidenceId]);

  const handleTriggerProcessing = async () => {
    setProcessing(true);
    setErrorMsg(null);
    try {
      await apiClient.post(`/evidence/${evidenceId}/process`);
      await fetchProcessingDetails();
      if (onRefreshCase) onRefreshCase();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Ingestion processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>COMPLETED</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30 rounded-full text-xs font-semibold font-mono">
            <Cpu className="w-3.5 h-3.5 animate-spin text-[#B026FF]" />
            <span>PROCESSING</span>
          </span>
        );
      case 'OCR_REQUIRED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-full text-xs font-semibold font-mono">
            <Zap className="w-3.5 h-3.5" />
            <span>OCR REQUIRED</span>
          </span>
        );
      case 'UNSUPPORTED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full text-xs font-semibold font-mono">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>UNSUPPORTED FORMAT</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 bg-[#DC2626]/15 text-[#EF4444] border border-[#DC2626]/30 rounded-full text-xs font-semibold font-mono">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>FAILED</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800/60 text-slate-400 border border-slate-700/60 rounded-full text-xs font-semibold font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>PENDING</span>
          </span>
        );
    }
  };

  const getMethodBadge = (method: string) => {
    if (method === 'RULE') {
      return <span className="px-2 py-0.5 bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30 text-[10px] font-mono rounded">RULE</span>;
    }
    if (method === 'NER') {
      return <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono rounded">NER</span>;
    }
    return <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-mono rounded">AI</span>;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="p-8 tx-panel corner-bracket text-center space-y-3 border border-[rgba(139,92,246,0.3)]">
          <Cpu className="w-8 h-8 text-[#B026FF] animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-300 font-mono">Loading evidence processing dossier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl tx-panel corner-bracket-full border border-[rgba(139,92,246,0.3)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-[#0D0A12] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.35)] text-[#B026FF] rounded-xl shadow-md shadow-[#DC2626]/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-tight">{evidence?.title}</h2>
                {getStatusBadge(evidence?.processingStatus || 'PENDING')}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{evidence?.fileName} • {evidence?.mimeType}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleTriggerProcessing}
              disabled={processing}
              className="tx-btn-primary flex items-center space-x-2 px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
              <span>{processing ? 'Processing Pipeline...' : 'Run Automated NLP Pipeline'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white tx-btn-secondary rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#111019]">
          {errorMsg && (
            <div className="p-4 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl flex items-center space-x-3 text-[#EF4444] text-xs font-mono">
              <AlertTriangle className="w-5 h-5 shrink-0 text-[#EF4444]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Evidence Metadata & Processing Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 tx-panel-elevated space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block font-mono">SHA-256 Checksum</span>
              <p className="text-xs font-mono font-semibold text-slate-200 truncate">{evidence?.hash || 'Not computed'}</p>
            </div>

            <div className="p-4 tx-panel-elevated space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block font-mono">Pages & Word Count</span>
              <p className="text-xs font-mono font-semibold text-slate-200">
                {document?.pageCount || 1} Pages • {document?.wordCount || 0} Words
              </p>
            </div>

            <div className="p-4 tx-panel-elevated space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block font-mono">Text Chunks</span>
              <p className="text-xs font-mono font-semibold text-[#B026FF]">{chunks.length} Chunks</p>
            </div>

            <div className="p-4 tx-panel-elevated space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block font-mono">Extracted Mentions</span>
              <p className="text-xs font-mono font-semibold text-emerald-400">{mentions.length} Mentions</p>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-white/[0.08] space-x-4 text-xs font-semibold font-mono">
            <button
              onClick={() => setActiveSubTab('entities')}
              className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center space-x-2 ${
                activeSubTab === 'entities' ? 'border-[#7C3AED] text-[#B026FF]' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Extracted Entities ({mentions.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('chunks')}
              className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center space-x-2 ${
                activeSubTab === 'chunks' ? 'border-[#7C3AED] text-[#B026FF]' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Document Chunks ({chunks.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('text')}
              className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center space-x-2 ${
                activeSubTab === 'text' ? 'border-[#7C3AED] text-[#B026FF]' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Extracted Full Text</span>
            </button>
          </div>

          {/* Sub-Tab 1: Extracted Entities Table */}
          {activeSubTab === 'entities' && (
            <div className="space-y-3">
              {mentions.length === 0 ? (
                <div className="p-8 text-center tx-panel text-slate-500 text-xs font-mono">
                  No entities extracted yet. Click "Run Automated NLP Pipeline" to analyze this evidence document.
                </div>
              ) : (
                <div className="overflow-x-auto border border-white/[0.08] rounded-xl tx-panel-elevated">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#0D0A12] text-slate-400 font-mono text-[11px] border-b border-white/[0.08]">
                      <tr>
                        <th className="p-3">Entity Name</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Normalized Value</th>
                        <th className="p-3">Confidence</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Provenance Span</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] font-mono">
                      {mentions.map((m: any) => (
                        <tr key={m.id} className="hover:bg-white/[0.03] transition">
                          <td className="p-3 font-semibold text-slate-100 font-sans">{m.originalText}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30 text-[10px] rounded">
                              {m.entity?.type || 'OTHER'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">{m.entity?.normalizedValue || m.originalText}</td>
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${Math.round((m.extractionConfidence || 0.9) * 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {Math.round((m.extractionConfidence || 0.9) * 100)}%
                              </span>
                            </div>
                          </td>
                          <td className="p-3">{getMethodBadge(m.extractionMethod)}</td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            [{m.startOffset ?? 0}..{m.endOffset ?? 0}]
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 2: Document Chunks Viewer */}
          {activeSubTab === 'chunks' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Chunk Selector */}
              <div className="space-y-2 md:col-span-1">
                <span className="text-xs font-semibold text-slate-300 block font-mono">Select Chunk ({chunks.length})</span>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {chunks.map((c: any, index: number) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedChunkIndex(index)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition cursor-pointer ${
                        selectedChunkIndex === index
                          ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-slate-100 font-semibold shadow-md shadow-[#7C3AED]/10'
                          : 'tx-panel-elevated border-white/[0.06] text-slate-400 hover:border-[rgba(139,92,246,0.3)]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono text-[#B026FF]">Chunk #{c.chunkIndex + 1}</span>
                        <span className="text-[10px] text-slate-500">[{c.startOffset}..{c.endOffset}]</span>
                      </div>
                      <p className="text-[11px] line-clamp-2 text-slate-400 font-mono">{c.text}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chunk Detail Text */}
              <div className="md:col-span-2 p-4 tx-panel-elevated border border-white/[0.08] space-y-3 font-mono text-xs text-slate-300 whitespace-pre-wrap">
                {chunks[selectedChunkIndex] ? (
                  <>
                    <div className="flex justify-between items-center text-slate-400 border-b border-white/[0.08] pb-2 text-[11px]">
                      <span>Showing Chunk #{chunks[selectedChunkIndex].chunkIndex + 1}</span>
                      <span>Length: {chunks[selectedChunkIndex].text.length} chars</span>
                    </div>
                    <p className="leading-relaxed text-slate-200">{chunks[selectedChunkIndex].text}</p>
                  </>
                ) : (
                  <p className="text-slate-500">No chunk selected.</p>
                )}
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Extracted Full Text */}
          {activeSubTab === 'text' && (
            <div className="p-4 tx-panel-elevated border border-white/[0.08] max-h-96 overflow-y-auto text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
              {document?.normalizedText || document?.originalText || 'No extracted text document recorded.'}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#0D0A12] border-t border-white/[0.08] flex justify-between items-center text-xs text-slate-500 font-mono">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-[#B026FF]" />
            <span>TRACE-X Intelligence Pipeline v1.0 • Neo4j Provenance Synchronized</span>
          </div>
          <button
            onClick={onClose}
            className="tx-btn-secondary px-4 py-2 font-semibold cursor-pointer text-slate-200"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
