import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Tag,
  Shield,
  AlertCircle
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

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
      const data = unwrapData(res);
      const list = Array.isArray(data) ? data : (Array.isArray(res.data) ? res.data : (res.data?.entities || []));
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-[#1f1f28] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#6D4AFF]/20 border border-[#6D4AFF]/40 text-[#6D4AFF] rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">CANONICAL ENTITY EXPLORER</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Cross-case entity resolution registry tracking phone numbers, email accounts, crypto wallets, and target profiles.
            </p>
          </div>
        </div>

        <button
          onClick={fetchEntities}
          className="p-2.5 bg-[#17171f] hover:bg-[#20202b] text-slate-300 border border-[#262633] rounded-xl text-xs font-semibold transition cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#111114] border border-[#1f1f28] p-4 rounded-2xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search canonical value, display name, or normalized value..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#6D4AFF]"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-[#0a0a0c] border border-[#262633] rounded-xl text-xs text-slate-300 focus:outline-none focus:border-[#6D4AFF]"
          >
            <option value="ALL">All Entity Types</option>
            <option value="PHONE">Phone Number</option>
            <option value="EMAIL">Email Address</option>
            <option value="PERSON">Person / Alias</option>
            <option value="BANK_ACCOUNT">Bank Account</option>
            <option value="CRYPTO_WALLET">Crypto Wallet</option>
            <option value="LOCATION">Geographic Location</option>
            <option value="VEHICLE">Vehicle License Plate</option>
          </select>
        </div>
      </div>

      {/* Grid of Entity Dossier Cards */}
      {loading ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <RefreshCw className="w-8 h-8 text-[#6D4AFF] animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Querying global canonical entity graph...</p>
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#111114] border border-[#1f1f28] rounded-2xl">
          <AlertCircle className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No Matching Entities Discovered</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntities.map((ent) => (
            <div
              key={ent.id}
              className="bg-[#111114] border border-[#1f1f28] hover:border-[#6D4AFF]/40 rounded-2xl p-5 shadow-xl transition space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[#6D4AFF] bg-[#6D4AFF]/10 border border-[#6D4AFF]/30 px-2.5 py-0.5 rounded-md">
                  {ent.type}
                </span>

                <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-400">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{ent.caseLinks?.length || 0} Cases Linked</span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-100 truncate">
                  {ent.displayName || ent.canonicalValue}
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-1 truncate">
                  Canonical: <span className="text-cyan-400">{ent.canonicalValue}</span>
                </p>
                <p className="text-[11px] font-mono text-slate-500 truncate">
                  Normalized: {ent.normalizedValue}
                </p>
              </div>

              {ent.caseLinks && ent.caseLinks.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-[#1f1f28]">
                  <h4 className="text-[10px] font-mono uppercase text-slate-400 font-bold">Associated Case Links</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {ent.caseLinks.map((cl: any) => (
                      <span
                        key={cl.id}
                        className="text-[10px] font-mono bg-[#171725] border border-[#262638] text-slate-300 px-2 py-0.5 rounded"
                      >
                        {cl.case?.caseNumber || 'CASE'}: {cl.role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-[#1f1f28]/60">
                <span className="flex items-center space-x-1">
                  <Tag className="w-3 h-3 text-slate-400" />
                  <span>{ent.resolvedBy ? 'Manually Confirmed' : 'Auto Resolved'}</span>
                </span>
                <span>ID: {ent.id.substring(0, 8)}...</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
