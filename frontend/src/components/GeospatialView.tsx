import { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Search,
  Shield,
  Users,
  RefreshCw,
  ExternalLink,
  Navigation,
  Globe,
  AlertTriangle,
  List,
  Map as MapIcon,
  X
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiClient, safeArray } from '../api/client';

// Fix Leaflet default icon issues in bundled environments
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GeospatialViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole: string;
  initialCaseId?: string;
}

interface LocationItem {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  caseId: string;
  caseNumber?: string;
  caseTitle?: string;
  linkedEventsCount: number;
  linkedEntitiesCount: number;
  events?: Array<{
    id: string;
    title: string;
    type: string;
    timestamp: string;
  }>;
  entities?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  provenance?: any;
}

export function GeospatialView({ onSelectCase, userRole, initialCaseId }: GeospatialViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCaseId || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Case dropdown list
  const [casesList, setCasesList] = useState<Array<{ id: string; caseNumber: string; title: string }>>([]);

  // Selected location details for inspector
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);

  useEffect(() => {
    fetchCasesList();
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [selectedCaseId]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([20.5937, 78.9629], 5); // Default centered on India / Central region

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers on Map when locations state changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    const safeLocs = Array.isArray(locations) ? locations : [];
    if (safeLocs.length === 0) return;

    const bounds = L.latLngBounds([]);

    safeLocs.forEach((loc) => {
      if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        const customIcon = L.divIcon({
          className: 'custom-map-pin',
          html: `<div style="
            background: linear-gradient(135deg, #DC2626, #7C3AED);
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid #0D0A12;
            box-shadow: 0 0 14px rgba(220,38,38,0.7), 0 0 8px rgba(176,38,255,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: bold;
          ">📍</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon: customIcon });

        const popupContent = `
          <div style="color: #0f172a; font-family: ui-monospace, monospace, sans-serif; min-width: 180px;">
            <strong style="font-size: 13px; color: #7C3AED;">${loc.name}</strong><br/>
            ${loc.address ? `<span style="font-size: 11px; color: #475569;">${loc.address}</span><br/>` : ''}
            <div style="margin-top: 6px; font-size: 11px; color: #334155;">
              Case: <strong>${loc.caseNumber || 'N/A'}</strong><br/>
              Linked Events: <strong>${loc.linkedEventsCount}</strong><br/>
              Linked Entities: <strong>${loc.linkedEntitiesCount}</strong>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          setSelectedLocation(loc);
        });

        markersLayerRef.current?.addLayer(marker);
        bounds.extend([loc.latitude, loc.longitude]);
      }
    });

    if (safeLocs.length > 0 && bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [locations]);

  const fetchCasesList = async () => {
    try {
      const res = await apiClient.get('/cases');
      const list = safeArray<{ id: string; caseNumber: string; title: string }>(res.data, 'cases');
      setCasesList(list);
    } catch (err) {
      console.warn('Failed to load cases list for geospatial filter', err);
    }
  };

  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedCaseId) params.caseId = selectedCaseId;

      const res = await apiClient.get('/geospatial/locations', { params });
      const list = safeArray<LocationItem>(res.data, 'locations');
      setLocations(list);
    } catch (err: any) {
      console.error('Failed to fetch geospatial locations:', err);
      setError(err.response?.data?.error || err.userMessage || 'Failed to load geospatial intelligence map');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const safeLocations = Array.isArray(locations) ? locations : [];
  const filteredLocations = safeLocations.filter((loc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (loc.name || '').toLowerCase().includes(q) ||
      (loc.address && loc.address.toLowerCase().includes(q)) ||
      (loc.caseNumber && loc.caseNumber.toLowerCase().includes(q))
    );
  });

  const panToLocation = (loc: LocationItem) => {
    setSelectedLocation(loc);
    if (mapInstanceRef.current && loc.latitude && loc.longitude) {
      mapInstanceRef.current.flyTo([loc.latitude, loc.longitude], 14, { duration: 1.5 });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tx-panel p-6 shadow-xl">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[rgba(139,92,246,0.30)] rounded-xl text-[#B026FF] shadow-inner">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono flex items-center gap-2.5">
                <span>GEOSPATIAL INTELLIGENCE MAP</span>
                <span className="tx-badge-purple text-[10px]">SPATIAL RADAR</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Mapping physical location entities, movement corridors, and spatially correlated events
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="tx-badge-purple text-xs font-mono font-bold px-3 py-1.5 rounded-xl">
            ROLE: {userRole}
          </span>
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#15121C] border border-white/[0.08] p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
                viewMode === 'map' ? 'tx-btn-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Interactive Map</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
                viewMode === 'list' ? 'tx-btn-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Location Index</span>
            </button>
          </div>

          <button
            onClick={fetchLocations}
            className="tx-btn-secondary flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Reload Pins"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload Pins</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Toolbar */}
      <div className="tx-panel p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs shadow-lg">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          {/* Case Filter Dropdown */}
          <div className="w-full md:w-64">
            <label className="block font-medium font-mono text-slate-400 mb-1 flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>Filter by Case</span>
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="tx-input w-full px-3 py-2 text-xs font-mono"
            >
              <option value="">All Assigned Cases</option>
              {casesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber} - {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Search location or address */}
          <div className="w-full md:w-64">
            <label className="block font-medium font-mono text-slate-400 mb-1 flex items-center space-x-1">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Search Location / Address</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by location name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="tx-input w-full pl-8 pr-3 py-2 text-xs font-mono"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-slate-400">
          <span className="tx-badge-purple font-mono font-bold px-3 py-1.5 rounded-xl">
            {filteredLocations.length} Locations Mapped
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Map & Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Container */}
        <div className={`lg:col-span-2 relative tx-panel rounded-2xl overflow-hidden min-h-[500px] flex flex-col shadow-2xl ${viewMode === 'list' ? 'hidden lg:flex' : ''}`}>
          <div ref={mapContainerRef} className="w-full h-full min-h-[500px] z-10" />

          {loading && (
            <div className="absolute inset-0 z-20 bg-[#08070B]/80 backdrop-blur-sm flex items-center justify-center space-x-3 text-[#B026FF] font-mono text-sm">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Updating geospatial map layer...</span>
            </div>
          )}
        </div>

        {/* Sidebar Locations List */}
        <div className="tx-panel rounded-2xl p-4 space-y-4 max-h-[600px] overflow-y-auto shadow-xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h3 className="font-bold text-slate-200 text-sm font-mono flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-[#B026FF]" />
              <span>Geospatial Location Index</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">{filteredLocations.length} results</span>
          </div>

          {filteredLocations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-mono">No matching locations found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLocations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => panToLocation(loc)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer space-y-2 ${
                    selectedLocation?.id === loc.id
                      ? 'bg-[#1D1826] border-[rgba(176,38,255,0.6)] text-slate-100 shadow-md'
                      : 'tx-panel-elevated hover:border-[rgba(139,92,246,0.35)] text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-100 flex items-center space-x-1.5 font-mono">
                        <MapPin className="w-3.5 h-3.5 text-[#B026FF] shrink-0" />
                        <span>{loc.name}</span>
                      </h4>
                      {loc.address && <p className="text-[11px] text-slate-400 mt-0.5">{loc.address}</p>}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        panToLocation(loc);
                      }}
                      title="Fly to point on map"
                      className="p-1 text-slate-400 hover:text-[#B026FF] bg-[#111019] rounded-lg border border-white/[0.08] transition"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400 border-t border-white/[0.08] pt-2">
                    {loc.caseNumber && (
                      <span className="text-[#C084FC] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {loc.caseNumber}
                      </span>
                    )}
                    <span>Events: {loc.linkedEventsCount}</span>
                    <span>Entities: {loc.linkedEntitiesCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Location Detailed Inspector Drawer / Modal */}
      {selectedLocation && (
        <div className="fixed inset-0 z-50 bg-[#08070B]/80 backdrop-blur-md flex justify-end p-4 md:p-6 animate-fadeIn">
          <div className="tx-panel w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4.5 border-b border-white/[0.08] bg-[#15121C]/60">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-[#B026FF]" />
                <h3 className="text-base font-bold text-slate-100 font-mono">Location Record & Spatial Correlate</h3>
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              <div>
                <h2 className="text-xl font-bold text-slate-100 font-mono">{selectedLocation.name}</h2>
                {selectedLocation.address && (
                  <p className="text-slate-300 mt-1">{selectedLocation.address}</p>
                )}
                <div className="flex items-center space-x-3 mt-3 font-mono text-slate-400 tx-panel-elevated p-2.5 rounded-xl border border-white/[0.08] text-[11px]">
                  <span>Lat: <strong className="text-[#B026FF]">{selectedLocation.latitude}</strong></span>
                  <span>Lng: <strong className="text-[#B026FF]">{selectedLocation.longitude}</strong></span>
                </div>
              </div>

              {/* Case Context */}
              {selectedLocation.caseNumber && (
                <div>
                  <h4 className="font-semibold text-slate-400 mb-1 font-mono uppercase text-[11px]">Associated Case</h4>
                  <div className="flex items-center justify-between p-3 tx-panel-elevated rounded-xl border border-white/[0.08]">
                    <div>
                      <p className="font-bold text-slate-200 font-mono">{selectedLocation.caseNumber}</p>
                      <p className="text-slate-400">{selectedLocation.caseTitle}</p>
                    </div>
                    {onSelectCase && (
                      <button
                        onClick={() => {
                          const cId = selectedLocation.caseId;
                          setSelectedLocation(null);
                          onSelectCase(cId);
                        }}
                        className="tx-btn-primary px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1"
                      >
                        <span>Open Case</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Events at Location */}
              <div>
                <h4 className="font-semibold text-slate-400 mb-2 font-mono uppercase text-[11px]">
                  Spatially Linked Events ({selectedLocation.events?.length || 0})
                </h4>
                <div className="space-y-2">
                  {selectedLocation.events && selectedLocation.events.length > 0 ? (
                    selectedLocation.events.map((evt) => (
                      <div key={evt.id} className="p-3 tx-panel-elevated rounded-xl border border-white/[0.08] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200 font-mono">{evt.title}</span>
                          <span className="tx-badge-purple text-[10px]">
                            {evt.type}
                          </span>
                        </div>
                        <p className="text-slate-400 font-mono text-[10px]">
                          {new Date(evt.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic p-3 tx-panel-elevated rounded-xl border border-white/[0.08]">
                      No explicit event records linked directly to this coordinate.
                    </p>
                  )}
                </div>
              </div>

              {/* Linked Entities at Location */}
              <div>
                <h4 className="font-semibold text-slate-400 mb-2 font-mono uppercase text-[11px]">
                  Spatially Linked Entities ({selectedLocation.entities?.length || 0})
                </h4>
                <div className="space-y-2">
                  {selectedLocation.entities && selectedLocation.entities.length > 0 ? (
                    selectedLocation.entities.map((ent) => (
                      <div key={ent.id} className="flex items-center justify-between p-2.5 tx-panel-elevated rounded-xl border border-white/[0.08]">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-[#B026FF]" />
                          <span className="font-semibold text-slate-200">{ent.name}</span>
                        </div>
                        <span className="tx-badge-purple uppercase text-[10px]">
                          {ent.type}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic p-3 tx-panel-elevated rounded-xl border border-white/[0.08]">
                      No entities associated with this location.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
