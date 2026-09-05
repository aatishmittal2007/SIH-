import React, { useState, useEffect } from 'react';
import { Search, Plus, FolderKanban } from 'lucide-react';
import { apiClient } from '../api/client';

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
      setCases(res.data.cases || []);
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
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'OPEN':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'IN_PROGRESS':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'CLOSED':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'ARCHIVED':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <FolderKanban className="w-6 h-6 text-blue-400" />
            <span>Active Investigation Cases</span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Scoped to your user role ({userRole})</p>
        </div>

        {userRole !== 'ANALYST' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation Case</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/60 p-4 border border-slate-800 rounded-xl">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by case number or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
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
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
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
        <div className="p-12 text-center text-slate-500">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-xl text-center space-y-2">
          <p className="text-slate-400 font-medium">No investigation cases found</p>
          <p className="text-xs text-slate-500">Try adjusting search filters or create a new case.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cases.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelectCase(c.id)}
              className="p-5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl space-y-4 transition cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono text-blue-400 font-semibold">{c.caseNumber}</span>
                  <h3 className="text-lg font-semibold text-slate-100 group-hover:text-blue-300 transition">
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

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div className="bg-slate-950/60 p-2 rounded-lg text-center">
                  <span className="block text-slate-400">Evidence</span>
                  <span className="font-semibold text-slate-200">{c._count?.evidence || 0}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg text-center">
                  <span className="block text-slate-400">Entities</span>
                  <span className="font-semibold text-slate-200">{c._count?.caseEntities || 0}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg text-center">
                  <span className="block text-slate-400">Events</span>
                  <span className="font-semibold text-slate-200">{c._count?.events || 0}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg text-center">
                  <span className="block text-slate-400">Conflicts</span>
                  <span className="font-semibold text-amber-400">{c._count?.contradictions || 0}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Created by {c.createdBy?.name || 'Unknown'}</span>
                <span>{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <h3 className="text-xl font-bold text-slate-100">Create New Investigation Case</h3>

            {error && <div className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs rounded-lg">{error}</div>}

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Case Number</label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Description</label>
                <textarea
                  rows={3}
                  placeholder="Summary of the investigation scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg"
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
