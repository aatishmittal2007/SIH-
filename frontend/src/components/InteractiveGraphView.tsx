import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import type { Core } from 'cytoscape';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Info,
  GitCommit,
  X,
  Layers,
  Plus,
  ChevronRight
} from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';

interface InteractiveGraphViewProps {
  onSelectCase?: (caseId: string) => void;
  userRole?: string;
  initialCaseId?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  displayName: string;
  canonicalValue: string;
  properties?: Record<string, any>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence?: number;
  provenance?: string;
  properties?: Record<string, any>;
}

export const InteractiveGraphView: React.FC<InteractiveGraphViewProps> = ({
  onSelectCase,
  userRole: _userRole = 'INVESTIGATOR',
  initialCaseId = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCaseId);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [layoutName, setLayoutName] = useState<string>('cose');

  // Graph Data
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [casesList, setCasesList] = useState<Array<{ id: string; caseNumber: string; title: string }>>([]);

  // Selection & Side Panel State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<any | null>(null);
  const [selectedEdgeDetails, setSelectedEdgeDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [expandingNode, setExpandingNode] = useState<boolean>(false);

  // Pathfinding state
  const [pathSourceId, setPathSourceId] = useState<string | null>(null);
  const [pathTargetId, setPathTargetId] = useState<string | null>(null);
  const [pathResult, setPathResult] = useState<any | null>(null);
  const [findingPath, setFindingPath] = useState<boolean>(false);

  // Entity Types Configuration
  const ENTITY_TYPES = [
    'ALL',
    'PERSON',
    'ORGANIZATION',
    'PHONE',
    'EMAIL',
    'USERNAME',
    'IP',
    'DOMAIN',
    'URL',
    'DEVICE',
    'LOCATION',
    'ACCOUNT',
    'TRANSACTION',
    'EVENT',
    'EVIDENCE',
    'CASE'
  ];

  // Node Color Mapping
  const getNodeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'PERSON':
        return '#6366f1'; // Indigo
      case 'ORGANIZATION':
        return '#ec4899'; // Pink
      case 'PHONE':
        return '#10b981'; // Emerald
      case 'EMAIL':
        return '#f59e0b'; // Amber
      case 'USERNAME':
        return '#8b5cf6'; // Purple
      case 'IP':
        return '#06b6d4'; // Cyan
      case 'DOMAIN':
      case 'URL':
        return '#0284c7'; // Sky
      case 'DEVICE':
        return '#64748b'; // Slate
      case 'LOCATION':
        return '#f43f5e'; // Rose
      case 'ACCOUNT':
      case 'TRANSACTION':
        return '#eab308'; // Yellow
      case 'EVENT':
        return '#f97316'; // Orange
      case 'EVIDENCE':
        return '#a855f7'; // Violet
      case 'CASE':
        return '#3b82f6'; // Blue
      default:
        return '#94a3b8'; // Muted Gray
    }
  };

  // Fetch Cases for Dropdown Filter
  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await apiClient.get('/cases');
        if (res.data && res.data.cases) {
          setCasesList(res.data.cases);
        }
      } catch (err) {
        console.warn('Failed to load cases list for graph filter', err);
      }
    };
    fetchCases();
  }, []);

  // Fetch Interactive Graph Data
  const loadGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { limit: 150 };
      if (selectedCaseId) params.caseId = selectedCaseId;
      if (selectedType !== 'ALL') params.entityType = selectedType;
      if (minConfidence > 0) params.minConfidence = minConfidence;

      const res = await apiClient.get('/network/interactive', { params });
      const data: any = unwrapData(res);
      const nodes = Array.isArray(data?.nodes) ? data.nodes : (Array.isArray(res.data?.data?.nodes) ? res.data.data.nodes : []);
      const edges = Array.isArray(data?.edges) ? data.edges : (Array.isArray(res.data?.data?.edges) ? res.data.data.edges : []);
      setGraphData({ nodes, edges });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load network graph data.');
      setGraphData({ nodes: [], edges: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [selectedCaseId, selectedType, minConfidence]);

  // Initialize and Update Cytoscape Canvas
  useEffect(() => {
    if (!containerRef.current) return;

    // Convert nodes and edges to Cytoscape elements format
    const elements: cytoscape.ElementDefinition[] = [
      ...graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.displayName || node.canonicalValue || node.id,
          type: node.type || node.label || 'Entity',
          color: getNodeColor(node.type || node.label || ''),
        },
      })),
      ...graphData.edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.type,
          confidence: edge.confidence || 1.0,
        },
      })),
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#f8fafc',
            'font-size': '11px',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': 36,
            'height': 36,
            'border-width': 2,
            'border-color': '#ffffff',
            'overlay-padding': '4px',
            'transition-property': 'background-color, border-color, border-width, width, height',
            'transition-duration': 0.2,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#38bdf8',
            'width': 44,
            'height': 44,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'color': '#94a3b8',
            'font-size': '9px',
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.8,
            'text-background-color': '#0f172a',
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'opacity': 0.8,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 4,
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'opacity': 1.0,
          },
        },
        {
          selector: '.highlighted',
          style: {
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'width': 3.5,
            'opacity': 1.0,
          },
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.25,
          },
        },
      ],
      layout: {
        name: layoutName as any,
        animate: true,
        animationDuration: 500,
        padding: 50,
      },
    });

    // Handle Node Click
    cy.on('tap', 'node', async (evt) => {
      const node = evt.target;
      const nodeId = node.id();

      // Highlight neighbors
      cy.elements().removeClass('highlighted faded');
      const neighborhood = node.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass('faded');
      neighborhood.addClass('highlighted');

      setSelectedNodeId(nodeId);
      setSelectedEdgeDetails(null);
      fetchNodeDetails(nodeId);
    });

    // Handle Edge Click
    cy.on('tap', 'edge', async (evt) => {
      const edge = evt.target;
      const edgeData = edge.data();

      cy.elements().removeClass('highlighted faded');
      edge.addClass('highlighted');
      edge.connectedNodes().addClass('highlighted');

      setSelectedNodeId(null);
      setSelectedNodeDetails(null);
      fetchEdgeDetails(edgeData.source, edgeData.target, edgeData.label);
    });

    // Handle Background Click (Deselect)
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted faded');
        setSelectedNodeId(null);
        setSelectedNodeDetails(null);
        setSelectedEdgeDetails(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graphData, layoutName]);

  // Fetch detailed metadata for selected node
  const fetchNodeDetails = async (nodeId: string) => {
    setLoadingDetails(true);
    try {
      const res = await apiClient.get(`/network/nodes/${nodeId}`);
      if (res.data && res.data.data) {
        setSelectedNodeDetails(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch node details', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Fetch detailed metadata for selected edge
  const fetchEdgeDetails = async (sourceId: string, targetId: string, relType: string) => {
    setLoadingDetails(true);
    try {
      const res = await apiClient.get('/network/relationships', {
        params: { sourceId, targetId, relType },
      });
      if (res.data && res.data.data && res.data.data.relationships) {
        setSelectedEdgeDetails(res.data.data.relationships[0] || { sourceId, targetId, relType });
      }
    } catch (err: any) {
      console.error('Failed to fetch edge details', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Expand Node Neighborhood (+1 Hop)
  const handleExpandNode = async () => {
    if (!selectedNodeId || !cyRef.current) return;

    setExpandingNode(true);
    try {
      const res = await apiClient.get(`/network/nodes/${selectedNodeId}/expand`, {
        params: { maxDepth: 1, limit: 30 },
      });

      if (res.data && res.data.data) {
        const { nodes: newNodes, edges: newEdges } = res.data.data;
        const cy = cyRef.current;

        newNodes.forEach((node: GraphNode) => {
          if (cy.getElementById(node.id).length === 0) {
            cy.add({
              group: 'nodes',
              data: {
                id: node.id,
                label: node.displayName || node.canonicalValue || node.id,
                type: node.type || node.label || 'Entity',
                color: getNodeColor(node.type || node.label || ''),
              },
            });
          }
        });

        newEdges.forEach((edge: GraphEdge) => {
          if (cy.getElementById(edge.id).length === 0) {
            cy.add({
              group: 'edges',
              data: {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.type,
                confidence: edge.confidence || 1.0,
              },
            });
          }
        });

        // Re-run layout on expanded graph
        cy.layout({ name: layoutName as any, animate: true, animationDuration: 500 }).run();
      }
    } catch (err: any) {
      console.error('Failed to expand node neighborhood', err);
    } finally {
      setExpandingNode(false);
    }
  };

  // Find Shortest Path between Path Source and Target
  const handleFindPath = async () => {
    if (!pathSourceId || !pathTargetId) return;

    setFindingPath(true);
    setPathResult(null);
    try {
      const res = await apiClient.get('/network/paths', {
        params: { sourceEntityId: pathSourceId, targetEntityId: pathTargetId, maxDepth: 4 },
      });

      if (res.data && res.data.data) {
        setPathResult(res.data.data);

        // Highlight path on cytoscape canvas
        if (cyRef.current && res.data.data.pathNodes) {
          const cy = cyRef.current;
          cy.elements().removeClass('highlighted faded');
          const pathNodeIds = res.data.data.pathNodes.map((n: any) => n.id);

          pathNodeIds.forEach((id: string) => {
            cy.getElementById(id).addClass('highlighted');
          });

          // Zoom to fit path
          const pathEles = cy.nodes().filter((node) => pathNodeIds.includes(node.id()));
          cy.fit(pathEles, 80);
        }
      } else {
        setPathResult({ message: 'No path found between selected entities.' });
      }
    } catch (err: any) {
      setPathResult({ error: err.response?.data?.message || 'Failed to calculate path.' });
    } finally {
      setFindingPath(false);
    }
  };

  // Search Node on Canvas
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !cyRef.current) return;

    const cy = cyRef.current;
    const queryLower = searchQuery.toLowerCase();
    const matchedNodes = cy.nodes().filter((node) => {
      const label = (node.data('label') || '').toLowerCase();
      const id = (node.id() || '').toLowerCase();
      return label.includes(queryLower) || id.includes(queryLower);
    });

    if (matchedNodes.length > 0) {
      cy.elements().removeClass('highlighted faded');
      cy.elements().difference(matchedNodes).addClass('faded');
      matchedNodes.addClass('highlighted');
      cy.animate({ fit: { eles: matchedNodes, padding: 80 }, duration: 600 });

      if (matchedNodes.length === 1) {
        const nodeId = matchedNodes[0].id();
        setSelectedNodeId(nodeId);
        fetchNodeDetails(nodeId);
      }
    }
  };

  // Zoom / Pan Control Handlers
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 50);
  const handleResetLayout = () => {
    cyRef.current?.elements().removeClass('highlighted faded');
    cyRef.current?.layout({ name: layoutName as any, animate: true, animationDuration: 500 }).run();
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Info */}
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                <span>Interactive Intelligence Network Graph</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                  Neo4j Live Model
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Explore entity relationships, bounded neighborhood expansions, provenance trails & shortest paths.
              </p>
            </div>
          </div>

          {/* Search Bar & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearch} className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search entity value or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </form>

            <button
              onClick={loadGraph}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reload Graph</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs">
          {/* Case Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Filter by Case</label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Authorized Cases</option>
              {casesList.map((c) => (
                <option key={c.id} value={c.id}>
                  Case {c.caseNumber}: {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Entity Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'ALL' ? 'All Entity Types' : t}
                </option>
              ))}
            </select>
          </div>

          {/* Layout Selector */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Graph Layout</label>
            <select
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="cose">Force-Directed (CoSE)</option>
              <option value="concentric">Concentric Circles</option>
              <option value="circle">Simple Circle</option>
              <option value="grid">Grid Array</option>
              <option value="breadthfirst">Hierarchical Trees</option>
            </select>
          </div>

          {/* Confidence Slider */}
          <div>
            <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1">
              <span>Min Confidence</span>
              <span className="text-blue-400 font-mono">{(minConfidence * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-2"
            />
          </div>
        </div>
      </div>

      {/* Main Canvas & Side Panel Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cytoscape Canvas Viewport */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden h-[620px]">
          {/* Canvas Controls Overlay */}
          <div className="absolute top-4 left-4 z-10 flex flex-col space-y-1.5 bg-slate-950/80 backdrop-blur border border-slate-800 p-1.5 rounded-xl shadow-lg">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFit}
              title="Fit View"
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetLayout}
              title="Reset Layout & Selection"
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Graph Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-10 bg-slate-950/80 backdrop-blur border border-slate-800 p-3 rounded-xl shadow-lg max-w-xs hidden md:block text-[10px] space-y-1.5">
            <p className="font-semibold text-slate-300 uppercase tracking-wider text-[9px] mb-1">Entity Legend</p>
            <div className="grid grid-cols-3 gap-x-2 gap-y-1">
              {[
                { type: 'Person', color: '#6366f1' },
                { type: 'Phone', color: '#10b981' },
                { type: 'Email', color: '#f59e0b' },
                { type: 'IP/Domain', color: '#06b6d4' },
                { type: 'Location', color: '#f43f5e' },
                { type: 'Case', color: '#3b82f6' },
                { type: 'Evidence', color: '#a855f7' },
                { type: 'Event', color: '#f97316' },
                { type: 'Account', color: '#eab308' },
              ].map((item) => (
                <div key={item.type} className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-400 truncate">{item.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur flex items-center justify-center space-x-3 text-sm text-slate-300">
              <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
              <span>Rendering Neo4j Intelligence Graph...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute top-4 right-4 z-20 bg-rose-950/90 border border-rose-800/80 text-rose-200 px-4 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg">
              <X className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Cytoscape Container */}
          <div ref={containerRef} className="w-full h-full bg-slate-950/50" />
        </div>

        {/* Right Metadata & Details Panel */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 h-[620px] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span>Intelligence Metadata Panel</span>
            </h3>
            {(selectedNodeId || selectedEdgeDetails) && (
              <button
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedNodeDetails(null);
                  setSelectedEdgeDetails(null);
                  cyRef.current?.elements().removeClass('highlighted faded');
                }}
                className="text-xs text-slate-500 hover:text-slate-300 transition"
              >
                Clear Selection
              </button>
            )}
          </div>

          {/* Loading Details State */}
          {loadingDetails && (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mx-auto" />
              <p>Fetching node metadata & provenance...</p>
            </div>
          )}

          {/* Selected Node Details View */}
          {!loadingDetails && selectedNodeDetails && (
            <div className="space-y-4 text-xs">
              {/* Type Badge & Canonical Value */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className="px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase text-white shadow"
                    style={{ backgroundColor: getNodeColor(selectedNodeDetails.type || selectedNodeDetails.label || '') }}
                  >
                    {selectedNodeDetails.type || selectedNodeDetails.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">ID: {selectedNodeDetails.id.slice(0, 8)}...</span>
                </div>
                <h4 className="text-sm font-bold text-slate-100 break-all">
                  {selectedNodeDetails.displayName || selectedNodeDetails.canonicalValue || selectedNodeDetails.title}
                </h4>
                <p className="text-[11px] font-mono text-slate-400 break-all">
                  Value: {selectedNodeDetails.canonicalValue || selectedNodeDetails.caseNumber || 'N/A'}
                </p>
              </div>

              {/* Action: Expand Node */}
              <button
                onClick={handleExpandNode}
                disabled={expandingNode}
                className="w-full flex items-center justify-center space-x-2 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 rounded-xl font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <Plus className={`w-4 h-4 ${expandingNode ? 'animate-spin' : ''}`} />
                <span>{expandingNode ? 'Expanding Neighborhood...' : 'Expand Node (+1 Hop)'}</span>
              </button>

              {/* Pathfinding Action Setup */}
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                <p className="font-semibold text-slate-300 text-[11px]">Shortest Path Analysis</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <button
                    onClick={() => setPathSourceId(selectedNodeDetails.id)}
                    className={`py-1.5 px-2 rounded-lg border font-medium truncate transition ${
                      pathSourceId === selectedNodeDetails.id
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pathSourceId === selectedNodeDetails.id ? 'Start Set' : 'Set as Start'}
                  </button>
                  <button
                    onClick={() => setPathTargetId(selectedNodeDetails.id)}
                    className={`py-1.5 px-2 rounded-lg border font-medium truncate transition ${
                      pathTargetId === selectedNodeDetails.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pathTargetId === selectedNodeDetails.id ? 'Target Set' : 'Set as Target'}
                  </button>
                </div>
              </div>

              {/* Node Properties */}
              {selectedNodeDetails.properties && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-300">Properties</p>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 space-y-1.5 font-mono text-[11px] max-h-40 overflow-y-auto">
                    {Object.entries(selectedNodeDetails.properties).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-900 pb-1">
                        <span className="text-slate-500">{k}:</span>
                        <span className="text-slate-300 truncate max-w-[160px]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Cases */}
              {selectedNodeDetails.cases && selectedNodeDetails.cases.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-300">Associated Cases</p>
                  <div className="space-y-1.5">
                    {selectedNodeDetails.cases.map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => onSelectCase && onSelectCase(c.id)}
                        className="p-2.5 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer transition"
                      >
                        <div>
                          <p className="font-semibold text-slate-200">Case {c.caseNumber}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{c.title}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence Provenance */}
              {selectedNodeDetails.evidenceMentions && selectedNodeDetails.evidenceMentions.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-300">Evidence Provenance ({selectedNodeDetails.evidenceMentions.length})</p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedNodeDetails.evidenceMentions.map((m: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-blue-400 font-semibold">{m.evidenceTitle || 'Evidence Document'}</span>
                          <span className="text-slate-500 font-mono">Conf: {(m.confidence * 100).toFixed(0)}%</span>
                        </div>
                        {m.snippet && <p className="text-[10px] text-slate-400 italic font-mono bg-slate-900 p-1.5 rounded">"{m.snippet}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected Edge Details View */}
          {!loadingDetails && selectedEdgeDetails && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 uppercase">
                  RELATIONSHIP: {selectedEdgeDetails.type || selectedEdgeDetails.relType}
                </span>
                <div className="flex items-center justify-between pt-1 text-slate-300 font-mono text-[11px]">
                  <span>Confidence:</span>
                  <span className="text-emerald-400 font-bold">
                    {((selectedEdgeDetails.confidence || selectedEdgeDetails.properties?.confidence || 0.9) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {selectedEdgeDetails.provenance && (
                <div className="space-y-1.5">
                  <p className="font-semibold text-slate-300">Provenance Trail</p>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 font-mono leading-relaxed">
                    {selectedEdgeDetails.provenance}
                  </div>
                </div>
              )}

              {selectedEdgeDetails.properties && Object.keys(selectedEdgeDetails.properties).length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-300">Edge Properties</p>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1 font-mono text-[11px]">
                    {Object.entries(selectedEdgeDetails.properties).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-900 pb-1">
                        <span className="text-slate-500">{k}:</span>
                        <span className="text-slate-300">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shortest Path Calculation Widget Panel */}
          {(pathSourceId || pathTargetId) && (
            <div className="p-3.5 bg-slate-950 border border-blue-900/40 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-400 flex items-center space-x-1.5">
                  <GitCommit className="w-4 h-4" />
                  <span>Pathfinder Tool</span>
                </span>
                <button
                  onClick={() => {
                    setPathSourceId(null);
                    setPathTargetId(null);
                    setPathResult(null);
                  }}
                  className="text-slate-500 hover:text-slate-300 text-[10px]"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Source Node:</span>
                  <span className="text-blue-300 truncate max-w-[140px]">{pathSourceId || 'Not Selected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Node:</span>
                  <span className="text-emerald-300 truncate max-w-[140px]">{pathTargetId || 'Not Selected'}</span>
                </div>
              </div>

              <button
                onClick={handleFindPath}
                disabled={!pathSourceId || !pathTargetId || findingPath}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition shadow cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${findingPath ? 'animate-spin' : ''}`} />
                <span>Calculate Shortest Path</span>
              </button>

              {pathResult && (
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] space-y-1">
                  {pathResult.hopCount !== undefined ? (
                    <div>
                      <p className="text-emerald-400 font-bold">Path Found! {pathResult.hopCount} Hops</p>
                      <p className="text-slate-400 font-mono mt-1">{pathResult.provenance}</p>
                    </div>
                  ) : (
                    <p className="text-rose-400">{pathResult.message || pathResult.error || 'No path available'}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Default Empty Selection State */}
          {!loadingDetails && !selectedNodeDetails && !selectedEdgeDetails && !pathSourceId && !pathTargetId && (
            <div className="p-8 text-center text-xs text-slate-500 space-y-3 border border-dashed border-slate-800 rounded-2xl">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <div>
                <p className="font-semibold text-slate-400">No Element Selected</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Click on any node or edge in the graph canvas to inspect properties, provenance, cases & evidence links.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
