import React, { useEffect, useState } from 'react';
import {
  Clock,
  Search,
  Calendar,
  Shield,
  FileText,
  MapPin,
  Users,
  RefreshCw,
  Sliders,
  Phone,
  DollarSign,
  Mail,
  Zap,
  Tag,
  Info,
  X,
  ExternalLink,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { apiClient, safeArray } from '../api/client';

interface TimelineViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole: string;
  initialCaseId?: string;
}

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  endTimestamp?: string;
  confidence: number;
  caseId: string;
  caseNumber?: string;
  caseTitle?: string;
  location?: {
    id: string;
    name: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  involvedEntities: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  evidence?: {
    id: string;
    title: string;
    type: string;
    sourceName?: string;
  };
  provenance?: any;
}

export function TimelineView({ onSelectCase, userRole, initialCaseId }: TimelineViewProps) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCaseId || '');
  const [entityQuery, setEntityQuery] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'case' | 'none'>('day');

  // Case List for dropdown
  const [casesList, setCasesList] = useState<Array<{ id: string; caseNumber: string; title: string }>>([]);

  // Selected item for drawer/modal inspection
  const [selectedEvent, setSelectedEvent] = useState<TimelineItem | null>(null);

  useEffect(() => {
    fetchCasesList();
  }, []);

  useEffect(() => {
    fetchTimeline();
  }, [selectedCaseId, eventTypeFilter, minConfidence, startDate, endDate]);

  const fetchCasesList = async () => {
    try {
      const res = await apiClient.get('/cases');
      const list = safeArray<{ id: string; caseNumber: string; title: string }>(res.data, 'cases');
      setCasesList(list);
    } catch (err) {
      console.warn('Failed to load cases list for timeline filter', err);
      setCasesList([]);
    }
  };

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedCaseId) params.caseId = selectedCaseId;
      if (entityQuery.trim()) params.entityQuery = entityQuery.trim();
      if (eventTypeFilter !== 'ALL') params.eventType = eventTypeFilter;
      if (minConfidence > 0) params.minConfidence = minConfidence;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate).toISOString();

      const res = await apiClient.get('/temporal/timeline', { params });
      const items = safeArray<TimelineItem>(res.data, 'items', 'timeline');
      setTimelineItems(items);
    } catch (err: any) {
      console.error('Failed to fetch timeline items:', err);
      setError(err.response?.data?.error || err.userMessage || 'Failed to load timeline events');
      setTimelineItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTimeline();
  };

  const getEventTypeBadge = (type: string) => {
    const uppercaseType = type.toUpperCase();
    switch (uppercaseType) {
      case 'CALL':
      case 'PHONE':
        return { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: Phone };
      case 'TRANSACTION':
      case 'FINANCIAL':
        return { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: DollarSign };
      case 'EMAIL':
      case 'COMMUNICATION':
        return { bg: 'bg-[#B026FF]/10 text-[#C084FC] border-[#B026FF]/20', icon: Mail };
      case 'MOVEMENT':
      case 'LOCATION':
        return { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: MapPin };
      case 'MEETING':
      case 'ASSOCIATION':
        return { bg: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20', icon: Users };
      case 'ANOMALY':
      case 'CONTRADICTION':
        return { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: AlertTriangle };
      default:
        return { bg: 'bg-slate-800 text-slate-300 border-slate-700', icon: Zap };
    }
  };

  // Group items according to selected grouping strategy
  const getGroupedItems = () => {
    const items = Array.isArray(timelineItems) ? timelineItems : [];
    if (groupBy === 'none') {
      return [{ groupKey: 'All Events', items }];
    }

    const groups: { [key: string]: TimelineItem[] } = {};

    items.forEach((item) => {
      let key = 'Other';
      if (groupBy === 'day') {
        const d = new Date(item.timestamp);
        key = d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      } else if (groupBy === 'week') {
        const d = new Date(item.timestamp);
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        key = `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else if (groupBy === 'case') {
        key = item.caseNumber ? `${item.caseNumber} - ${item.caseTitle || ''}` : `Case: ${item.caseId}`;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.keys(groups).map((groupKey) => ({
      groupKey,
      items: groups[groupKey],
    }));
  };

  const groupedTimeline = getGroupedItems();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel corner-bracket p-6 shadow-xl">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.35)] rounded-xl text-[#B026FF] shadow-md shadow-[#DC2626]/10">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 tracking-tight">
                Investigation Timeline & Event Stream
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30 rounded-full font-mono">
                  TEMPORAL
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Chronological sequence of verified events, entity activities, and location changes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-[#0D0A12] border border-white/[0.08] rounded-xl text-xs font-mono text-slate-300">
            Clearance: <span className="text-[#B026FF] font-semibold">{userRole}</span>
          </span>
          <button
            onClick={fetchTimeline}
            className="tx-btn-secondary flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Timeline</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Toolbar */}
      <form onSubmit={handleSearchSubmit} className="tx-panel p-4 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* Case Selector */}
          <div>
            <label className="block font-medium text-slate-400 mb-1 flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>Case Filter</span>
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="tx-input w-full px-3 py-2 text-xs"
            >
              <option value="">All Assigned Cases</option>
              {casesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber} - {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type */}
          <div>
            <label className="block font-medium text-slate-400 mb-1 flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-slate-500" />
              <span>Event Category</span>
            </label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="tx-input w-full px-3 py-2 text-xs"
            >
              <option value="ALL">All Event Types</option>
              <option value="CALL">Call / Telephony</option>
              <option value="TRANSACTION">Financial Transaction</option>
              <option value="MOVEMENT">Location / Movement</option>
              <option value="EMAIL">Email Communication</option>
              <option value="MEETING">Meeting / Association</option>
              <option value="LOG">System Log</option>
              <option value="ANOMALY">Security Anomaly</option>
            </select>
          </div>

          {/* Entity Name Filter */}
          <div>
            <label className="block font-medium text-slate-400 mb-1 flex items-center space-x-1">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Involved Entity</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search entity name/ID..."
                value={entityQuery}
                onChange={(e) => setEntityQuery(e.target.value)}
                className="tx-input w-full pl-8 pr-3 py-2 text-xs"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Grouping Strategy */}
          <div>
            <label className="block font-medium text-slate-400 mb-1 flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Group Sequence By</span>
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="tx-input w-full px-3 py-2 text-xs"
            >
              <option value="day">By Date / Day</option>
              <option value="week">By Week</option>
              <option value="case">By Case</option>
              <option value="none">Flat Stream</option>
            </select>
          </div>
        </div>

        {/* Secondary Filters: Date Range & Confidence */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-3 border-t border-white/[0.08] text-xs">
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="flex items-center space-x-1 text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>From:</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="tx-input px-2.5 py-1 text-xs"
            />
            <div className="text-slate-400">to</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="tx-input px-2.5 py-1 text-xs"
            />
          </div>

          <div className="flex items-center space-x-4 w-full md:w-auto">
            <div className="flex items-center space-x-2">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Min Confidence:</span>
              <span className="font-mono text-[#B026FF] font-bold">{Math.round(minConfidence * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-28 accent-[#7C3AED] cursor-pointer"
            />

            <button
              type="submit"
              className="tx-btn-primary px-4 py-1.5 text-xs font-semibold cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </form>

      {/* Main Timeline Stream */}
      {error && (
        <div className="p-4 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl text-[#EF4444] text-xs flex items-center space-x-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 tx-panel space-y-3 font-mono">
          <RefreshCw className="w-6 h-6 text-[#B026FF] animate-spin mx-auto" />
          <p className="text-sm font-medium">Fetching verified investigation event stream...</p>
        </div>
      ) : !Array.isArray(timelineItems) || timelineItems.length === 0 ? (
        <div className="p-12 text-center text-slate-500 tx-panel space-y-2">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-base font-semibold text-slate-300">No Timeline Events Found</p>
          <p className="text-xs font-mono">Adjust your search terms or confidence threshold to view results.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTimeline.map((group) => (
            <div key={group.groupKey} className="space-y-4">
              {/* Group Sticky Header */}
              <div className="flex items-center space-x-3">
                <div className="px-3.5 py-1 bg-[#0D0A12] border border-white/[0.08] rounded-xl text-xs font-bold text-[#B026FF] tracking-wide font-mono">
                  {group.groupKey}
                </div>
                <div className="h-px bg-white/[0.08] flex-1" />
                <span className="text-xs font-mono text-slate-500">{group.items.length} events</span>
              </div>

              {/* Event Cards inside group */}
              <div className="relative pl-6 border-l-2 border-white/[0.08] space-y-4 ml-4">
                {group.items.map((item) => {
                  const badge = getEventTypeBadge(item.type);
                  const Icon = badge.icon;
                  const dateStr = new Date(item.timestamp).toLocaleString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  });

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedEvent(item)}
                      className="group relative tx-panel hover:bg-[#15121C] hover:border-[rgba(176,38,255,0.4)] p-4.5 transition cursor-pointer space-y-3 shadow-md"
                    >
                      {/* Timeline Dot Node */}
                      <div className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-[#08070B] border-2 border-[#EF4444] group-hover:bg-[#EF4444] transition shadow-[0_0_8px_rgba(239,68,68,0.6)]" />

                      {/* Card Top Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                        <div className="flex items-center space-x-2.5">
                          <span className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 ${badge.bg}`}>
                            <Icon className="w-3.5 h-3.5" />
                            <span>{item.type}</span>
                          </span>

                          <span className="text-xs font-mono text-[#B026FF] font-medium">
                            {dateStr}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-xs">
                          {item.caseNumber && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectCase) onSelectCase(item.caseId);
                              }}
                              className="font-mono text-[#B026FF] hover:underline flex items-center space-x-1 bg-[#7C3AED]/15 px-2 py-0.5 rounded-md border border-[#7C3AED]/30"
                            >
                              <Shield className="w-3 h-3" />
                              <span>{item.caseNumber}</span>
                            </span>
                          )}

                          <span className="font-mono text-[11px] text-slate-400 bg-[#0D0A12] border border-white/[0.06] px-2 py-0.5 rounded-md">
                            Conf: {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Card Title & Content */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100 group-hover:text-[#B026FF] transition">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed font-mono">
                          {item.description}
                        </p>
                      </div>

                      {/* Bottom Context: Involved Entities & Location */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        {item.location && (
                          <div className="flex items-center space-x-1 text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 rounded-lg">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[200px] font-mono">{item.location.name}</span>
                          </div>
                        )}

                        {item.involvedEntities && item.involvedEntities.map((ent) => (
                          <div key={ent.id} className="flex items-center space-x-1 text-slate-300 bg-[#0D0A12] px-2 py-0.5 rounded-lg border border-white/[0.08] text-[11px]">
                            <Tag className="w-3 h-3 text-[#B026FF] shrink-0" />
                            <span>{ent.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono uppercase">({ent.type})</span>
                          </div>
                        ))}

                        {item.evidence && (
                          <div className="ml-auto flex items-center space-x-1 text-slate-400 text-[11px] bg-[#0D0A12] px-2 py-0.5 rounded-md border border-white/[0.08]">
                            <FileText className="w-3 h-3 text-amber-400" />
                            <span className="truncate max-w-[150px] font-mono">{item.evidence.title}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event Details Drawer / Inspector Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-end p-4 md:p-6 animate-fadeIn">
          <div className="tx-panel corner-bracket-full border border-[rgba(139,92,246,0.3)] w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4.5 border-b border-white/[0.08] bg-[#0D0A12]">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-[#B026FF]" />
                <h3 className="text-base font-bold text-slate-100 tracking-tight">Event Provenance & Details</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-slate-400 hover:text-slate-200 tx-btn-secondary rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              <div>
                <span className="px-2.5 py-1 bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30 rounded-lg font-mono font-semibold uppercase">
                  {selectedEvent.type}
                </span>
                <h2 className="text-lg font-bold text-slate-100 mt-2">{selectedEvent.title}</h2>
                <p className="text-slate-300 mt-2 leading-relaxed tx-panel-elevated p-3 font-mono">
                  {selectedEvent.description}
                </p>
              </div>

              {/* Timestamps & Confidence */}
              <div className="grid grid-cols-2 gap-3 tx-panel-elevated p-3.5">
                <div>
                  <p className="text-slate-500 font-medium">Timestamp</p>
                  <p className="text-slate-200 font-mono font-semibold mt-0.5">
                    {new Date(selectedEvent.timestamp).toUTCString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Confidence Score</p>
                  <p className="text-emerald-400 font-mono font-bold mt-0.5">
                    {Math.round(selectedEvent.confidence * 100)}% Verified
                  </p>
                </div>
              </div>

              {/* Case Assignment */}
              {selectedEvent.caseNumber && (
                <div>
                  <h4 className="font-semibold text-slate-400 mb-1 font-mono">Associated Investigation Case</h4>
                  <div className="flex items-center justify-between p-3 tx-panel-elevated">
                    <div>
                      <p className="font-bold text-slate-200 font-mono">{selectedEvent.caseNumber}</p>
                      <p className="text-slate-400">{selectedEvent.caseTitle}</p>
                    </div>
                    {onSelectCase && (
                      <button
                        onClick={() => {
                          const cId = selectedEvent.caseId;
                          setSelectedEvent(null);
                          onSelectCase(cId);
                        }}
                        className="tx-btn-primary px-3 py-1.5 font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Open Case</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Involved Entities */}
              <div>
                <h4 className="font-semibold text-slate-400 mb-2 font-mono">Involved Intelligence Entities ({selectedEvent.involvedEntities?.length || 0})</h4>
                <div className="space-y-2">
                  {selectedEvent.involvedEntities?.map((ent) => (
                    <div key={ent.id} className="flex items-center justify-between p-2.5 tx-panel-elevated">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-[#B026FF]" />
                        <span className="font-semibold text-slate-200">{ent.name}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30 rounded font-mono uppercase text-[10px]">
                        {ent.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location Details */}
              {selectedEvent.location && (
                <div>
                  <h4 className="font-semibold text-slate-400 mb-2 font-mono">Event Location Record</h4>
                  <div className="p-3.5 bg-purple-950/20 border border-purple-500/20 rounded-xl space-y-1">
                    <div className="flex items-center space-x-2 text-purple-300 font-semibold">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedEvent.location.name}</span>
                    </div>
                    {selectedEvent.location.address && (
                      <p className="text-slate-400 pl-6 font-mono">{selectedEvent.location.address}</p>
                    )}
                    {selectedEvent.location.latitude && (
                      <p className="font-mono text-slate-500 pl-6 text-[11px]">
                        Coords: {selectedEvent.location.latitude}, {selectedEvent.location.longitude}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Evidence Provenance */}
              {selectedEvent.evidence && (
                <div>
                  <h4 className="font-semibold text-slate-400 mb-2 font-mono">Source Evidence Provenance</h4>
                  <div className="p-3.5 tx-panel-elevated space-y-2">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-slate-200">{selectedEvent.evidence.title}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] font-mono">Source: {selectedEvent.evidence.sourceName || 'Primary Evidence File'}</p>
                    <p className="text-slate-500 font-mono text-[10px]">Evidence ID: {selectedEvent.evidence.id}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
