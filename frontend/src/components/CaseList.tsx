import React, { useState, useEffect } from 'react';
import { Search, Plus, FolderKanban } from 'lucide-react';
import { apiClient, safeArray } from '../api/client';

interface CaseItem {
  id: string;
  caseNumber: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  createdBy: { name: string; email: string };
  _count: { evidence: number; caseEntities: number; events: number; contradictions: number };
}

interface CaseListProps {
  onSelectCase: (caseId: string) => void;
  userRole: string;
}

export const CaseList: React.FC<CaseListProps> = ({ onSelectCase, userRole }) => {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Create Case Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [caseNumber, setCaseNumber] = useState(`CAS-${Math.floor(100000 + Math.random() * 900000)}`);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const res = await apiClient.get('/cases', { params });
      setCases(safeArray(res.data, 'cases'));
    } catch (err: any) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [search, statusFilter, priorityFilter]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      await apiClient.post('/cases', {
        caseNumber,
        title,
        description,
        priority,
      });

      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setCaseNumber(`CAS-${Math.floor(100000 + Math.random() * 900000)}`);
      fetchCases();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'CRITICAL':
        return 'bg-[#DC2626]/15 text-[#EF4444] border-[#DC2626]/30';
      case 'HIGH':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-[#7C3AED]/15 text-[#8B5CF6] border-[#7C3AED]/30';
      default:
        return 'bg-slate-800/40 text-slate-400 border-slate-700/40';
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'OPEN':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'IN_PROGRESS':
        return 'bg-[#7C3AED]/15 text-[#B026FF] border-[#7C3AED]/30';
      case 'CLOSED':
        return 'bg-slate-800/40 text-slate-400 border-slate-700/40';
      case 'ARCHIVED':
        return 'bg-purple-900/20 text-purple-400 border-purple-800/30';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center space-x-2.5">
            <FolderKanban className="w-6 h-6 text-[#B026FF]" />
            <span className="tracking-tight">Active Investigation Cases</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">Scoped to user clearance: <span className="text-[#B026FF] font-semibold">{userRole}</span></p>
        </div>

        {userRole !== 'ANALYST' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="tx-btn-primary flex items-center space-x-2 px-4 py-2.5 text-sm cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation Case</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 tx-panel p-4">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by case number or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="tx-input w-full pl-9 pr-3 py-2 text-sm"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="tx-input w-full px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="CLOSED">Closed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="tx-input w-full px-3 py-2 text-sm"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Cases List Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="p-12 tx-panel text-center space-y-2">
          <p className="text-slate-300 font-medium">No investigation cases found</p>
          <p className="text-xs text-slate-500">Try adjusting search filters or create a new case.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cases.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelectCase(c.id)}
              className="tx-panel corner-bracket hover:bg-[#15121C]/90 hover:border-[rgba(176,38,255,0.4)] p-5 space-y-4 transition cursor-pointer group shadow-lg shadow-black/40 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B026FF]/30 to-transparent pointer-events-none" />
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono text-[#B026FF] font-semibold tracking-wider">{c.caseNumber}</span>
                  <h3 className="text-lg font-semibold text-slate-100 group-hover:text-[#B026FF] transition">
                    {c.title}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 text-xs font-semibold border rounded-full ${getStatusBadge(c.status)}`}>
                    {c.status}
                  </span>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold border rounded-full ${getPriorityColor(c.priority)}`}>
                    {c.priority}
                  </span>
                </div>
              </div>

              {c.description && <p className="text-xs text-slate-400 line-clamp-2">{c.description}</p>}

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/[0.06] text-xs">
                <div className="bg-[#0D0A12] border border-white/[0.04] p-2 rounded-lg text-center">
                  <span className="block text-slate-400 text-[11px]">Evidence</span>
                  <span className="font-semibold text-slate-200 font-mono">{c._count?.evidence || 0}</span>
                </div>
                <div className="bg-[#0D0A12] border border-white/[0.04] p-2 rounded-lg text-center">
                  <span className="block text-slate-400 text-[11px]">Entities</span>
                  <span className="font-semibold text-[#B026FF] font-mono">{c._count?.caseEntities || 0}</span>
                </div>
                <div className="bg-[#0D0A12] border border-white/[0.04] p-2 rounded-lg text-center">
                  <span className="block text-slate-400 text-[11px]">Events</span>
                  <span className="font-semibold text-slate-200 font-mono">{c._count?.events || 0}</span>
                </div>
                <div className="bg-[#0D0A12] border border-white/[0.04] p-2 rounded-lg text-center">
                  <span className="block text-slate-400 text-[11px]">Conflicts</span>
                  <span className="font-semibold text-amber-400 font-mono">{c._count?.contradictions || 0}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-mono">
                <span>Created by {c.createdBy?.name || 'Unknown'}</span>
                <span>{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg tx-panel p-6 shadow-2xl space-y-5 border border-[rgba(139,92,246,0.3)] corner-bracket">
            <h3 className="text-xl font-bold text-slate-100">Create New Investigation Case</h3>

            {error && <div className="p-3 bg-[#DC2626]/10 text-[#EF4444] border border-[#DC2626]/30 text-xs rounded-lg font-mono">{error}</div>}

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Case Number</label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  required
                  className="tx-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Case Title</label>
                <input
                  type="text"
                  placeholder="Operation / Case Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="tx-input w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Description</label>
                <textarea
                  rows={3}
                  placeholder="Summary of the investigation scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="tx-input w-full px-3 py-2 text-sm"
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="CRITICAL">Critical Priority</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="tx-btn-secondary px-4 py-2 text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="tx-btn-primary px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Initialize Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
