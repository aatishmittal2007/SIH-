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
  ChevronRight,
  Filter,
  Eye,
  Network,
  Activity
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

type EdgeLabelMode = 'SMART' | 'HOVER' | 'ALL' | 'OFF';
type LinkFilterMode = 'ALL' | 'ANALYTICAL' | 'STRUCTURAL';

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
  const [layoutName, setLayoutName] = useState<string>('concentric');
  const [edgeLabelMode, setEdgeLabelMode] = useState<EdgeLabelMode>('SMART');
  const [linkFilter, setLinkFilter] = useState<LinkFilterMode>('ALL');
  const [highlightedLegendType, setHighlightedLegendType] = useState<string | null>(null);

  // Graph Data
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [casesList, setCasesList] = useState<Array<{ id: string; caseNumber: string; title: string }>>([]);

  // Selection & Side Panel State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<any | null>(null);
  const [selectedEdgeDetails, setSelectedEdgeDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [expandingNode, setExpandingNode] = useState<boolean>(false);

  // Hover HUD info
  const [hoveredNode, setHoveredNode] = useState<{
    id: string;
    label: string;
    type: string;
    degree: number;
    value: string;
  } | null>(null);

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

  // Structural relationship types that form case spokes
  const STRUCTURAL_EDGE_TYPES = new Set([
    'INVOLVES',
    'HAS_EVIDENCE',
    'PART_OF',
    'HAS_EVENT',
    'OCCURRED_AT',
    'RECORDED_IN'
  ]);

  const isStructuralRel = (type: string) => STRUCTURAL_EDGE_TYPES.has(type.toUpperCase());

  // Node Color Mapping with High-Contrast Cyber Palette
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
        return '#B026FF'; // Vibrant Magenta
      case 'DOMAIN':
      case 'URL':
        return '#a855f7'; // Violet
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
        return '#9333ea'; // Deep Violet
      case 'CASE':
        return '#DC2626'; // Command Crimson Red
      default:
        return '#94a3b8'; // Muted Slate
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
      const params: any = { limit: 160 };
      if (selectedCaseId) params.caseId = selectedCaseId;
      if (selectedType !== 'ALL') params.entityType = selectedType;
      if (minConfidence > 0) params.minConfidence = minConfidence;

      const res = await apiClient.get('/network/interactive', { params });
      const data: any = unwrapData(res.data);
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

  // Layout Configuration Generator
  const getLayoutOptions = (name: string): cytoscape.LayoutOptions => {
    switch (name) {
      case 'concentric':
        return {
          name: 'concentric',
          animate: true,
          animationDuration: 750,
          padding: 60,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: true,
          minNodeSpacing: 65,
          spacingFactor: 1.35,
          startAngle: (3 / 2) * Math.PI,
          clockwise: true,
          equidistant: false,
          concentric: (node: any) => {
            const type = (node.data('type') || '').toUpperCase();
            if (type === 'CASE') return 5;
            if (type === 'PERSON' || type === 'ORGANIZATION') return 4;
            if (['PHONE', 'EMAIL', 'ACCOUNT', 'TRANSACTION', 'USERNAME'].includes(type)) return 3;
            if (['IP', 'DOMAIN', 'URL', 'DEVICE'].includes(type)) return 2;
            return 1; // EVIDENCE, EVENT, LOCATION
          },
          levelWidth: () => 1,
        } as any;

      case 'cose':
        return {
          name: 'cose',
          animate: true,
          animationDuration: 850,
          padding: 60,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: true,
          nodeRepulsion: () => 650000,
          idealEdgeLength: (edge: any) => {
            return edge.data('isStructural') ? 140 : 95;
          },
          edgeElasticity: () => 32,
          nestingFactor: 1.2,
          gravity: 0.15,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0,
          nodeOverlap: 30,
          componentSpacing: 130,
          randomize: false,
        } as any;

      case 'breadthfirst':
        return {
          name: 'breadthfirst',
          animate: true,
          animationDuration: 650,
          padding: 60,
          directed: true,
          roots: 'node[type = "CASE"]',
          spacingFactor: 1.6,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: true,
        } as any;

      case 'circle':
        return {
          name: 'circle',
          animate: true,
          animationDuration: 600,
          padding: 60,
          avoidOverlap: true,
          spacingFactor: 1.4,
          nodeDimensionsIncludeLabels: true,
        } as any;

      case 'grid':
        return {
          name: 'grid',
          animate: true,
          animationDuration: 500,
          padding: 60,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: true,
        } as any;

      default:
        return {
          name: name as any,
          animate: true,
          animationDuration: 500,
          padding: 50,
        };
    }
  };

  // Initialize and Update Cytoscape Canvas
  useEffect(() => {
    if (!containerRef.current) return;

    // Filter edges based on linkFilter mode
    let visibleEdges = graphData.edges;
    if (linkFilter === 'ANALYTICAL') {
      visibleEdges = graphData.edges.filter((e) => !isStructuralRel(e.type));
    } else if (linkFilter === 'STRUCTURAL') {
      visibleEdges = graphData.edges.filter((e) => isStructuralRel(e.type));
    }

    // Compute degree map for node scaling
    const degreeMap: Record<string, number> = {};
    visibleEdges.forEach((edge) => {
      if (edge.source) degreeMap[edge.source] = (degreeMap[edge.source] || 0) + 1;
      if (edge.target) degreeMap[edge.target] = (degreeMap[edge.target] || 0) + 1;
    });

    const elements: cytoscape.ElementDefinition[] = [
      ...graphData.nodes.map((node) => {
        const type = (node.type || node.label || 'Entity').toUpperCase();
        const isCase = type === 'CASE';
        const isEvidence = type === 'EVIDENCE';
        const isEvent = type === 'EVENT';
        const degree = degreeMap[node.id] || 0;

        // Systematic node sizing
        let nodeSize = 36;
        if (isCase) {
          nodeSize = 54;
        } else if (isEvidence) {
          nodeSize = 42;
        } else if (isEvent) {
          nodeSize = 38;
        } else {
          // Dynamic degree scaling for key suspects / entities
          nodeSize = Math.min(50, Math.max(34, 34 + degree * 2));
        }

        return {
          data: {
            id: node.id,
            label: node.displayName || node.canonicalValue || node.id,
            canonicalValue: node.canonicalValue || node.displayName || node.id,
            type,
            isCase,
            isEvidence,
            isEvent,
            degree,
            nodeSize,
            color: getNodeColor(type),
          },
        };
      }),
      ...visibleEdges.map((edge) => {
        const edgeType = (edge.type || '').toUpperCase();
        const isStructural = isStructuralRel(edgeType);
        const isContradiction = edgeType === 'CONTRADICTS' || edgeType === 'ALERT';
        const isResolved = edgeType === 'RESOLVED_TO' || edgeType === 'SAME_AS';
        const isAnalytical = !isStructural && !isContradiction && !isResolved;

        return {
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.type,
            confidence: edge.confidence || 1.0,
            isStructural,
            isContradiction,
            isResolved,
            isAnalytical,
          },
        };
      }),
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        // Base Node Style
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#F1F5F9',
            'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            'font-size': '10px',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-max-width': '95px',
            'text-wrap': 'ellipsis',
            'text-background-color': '#08070B',
            'text-background-opacity': 0.88,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-border-width': 1,
            'text-border-color': 'rgba(139, 92, 246, 0.25)',
            'text-border-opacity': 0.7,
            'width': 'data(nodeSize)',
            'height': 'data(nodeSize)',
            'border-width': 2,
            'border-color': '#FFFFFF',
            'border-opacity': 0.8,
            'overlay-padding': '4px',
            'transition-property': 'background-color, border-color, border-width, width, height, opacity',
            'transition-duration': 0.25,
          },
        },
        // CASE Command Hub Node
        {
          selector: 'node[?isCase]',
          style: {
            'shape': 'round-rectangle',
            'width': 54,
            'height': 54,
            'background-color': '#DC2626',
            'border-width': 3,
            'border-color': '#EF4444',
            'border-opacity': 0.95,
            'font-size': '11px',
            'font-weight': 700,
            'color': '#FFFFFF',
            'text-border-color': 'rgba(220, 38, 38, 0.5)',
            'z-index': 25,
          },
        },
        // EVIDENCE Document Node
        {
          selector: 'node[?isEvidence]',
          style: {
            'shape': 'round-rectangle',
            'border-width': 2,
            'border-color': '#C084FC',
            'border-opacity': 0.9,
            'z-index': 15,
          },
        },
        // EVENT Node
        {
          selector: 'node[?isEvent]',
          style: {
            'shape': 'diamond',
            'border-width': 2,
            'border-color': '#FB923C',
            'border-opacity': 0.9,
          },
        },
        // Selected Node
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#B026FF',
            'border-opacity': 1.0,
            'text-border-color': '#B026FF',
            'text-border-width': 1.5,
            'z-index': 50,
          },
        },
        // Hovered Node
        {
          selector: 'node.hovered',
          style: {
            'border-width': 3.5,
            'border-color': '#B026FF',
            'border-opacity': 1.0,
            'z-index': 40,
          },
        },

        // Base Edge Style
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'control-point-step-size': 40,
            'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            'font-size': '8.5px',
            'font-weight': 600,
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.88,
            'text-background-color': '#08070B',
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'text-border-width': 1,
            'text-border-color': 'rgba(255, 255, 255, 0.12)',
            'transition-property': 'line-color, target-arrow-color, width, opacity',
            'transition-duration': 0.2,
          },
        },
        // Structural Edges (Muted, Dashed, Thin)
        {
          selector: 'edge[?isStructural]',
          style: {
            'width': 1.5,
            'line-style': 'dashed',
            'line-dash-pattern': [4, 4],
            'line-color': 'rgba(148, 163, 184, 0.35)',
            'target-arrow-color': 'rgba(148, 163, 184, 0.45)',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.75,
            'opacity': 0.35,
            'color': '#94A3B8',
            'z-index': 2,
          },
        },
        // Analytical / Intelligence Relationships (Vibrant Cyber Magenta)
        {
          selector: 'edge[?isAnalytical]',
          style: {
            'width': 2.5,
            'line-style': 'solid',
            'line-color': '#B026FF',
            'target-arrow-color': '#B026FF',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.9,
            'opacity': 0.85,
            'color': '#C084FC',
            'z-index': 10,
          },
        },
        // Contradiction / Conflict Links (Crimson Warning)
        {
          selector: 'edge[?isContradiction]',
          style: {
            'width': 2.5,
            'line-style': 'dashed',
            'line-dash-pattern': [6, 3],
            'line-color': '#DC2626',
            'target-arrow-color': '#DC2626',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.95,
            'opacity': 0.95,
            'color': '#FCA5A5',
            'z-index': 15,
          },
        },
        // Resolved / Same-As Links (Emerald Green)
        {
          selector: 'edge[?isResolved]',
          style: {
            'width': 2,
            'line-style': 'dotted',
            'line-color': '#10B981',
            'target-arrow-color': '#10B981',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.85,
            'opacity': 0.85,
            'color': '#6EE7B7',
            'z-index': 10,
          },
        },

        // Dynamic Edge Labeling based on EdgeLabelMode
        ...(edgeLabelMode === 'OFF'
          ? [
              {
                selector: 'edge',
                style: { 'label': '' },
              },
            ]
          : edgeLabelMode === 'HOVER'
          ? [
              {
                selector: 'edge',
                style: { 'label': '' },
              },
              {
                selector: 'edge.show-label, edge:selected',
                style: { 'label': 'data(label)' },
              },
            ]
          : edgeLabelMode === 'SMART'
          ? [
              {
                selector: 'edge[?isStructural]',
                style: { 'label': '' },
              },
              {
                selector: 'edge[?isAnalytical], edge[?isContradiction], edge[?isResolved]',
                style: { 'label': 'data(label)' },
              },
              {
                selector: 'edge[?isStructural].show-label, edge[?isStructural]:selected',
                style: { 'label': 'data(label)' },
              },
            ]
          : [
              // ALL mode
              {
                selector: 'edge',
                style: { 'label': 'data(label)' },
              },
            ]),

        // Selected Edge
        {
          selector: 'edge:selected',
          style: {
            'width': 4,
            'line-color': '#B026FF',
            'target-arrow-color': '#B026FF',
            'opacity': 1.0,
            'label': 'data(label)',
            'z-index': 30,
          },
        },

        // Highlighted Neighborhood or Path
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 3.5,
            'border-color': '#B026FF',
            'border-opacity': 1.0,
            'opacity': 1.0,
            'z-index': 35,
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'width': 3.5,
            'line-color': '#B026FF',
            'target-arrow-color': '#B026FF',
            'opacity': 1.0,
            'label': 'data(label)',
            'z-index': 25,
          },
        },

        // Dimmed Non-Neighborhood Elements
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.12,
          },
        },
      ],
      layout: getLayoutOptions(layoutName),
    });

    // Handle Node Click
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeId = node.id();

      // Highlight neighborhood
      cy.elements().removeClass('highlighted dimmed show-label');
      const neighborhood = node.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass('dimmed');
      neighborhood.addClass('highlighted');
      node.connectedEdges().addClass('show-label');

      setSelectedNodeId(nodeId);
      setSelectedEdgeDetails(null);
      fetchNodeDetails(nodeId);
    });

    // Handle Edge Click
    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      const edgeData = edge.data();

      cy.elements().removeClass('highlighted dimmed show-label');
      edge.addClass('highlighted show-label');
      edge.connectedNodes().addClass('highlighted');
      cy.elements().difference(edge.union(edge.connectedNodes())).addClass('dimmed');

      setSelectedNodeId(null);
      setSelectedNodeDetails(null);
      fetchEdgeDetails(edgeData.source, edgeData.target, edgeData.label);
    });

    // Handle Background Click (Deselect / Unpin)
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted dimmed hovered show-label');
        setSelectedNodeId(null);
        setSelectedNodeDetails(null);
        setSelectedEdgeDetails(null);
        setHoveredNode(null);
      }
    });

    // Handle Node Hover (Interactive 1-hop inspection)
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const d = node.data();
      setHoveredNode({
        id: node.id(),
        label: d.label,
        type: d.type,
        degree: d.degree || 0,
        value: d.canonicalValue || d.label,
      });

      // If no permanent node is selected, show 1-hop focus dynamically
      if (!selectedNodeId && !selectedEdgeDetails) {
        cy.elements().removeClass('hovered dimmed show-label');
        const neighborhood = node.closedNeighborhood();
        node.addClass('hovered');
        neighborhood.connectedEdges().addClass('show-label');
        cy.elements().difference(neighborhood).addClass('dimmed');
      }
    });

    cy.on('mouseout', 'node', () => {
      setHoveredNode(null);
      if (!selectedNodeId && !selectedEdgeDetails) {
        cy.elements().removeClass('hovered dimmed show-label');
      }
    });

    // Auto-fit on initial render
    cy.ready(() => {
      cy.fit(undefined, 50);
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graphData, layoutName, edgeLabelMode, linkFilter]);

  // Handle Legend Type Filter / Highlight
  const handleLegendClick = (type: string) => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    if (highlightedLegendType === type) {
      // Clear highlight
      setHighlightedLegendType(null);
      cy.elements().removeClass('highlighted dimmed');
      return;
    }

    setHighlightedLegendType(type);
    cy.elements().removeClass('highlighted dimmed');

    const matchingNodes = cy.nodes().filter((n) => (n.data('type') || '').toUpperCase() === type.toUpperCase());
    if (matchingNodes.length > 0) {
      cy.elements().difference(matchingNodes).addClass('dimmed');
      matchingNodes.addClass('highlighted');
    }
  };

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
            const type = (node.type || node.label || 'Entity').toUpperCase();
            const isCase = type === 'CASE';
            const isEvidence = type === 'EVIDENCE';
            const isEvent = type === 'EVENT';

            cy.add({
              group: 'nodes',
              data: {
                id: node.id,
                label: node.displayName || node.canonicalValue || node.id,
                canonicalValue: node.canonicalValue || node.displayName || node.id,
                type,
                isCase,
                isEvidence,
                isEvent,
                degree: 1,
                nodeSize: isCase ? 54 : isEvidence ? 42 : isEvent ? 38 : 36,
                color: getNodeColor(type),
              },
            });
          }
        });

        newEdges.forEach((edge: GraphEdge) => {
          if (cy.getElementById(edge.id).length === 0) {
            const edgeType = (edge.type || '').toUpperCase();
            const isStructural = isStructuralRel(edgeType);
            const isContradiction = edgeType === 'CONTRADICTS' || edgeType === 'ALERT';
            const isResolved = edgeType === 'RESOLVED_TO' || edgeType === 'SAME_AS';

            cy.add({
              group: 'edges',
              data: {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.type,
                confidence: edge.confidence || 1.0,
                isStructural,
                isContradiction,
                isResolved,
                isAnalytical: !isStructural && !isContradiction && !isResolved,
              },
            });
          }
        });

        // Re-run layout on expanded graph
        cy.layout(getLayoutOptions(layoutName)).run();
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
          cy.elements().removeClass('highlighted dimmed show-label');
          const pathNodeIds = res.data.data.pathNodes.map((n: any) => n.id);

          const pathEles = cy.collection();
          pathNodeIds.forEach((id: string) => {
            const el = cy.getElementById(id);
            if (el.length > 0) pathEles.merge(el);
          });

          // Highlight connecting path edges
          for (let i = 0; i < pathNodeIds.length - 1; i++) {
            const n1 = cy.getElementById(pathNodeIds[i]);
            const n2 = cy.getElementById(pathNodeIds[i + 1]);
            const edgesBetween = n1.edgesWith(n2);
            pathEles.merge(edgesBetween);
          }

          cy.elements().difference(pathEles).addClass('dimmed');
          pathEles.addClass('highlighted show-label');

          // Zoom to fit path
          cy.animate({ fit: { eles: pathEles, padding: 80 }, duration: 600 });
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
      cy.elements().removeClass('highlighted dimmed show-label');
      cy.elements().difference(matchedNodes).addClass('dimmed');
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
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 50);
  const handleResetLayout = () => {
    setHighlightedLegendType(null);
    cyRef.current?.elements().removeClass('highlighted dimmed show-label hovered');
    cyRef.current?.layout(getLayoutOptions(layoutName)).run();
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] p-4 rounded-2xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B026FF]/40 to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Info */}
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-[#DC2626]/20 to-[#7C3AED]/20 border border-[#7C3AED]/40 rounded-xl text-[#B026FF]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                <span>Interactive Intelligence Network Graph</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-[#7C3AED]/15 text-[#B026FF] border border-[#7C3AED]/30 rounded-full">
                  Neo4j Live Model
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Systematic entity relationship topology, case anchor hubs, intelligence provenance & path analysis.
              </p>
            </div>
          </div>

          {/* Search Bar & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearch} className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search entity name, value or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#15121C] border border-white/[0.08] rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#7C3AED] transition"
              />
            </form>

            <button
              onClick={loadGraph}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-[#DC2626] to-[#7C3AED] hover:from-[#EF4444] hover:to-[#8B5CF6] text-white rounded-xl text-xs font-semibold shadow-md shadow-[#7C3AED]/25 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reload Graph</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-white/[0.08] text-xs">
          {/* Case Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Filter by Case</label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full bg-[#15121C] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-[#7C3AED]"
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
              className="w-full bg-[#15121C] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-[#7C3AED]"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'ALL' ? 'All Entity Types' : t}
                </option>
              ))}
            </select>
          </div>

          {/* Systematic Layout Selector */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span>Graph Layout</span>
              <span className="text-[#B026FF] text-[9px] font-mono font-bold">SYSTEMATIC</span>
            </label>
            <select
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="w-full bg-[#15121C] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-[#7C3AED]"
            >
              <option value="concentric">Concentric Target (Case Hub)</option>
              <option value="cose">Force-Directed (Spread Clusters)</option>
              <option value="breadthfirst">Hierarchical Tree (Top-Down)</option>
              <option value="circle">Radial Perimeter</option>
              <option value="grid">Matrix Array</option>
            </select>
          </div>

          {/* Link Filter Mode */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center space-x-1">
              <Filter className="w-3 h-3 text-[#B026FF]" />
              <span>Link Filter</span>
            </label>
            <select
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value as LinkFilterMode)}
              className="w-full bg-[#15121C] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-[#7C3AED]"
            >
              <option value="ALL">All Links</option>
              <option value="ANALYTICAL">Analytical Only (No Hub Spokes)</option>
              <option value="STRUCTURAL">Structural Only (Case Spokes)</option>
            </select>
          </div>

          {/* Edge Label Visibility Mode */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center space-x-1">
              <Eye className="w-3 h-3 text-[#B026FF]" />
              <span>Edge Labels</span>
            </label>
            <select
              value={edgeLabelMode}
              onChange={(e) => setEdgeLabelMode(e.target.value as EdgeLabelMode)}
              className="w-full bg-[#15121C] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-[#7C3AED]"
            >
              <option value="SMART">Smart (Analytical Only)</option>
              <option value="HOVER">On Hover / Selection Only</option>
              <option value="ALL">Show All Labels</option>
              <option value="OFF">Hide All Labels</option>
            </select>
          </div>

          {/* Confidence Slider */}
          <div>
            <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1">
              <span>Min Confidence</span>
              <span className="text-[#B026FF] font-mono font-semibold">{(minConfidence * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#15121C] rounded-lg appearance-none cursor-pointer accent-[#B026FF] mt-2"
            />
          </div>
        </div>
      </div>

      {/* Main Canvas & Side Panel Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cytoscape Canvas Viewport */}
        <div className="lg:col-span-8 corner-bracket-full bg-[#111019]/80 backdrop-blur-md border border-[rgba(139,92,246,0.20)] rounded-2xl relative overflow-hidden h-[640px] shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#DC2626]/40 to-[#B026FF]/40 pointer-events-none" />

          {/* Canvas Controls Overlay */}
          <div className="absolute top-4 left-4 z-10 flex flex-col space-y-1.5 bg-[#15121C]/90 backdrop-blur border border-[rgba(139,92,246,0.20)] p-1.5 rounded-xl shadow-lg">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1.5 hover:bg-[#201C2D] text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1.5 hover:bg-[#201C2D] text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFit}
              title="Fit to Screen"
              className="p-1.5 hover:bg-[#201C2D] text-slate-300 hover:text-[#B026FF] rounded-lg transition cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetLayout}
              title="Re-run Systematic Layout"
              className="p-1.5 hover:bg-[#201C2D] text-slate-300 hover:text-[#10b981] rounded-lg transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Top Status & Metrics Badge Overlay */}
          <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center space-x-2 bg-[#15121C]/90 backdrop-blur border border-white/[0.08] px-3 py-1.5 rounded-xl text-[10px] font-mono text-slate-300 shadow-lg">
            <span className="flex items-center space-x-1 text-slate-400">
              <Network className="w-3 h-3 text-[#B026FF]" />
              <span>Nodes:</span>
              <strong className="text-white font-bold">{graphData.nodes.length}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center space-x-1 text-slate-400">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Links:</span>
              <strong className="text-white font-bold">{graphData.edges.length}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-[#B026FF] uppercase font-bold tracking-wider">
              {layoutName}
            </span>
          </div>

          {/* Hovered Node Floating HUD Tooltip */}
          {hoveredNode && !selectedNodeId && (
            <div className="absolute bottom-4 right-4 z-10 bg-[#15121C]/95 backdrop-blur border border-[#B026FF]/50 px-3 py-2 rounded-xl text-[11px] shadow-2xl max-w-xs pointer-events-none transition-all duration-150">
              <div className="flex items-center justify-between space-x-2">
                <span
                  className="px-1.5 py-0.5 rounded font-bold text-[9px] uppercase text-white shadow-sm"
                  style={{ backgroundColor: getNodeColor(hoveredNode.type) }}
                >
                  {hoveredNode.type}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Links: <strong className="text-white font-bold">{hoveredNode.degree}</strong>
                </span>
              </div>
              <p className="text-slate-100 font-bold text-xs mt-1 truncate">{hoveredNode.label}</p>
              {hoveredNode.value && hoveredNode.value !== hoveredNode.label && (
                <p className="text-slate-400 font-mono text-[10px] truncate">{hoveredNode.value}</p>
              )}
            </div>
          )}

          {/* Interactive Graph Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-10 bg-[#15121C]/90 backdrop-blur border border-[rgba(139,92,246,0.20)] p-3 rounded-xl shadow-lg max-w-sm hidden md:block text-[10px] space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-slate-300 uppercase tracking-wider text-[9px]">
                Interactive Legend (Click to Focus)
              </p>
              {highlightedLegendType && (
                <button
                  onClick={() => handleLegendClick(highlightedLegendType)}
                  className="text-[9px] text-[#B026FF] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1">
              {[
                { type: 'Case', color: '#DC2626' },
                { type: 'Person', color: '#6366f1' },
                { type: 'Organization', color: '#ec4899' },
                { type: 'Phone', color: '#10b981' },
                { type: 'Email', color: '#f59e0b' },
                { type: 'IP', color: '#B026FF' },
                { type: 'Evidence', color: '#9333ea' },
                { type: 'Event', color: '#f97316' },
                { type: 'Account', color: '#eab308' },
              ].map((item) => {
                const isHighlighted = highlightedLegendType === item.type;
                return (
                  <button
                    key={item.type}
                    onClick={() => handleLegendClick(item.type)}
                    className={`flex items-center space-x-1.5 text-left py-0.5 px-1 rounded transition cursor-pointer ${
                      isHighlighted ? 'bg-[#7C3AED]/30 text-white font-bold' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300 truncate">{item.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="absolute inset-0 z-20 bg-[#08070B]/85 backdrop-blur flex items-center justify-center space-x-3 text-sm text-slate-300">
              <RefreshCw className="w-5 h-5 text-[#B026FF] animate-spin" />
              <span>Rendering Systematic Intelligence Graph...</span>
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
          <div ref={containerRef} className="w-full h-full bg-[#08070B]/80" />
        </div>

        {/* Right Metadata & Details Panel */}
        <div className="lg:col-span-4 corner-bracket bg-[#111019]/85 backdrop-blur-md border border-[rgba(139,92,246,0.20)] rounded-2xl p-5 space-y-5 h-[640px] overflow-y-auto shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#7C3AED]/40 to-transparent pointer-events-none" />
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <Info className="w-4 h-4 text-[#B026FF]" />
              <span>Intelligence Metadata Panel</span>
            </h3>
            {(selectedNodeId || selectedEdgeDetails) && (
              <button
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedNodeDetails(null);
                  setSelectedEdgeDetails(null);
                  cyRef.current?.elements().removeClass('highlighted dimmed show-label hovered');
                }}
                className="text-xs text-slate-500 hover:text-slate-300 transition cursor-pointer"
              >
                Clear Selection
              </button>
            )}
          </div>

          {/* Loading Details State */}
          {loadingDetails && (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-5 h-5 text-[#B026FF] animate-spin mx-auto" />
              <p>Fetching node metadata & provenance...</p>
            </div>
          )}

          {/* Selected Node Details View */}
          {!loadingDetails && selectedNodeDetails && (
            <div className="space-y-4 text-xs">
              {/* Type Badge & Canonical Value */}
              <div className="p-3.5 bg-[#15121C] border border-white/[0.08] rounded-xl space-y-2">
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
                className="w-full flex items-center justify-center space-x-2 py-2 bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 border border-[#7C3AED]/40 text-[#B026FF] rounded-xl font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <Plus className={`w-4 h-4 ${expandingNode ? 'animate-spin' : ''}`} />
                <span>{expandingNode ? 'Expanding Neighborhood...' : 'Expand Node (+1 Hop)'}</span>
              </button>

              {/* Pathfinding Action Setup */}
              <div className="p-3 bg-[#15121C] border border-white/[0.08] rounded-xl space-y-2">
                <p className="font-semibold text-slate-300 text-[11px]">Shortest Path Analysis</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <button
                    onClick={() => setPathSourceId(selectedNodeDetails.id)}
                    className={`py-1.5 px-2 rounded-lg border font-medium truncate transition cursor-pointer ${
                      pathSourceId === selectedNodeDetails.id
                        ? 'bg-[#7C3AED]/25 border-[#7C3AED] text-[#B026FF]'
                        : 'bg-[#1C1827] border-white/[0.08] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pathSourceId === selectedNodeDetails.id ? 'Start Set' : 'Set as Start'}
                  </button>
                  <button
                    onClick={() => setPathTargetId(selectedNodeDetails.id)}
                    className={`py-1.5 px-2 rounded-lg border font-medium truncate transition cursor-pointer ${
                      pathTargetId === selectedNodeDetails.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-[#1C1827] border-white/[0.08] text-slate-400 hover:text-slate-200'
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
                  <div className="bg-[#15121C] border border-white/[0.08] rounded-xl p-3 space-y-1.5 font-mono text-[11px] max-h-40 overflow-y-auto">
                    {Object.entries(selectedNodeDetails.properties).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-white/[0.04] pb-1">
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
                        className="p-2.5 bg-[#15121C] hover:bg-[#201C2D] border border-white/[0.08] rounded-xl flex items-center justify-between cursor-pointer transition"
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
                      <div key={idx} className="p-2.5 bg-[#15121C] border border-white/[0.08] rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#B026FF] font-semibold">{m.evidenceTitle || 'Evidence Document'}</span>
                          <span className="text-slate-500 font-mono">Conf: {(m.confidence * 100).toFixed(0)}%</span>
                        </div>
                        {m.snippet && <p className="text-[10px] text-slate-400 italic font-mono bg-[#111019] p-1.5 rounded">"{m.snippet}"</p>}
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
              <div className="p-3.5 bg-[#15121C] border border-white/[0.08] rounded-xl space-y-2">
                <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-[#7C3AED]/20 text-[#B026FF] border border-[#7C3AED]/30 uppercase">
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
                  <div className="p-3 bg-[#15121C] border border-white/[0.08] rounded-xl text-[11px] text-slate-400 font-mono leading-relaxed">
                    {selectedEdgeDetails.provenance}
                  </div>
                </div>
              )}

              {selectedEdgeDetails.properties && Object.keys(selectedEdgeDetails.properties).length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-300">Edge Properties</p>
                  <div className="bg-[#15121C] border border-white/[0.08] rounded-xl p-3 space-y-1 font-mono text-[11px]">
                    {Object.entries(selectedEdgeDetails.properties).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-white/[0.04] pb-1">
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
            <div className="p-3.5 bg-[#15121C] border border-[#7C3AED]/30 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#B026FF] flex items-center space-x-1.5">
                  <GitCommit className="w-4 h-4" />
                  <span>Pathfinder Tool</span>
                </span>
                <button
                  onClick={() => {
                    setPathSourceId(null);
                    setPathTargetId(null);
                    setPathResult(null);
                  }}
                  className="text-slate-500 hover:text-slate-300 text-[10px] cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Source Node:</span>
                  <span className="text-[#B026FF] truncate max-w-[140px]">{pathSourceId || 'Not Selected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Node:</span>
                  <span className="text-emerald-300 truncate max-w-[140px]">{pathTargetId || 'Not Selected'}</span>
                </div>
              </div>

              <button
                onClick={handleFindPath}
                disabled={!pathSourceId || !pathTargetId || findingPath}
                className="w-full py-2 bg-gradient-to-r from-[#DC2626] to-[#7C3AED] hover:from-[#EF4444] hover:to-[#8B5CF6] text-white rounded-lg font-semibold transition shadow cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${findingPath ? 'animate-spin' : ''}`} />
                <span>Calculate Shortest Path</span>
              </button>

              {pathResult && (
                <div className="p-2.5 bg-[#111019] border border-white/[0.08] rounded-lg text-[10px] space-y-1">
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
            <div className="p-8 text-center text-xs text-slate-500 space-y-3 border border-dashed border-white/[0.08] rounded-2xl">
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
