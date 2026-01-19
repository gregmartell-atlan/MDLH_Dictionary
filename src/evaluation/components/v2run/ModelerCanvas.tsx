import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface GraphNode {
  id: string;
  name?: string;
  type?: string;
  position?: { x: number; y: number };
}

interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
}

interface ModelGraph {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

interface ModelerCanvasProps {
  graph: ModelGraph;
}

const buildNodes = (nodes: GraphNode[]): Node[] =>
  nodes.map((node, index) => ({
    id: node.id,
    position: node.position ?? {
      x: (index % 4) * 220,
      y: Math.floor(index / 4) * 140,
    },
    data: {
      label: node.name || node.id,
      type: node.type,
    },
    style: {
      borderRadius: 10,
      border: '1px solid #E2E8F0',
      padding: 10,
      background: '#FFFFFF',
      color: '#0F172A',
      fontSize: 12,
      fontWeight: 600,
    },
  }));

const buildEdges = (edges: GraphEdge[]): Edge[] =>
  edges.map((edge, index) => ({
    id: edge.id ?? `edge-${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: false,
    style: { stroke: '#94A3B8' },
  }));

export function ModelerCanvas({ graph }: ModelerCanvasProps) {
  const initialNodes = useMemo(() => buildNodes(graph.nodes || []), [graph.nodes]);
  const initialEdges = useMemo(() => buildEdges(graph.edges || []), [graph.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialEdges, initialNodes, setEdges, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, type: 'smoothstep', animated: true }, eds)
      );
    },
    [setEdges]
  );

  if (!nodes.length) {
    return (
      <div className="border border-dashed border-slate-300 rounded-lg p-6 text-sm text-slate-500 bg-slate-50">
        Add entities to see them in the visual modeler.
      </div>
    );
  }

  return (
    <div className="h-[320px] sm:h-[420px] border border-slate-200 rounded-lg bg-slate-50" data-testid="modeler-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        nodesDraggable
      >
        <Background gap={16} size={1} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
