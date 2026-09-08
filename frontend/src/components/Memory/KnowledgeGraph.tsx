import React, { useRef, useEffect, useState, useCallback } from 'react';

interface GraphNode {
  id: string;
  label: string;
  type: 'concept' | 'person' | 'place' | 'event' | 'entity';
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
}

interface KnowledgeGraphProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  className?: string;
}

const nodeColors: Record<string, string> = {
  concept: '#00d4ff',
  person: '#10b981',
  place: '#f59e0b',
  event: '#8b5cf6',
  entity: '#ec4899',
};

const sampleNodes: GraphNode[] = [
  { id: '1', label: 'JARVIS', type: 'concept' },
  { id: '2', label: 'Machine Learning', type: 'concept' },
  { id: '3', label: 'User', type: 'person' },
  { id: '4', label: 'Project Alpha', type: 'event' },
  { id: '5', label: 'Database', type: 'entity' },
  { id: '6', label: 'API Gateway', type: 'entity' },
  { id: '7', label: 'Cloud Server', type: 'place' },
  { id: '8', label: 'Developer', type: 'person' },
];

const sampleEdges: GraphEdge[] = [
  { source: '1', target: '2', label: 'uses', weight: 1 },
  { source: '1', target: '3', label: 'serves', weight: 1 },
  { source: '1', target: '4', label: 'manages', weight: 0.8 },
  { source: '4', target: '5', label: 'stores', weight: 0.6 },
  { source: '4', target: '6', label: 'exposes', weight: 0.7 },
  { source: '4', target: '7', label: 'hosted on', weight: 0.5 },
  { source: '3', target: '8', label: 'works with', weight: 0.9 },
  { source: '2', target: '5', label: 'trains on', weight: 0.6 },
];

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  nodes: externalNodes,
  edges: externalEdges,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  const nodes = externalNodes || sampleNodes;
  const edges = externalEdges || sampleEdges;

  // Initialize node positions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const w = rect.width || 600;
    const h = rect.height || 400;
    setDimensions({ width: w, height: h });

    const centerX = w / 2;
    const centerY = h / 2;

    nodes.forEach((node, i) => {
      if (node.x === undefined) {
        const angle = (2 * Math.PI * i) / nodes.length;
        const radius = Math.min(w, h) * 0.3;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      }
      node.vx = 0;
      node.vy = 0;
    });
  }, [nodes]);

  const getNodeAt = useCallback((x: number, y: number) => {
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue;
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy < 400) return node;
    }
    return null;
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const animate = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;

      // Simple force simulation
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (a.x === undefined || a.y === undefined) continue;

        // Center gravity
        a.vx = (a.vx || 0) + (centerX - a.x) * 0.001;
        a.vy = (a.vy || 0) + (centerY - a.y) * 0.001;

        // Repulsion between nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (b.x === undefined || b.y === undefined) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 200 / (dist * dist);
          a.vx = (a.vx || 0) + (dx / dist) * force;
          a.vy = (a.vy || 0) + (dy / dist) * force;
          b.vx = (b.vx || 0) - (dx / dist) * force;
          b.vy = (b.vy || 0) - (dy / dist) * force;
        }

        // Spring attraction along edges
        for (const edge of edges) {
          let other: GraphNode | undefined;
          if (edge.source === a.id) other = nodes.find((n) => n.id === edge.target);
          if (edge.target === a.id) other = nodes.find((n) => n.id === edge.source);
          if (!other || other.x === undefined || other.y === undefined) continue;

          const dx = other.x - a.x;
          const dy = other.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const idealDist = 120;
          const force = (dist - idealDist) * 0.005;
          a.vx = (a.vx || 0) + (dx / dist) * force;
          a.vy = (a.vy || 0) + (dy / dist) * force;
          other.vx = (other.vx || 0) - (dx / dist) * force;
          other.vy = (other.vy || 0) - (dy / dist) * force;
        }

        // Apply velocity with damping
        a.vx = (a.vx || 0) * 0.85;
        a.vy = (a.vy || 0) * 0.85;
        a.x += a.vx || 0;
        a.y += a.vy || 0;

        // Keep within bounds
        a.x = Math.max(20, Math.min(dimensions.width - 20, a.x));
        a.y = Math.max(20, Math.min(dimensions.height - 20, a.y));
      }

      // Draw edges
      edges.forEach((edge) => {
        const source = nodes.find((n) => n.id === edge.source);
        const target = nodes.find((n) => n.id === edge.target);
        if (!source || !target || source.x === undefined || target.x === undefined) return;

        const isHighlighted = selectedNode === source.id || selectedNode === target.id ||
          hoveredNode === source.id || hoveredNode === target.id;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isHighlighted ? 'rgba(0, 212, 255, 0.4)' : 'rgba(0, 212, 255, 0.1)';
        ctx.lineWidth = (edge.weight || 1) * (isHighlighted ? 2 : 1);
        ctx.stroke();

        if (edge.label && isHighlighted) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          ctx.fillStyle = 'rgba(156, 163, 175, 0.6)';
          ctx.font = '9px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(edge.label, midX, midY - 6);
        }
      });

      // Draw nodes
      nodes.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return;

        const isSelected = selectedNode === node.id;
        const isHovered = hoveredNode === node.id;
        const radius = isSelected ? 10 : isHovered ? 9 : 7;
        const color = nodeColors[node.type] || '#00d4ff';

        // Glow
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = `${color}15`;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${color}30`;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + radius + 14);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [nodes, edges, dimensions, selectedNode, hoveredNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = getNodeAt(x, y);
    setHoveredNode(node?.id || null);
    setTooltip(node ? { x: e.clientX - rect.left, y: e.clientY - rect.top - 30, text: node.label } : null);
  }, [getNodeAt]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = getNodeAt(x, y);
    setSelectedNode(node?.id || null);
  }, [getNodeAt]);

  return (
    <div className={`relative ${className}`} role="region" aria-label="Knowledge graph">
      <div className="glass rounded-xl border border-jarvis-glass-border overflow-hidden" style={{ height: '400px' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer"
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseLeave={() => { setHoveredNode(null); setTooltip(null); }}
        />
        {tooltip && (
          <div
            className="absolute pointer-events-none px-2 py-1 rounded-lg text-xs font-medium bg-jarvis-darker/90 backdrop-blur-md border border-jarvis-glass-border text-gray-200 shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-4 mt-3">
        {Object.entries(nodeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-gray-500 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
