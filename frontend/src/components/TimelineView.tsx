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
import { apiClient, unwrapData } from '../api/client';

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
      const data = unwrapData(res);
      const list = Array.isArray(data) ? data : (Array.isArray(res.data?.cases) ? res.data.cases : []);
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
      const data = unwrapData(res);
      const items = Array.isArray(data)
        ? data
        : (Array.isArray(res.data?.items)
          ? res.data.items
          : (Array.isArray(res.data) ? res.data : []));
      setTimelineItems(items);
    } catch (err: any) {
      console.error('Failed to fetch timeline items:', err);
      setError(err.response?.data?.error || 'Failed to load timeline events');
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
        return { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Mail };
      case 'MOVEMENT':
      case 'LOCATION':
        return { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: MapPin };
      case 'MEETING':
      case 'ASSOCIATION':
        return { bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Users };
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Investigation Timeline & Event Stream
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full">
                  Phase 18
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Chronological sequence of verified events, entity activities, and location changes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-slate-300">
            Role: {userRole}
          </span>
          <button
            onClick={fetchTimeline}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Timeline</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Toolbar */}
      <form onSubmit={handleSearchSubmit} className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-4">
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition"
            >
              <option value="day">By Date / Day</option>
              <option value="week">By Week</option>
              <option value="case">By Case</option>
              <option value="none">Flat Stream</option>
            </select>
          </div>
        </div>

        {/* Secondary Filters: Date Range & Confidence */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="flex items-center space-x-1 text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>From:</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none"
            />
            <div className="text-slate-400">to</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-4 w-full md:w-auto">
            <div className="flex items-center space-x-2">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Min Confidence:</span>
              <span className="font-mono text-cyan-400 font-bold">{Math.round(minConfidence * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-28 accent-cyan-500 cursor-pointer"
            />

            <button
              type="submit"
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl shadow-lg transition cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </form>

      {/* Main Timeline Stream */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
          <p className="text-sm font-medium">Fetching verified investigation event stream...</p>
        </div>
      ) : !Array.isArray(timelineItems) || timelineItems.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-base font-semibold text-slate-300">No Timeline Events Found</p>
          <p className="text-xs">Adjust your search terms or confidence threshold to view results.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTimeline.map((group) => (
            <div key={group.groupKey} className="space-y-4">
              {/* Group Sticky Header */}
              <div className="flex items-center space-x-3">
                <div className="px-3.5 py-1 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-cyan-400 tracking-wide">
                  {group.groupKey}
                </div>
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-xs font-mono text-slate-500">{group.items.length} events</span>
              </div>

              {/* Event Cards inside group */}
              <div className="relative pl-6 border-l-2 border-slate-800 space-y-4 ml-4">
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
                      className="group relative bg-slate-900/70 hover:bg-slate-900 border border-slate-800/90 hover:border-cyan-500/40 rounded-2xl p-4.5 transition cursor-pointer space-y-3 shadow-md"
                    >
                      {/* Timeline Dot Node */}
                      <div className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-slate-950 border-2 border-cyan-500 group-hover:bg-cyan-500 transition shadow-sm" />

                      {/* Card Top Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                        <div className="flex items-center space-x-2.5">
                          <span className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 ${badge.bg}`}>
                            <Icon className="w-3.5 h-3.5" />
                            <span>{item.type}</span>
                          </span>

                          <span className="text-xs font-mono text-cyan-300 font-medium">
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
                              className="font-mono text-blue-400 hover:underline flex items-center space-x-1 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20"
                            >
                              <Shield className="w-3 h-3" />
                              <span>{item.caseNumber}</span>
                            </span>
                          )}

                          <span className="font-mono text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                            Conf: {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Card Title & Content */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Bottom Context: Involved Entities & Location */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        {item.location && (
                          <div className="flex items-center space-x-1 text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[200px]">{item.location.name}</span>
                          </div>
                        )}

                        {item.involvedEntities && item.involvedEntities.map((ent) => (
                          <div key={ent.id} className="flex items-center space-x-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/60 text-[11px]">
                            <Tag className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>{ent.name}</span>
                            <span className="text-[10px] text-slate-500 uppercase">({ent.type})</span>
                          </div>
                        ))}

                        {item.evidence && (
                          <div className="ml-auto flex items-center space-x-1 text-slate-400 text-[11px] bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                            <FileText className="w-3 h-3 text-amber-400" />
                            <span className="truncate max-w-[150px]">{item.evidence.title}</span>
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-end p-4 md:p-6 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4.5 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-slate-100">Event Provenance & Details</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              <div>
                <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg font-mono font-semibold uppercase">
                  {selectedEvent.type}
                </span>
                <h2 className="text-lg font-bold text-slate-100 mt-2">{selectedEvent.title}</h2>
                <p className="text-slate-300 mt-2 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {selectedEvent.description}
                </p>
              </div>

              {/* Timestamps & Confidence */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
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
                  <h4 className="font-semibold text-slate-400 mb-1">Associated Investigation Case</h4>
                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div>
                      <p className="font-bold text-slate-200">{selectedEvent.caseNumber}</p>
                      <p className="text-slate-400">{selectedEvent.caseTitle}</p>
                    </div>
                    {onSelectCase && (
                      <button
                        onClick={() => {
                          const cId = selectedEvent.caseId;
                          setSelectedEvent(null);
                          onSelectCase(cId);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center space-x-1"
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
                <h4 className="font-semibold text-slate-400 mb-2">Involved Intelligence Entities ({selectedEvent.involvedEntities?.length || 0})</h4>
                <div className="space-y-2">
                  {selectedEvent.involvedEntities?.map((ent) => (
                    <div key={ent.id} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-cyan-400" />
                        <span className="font-semibold text-slate-200">{ent.name}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono uppercase text-[10px]">
                        {ent.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location Details */}
              {selectedEvent.location && (
                <div>
                  <h4 className="font-semibold text-slate-400 mb-2">Event Location Record</h4>
                  <div className="p-3.5 bg-purple-950/20 border border-purple-500/20 rounded-xl space-y-1">
                    <div className="flex items-center space-x-2 text-purple-300 font-semibold">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedEvent.location.name}</span>
                    </div>
                    {selectedEvent.location.address && (
                      <p className="text-slate-400 pl-6">{selectedEvent.location.address}</p>
                    )}
                    {selectedEvent.location.latitude && (
                      <p className="text-mono text-slate-500 pl-6 text-[11px]">
                        Coords: {selectedEvent.location.latitude}, {selectedEvent.location.longitude}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Evidence Provenance */}
              {selectedEvent.evidence && (
                <div>
                  <h4 className="font-semibold text-slate-400 mb-2">Source Evidence Provenance</h4>
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-slate-200">{selectedEvent.evidence.title}</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">Source: {selectedEvent.evidence.sourceName || 'Primary Evidence File'}</p>
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
