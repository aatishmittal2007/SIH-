import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Tag,
  Shield,
  AlertCircle
} from 'lucide-react';
import { apiClient, safeArray } from '../api/client';

interface EntityExplorerViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole?: string;
}

export const EntityExplorerView: React.FC<EntityExplorerViewProps> = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  const fetchEntities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/entities');
      const list = safeArray(res.data, 'entities');
      setEntities(list);
    } catch (err: any) {
      console.error('Failed to load canonical entity registry', err);
      setError(err.userMessage || 'Failed to fetch entity directory.');
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  const safeEntities = Array.isArray(entities) ? entities : [];
  const filteredEntities = safeEntities.filter((e) => {
    const matchesSearch =
      (e.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.canonicalValue || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.normalizedValue || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || e.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel corner-bracket p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.35)] text-[#B026FF] rounded-xl shadow-md shadow-[#DC2626]/10">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">CANONICAL ENTITY EXPLORER</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Cross-case entity resolution registry tracking phone numbers, email accounts, crypto wallets, and target profiles.
            </p>
          </div>
        </div>

        <button
          onClick={fetchEntities}
          className="tx-btn-secondary p-2.5 text-xs font-semibold cursor-pointer self-start md:self-auto"
          title="Refresh Entity Graph"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl text-[#EF4444] text-xs font-mono">
          {error}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 tx-panel p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search canonical value, display name, or normalized value..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tx-input w-full pl-9 pr-4 py-2 text-xs"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="tx-input w-full px-3.5 py-2 text-xs"
          >
            <option value="ALL">All Entity Types</option>
            <option value="PHONE">Phone Number</option>
            <option value="EMAIL">Email Address</option>
            <option value="PERSON">Person / Alias</option>
            <option value="ORGANIZATION">Organization</option>
            <option value="ACCOUNT">Bank Account</option>
            <option value="TRANSACTION">Transaction</option>
            <option value="LOCATION">Geographic Location</option>
            <option value="DEVICE">Device</option>
            <option value="IP_ADDRESS">IP Address</option>
          </select>
        </div>
      </div>

      {/* Grid of Entity Dossier Cards */}
      {loading ? (
        <div className="py-16 text-center space-y-3 tx-panel">
          <RefreshCw className="w-8 h-8 text-[#B026FF] animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Querying global canonical entity graph...</p>
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="py-16 text-center space-y-3 tx-panel">
          <AlertCircle className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No Matching Entities Discovered</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntities.map((ent) => {
            const caseLinks = ent.caseEntities || ent.caseLinks || [];

            return (
              <div
                key={ent.id}
                className="tx-panel hover:bg-[#15121C] hover:border-[rgba(176,38,255,0.4)] p-5 shadow-xl transition space-y-4 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-[#B026FF] bg-[#7C3AED]/15 border border-[#7C3AED]/30 px-2.5 py-0.5 rounded-md">
                    {ent.type}
                  </span>

                  <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-400">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{caseLinks.length} Cases Linked</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-100 group-hover:text-[#B026FF] transition truncate">
                    {ent.displayName || ent.canonicalValue}
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-1 truncate">
                    Canonical: <span className="text-[#B026FF] font-semibold">{ent.canonicalValue}</span>
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    Normalized: {ent.normalizedValue}
                  </p>
                </div>

                {caseLinks.length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-white/[0.08]">
                    <h4 className="text-[10px] font-mono uppercase text-slate-400 font-bold">Associated Case Links</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {caseLinks.map((cl: any) => (
                        <span
                          key={cl.id}
                          className="text-[10px] font-mono bg-[#0D0A12] border border-white/[0.08] text-slate-300 px-2 py-0.5 rounded"
                        >
                          {cl.case?.caseNumber || 'CASE'}: {cl.role || 'INVOLVED'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-white/[0.06]">
                  <span className="flex items-center space-x-1">
                    <Tag className="w-3 h-3 text-slate-400" />
                    <span>{ent.resolvedBy ? 'Manually Confirmed' : 'Canonical'}</span>
                  </span>
                  <span>ID: {ent.id.substring(0, 8)}...</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
