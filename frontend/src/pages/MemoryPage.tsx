import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/index';
import { GlassPanel } from '../components/UI/GlassPanel';
import { HolographicButton } from '../components/UI/HolographicButton';
import { MemorySearch } from '../components/Memory/MemorySearch';
import { MemoryTimeline } from '../components/Memory/MemoryTimeline';

interface MemoryStats {
  totalMemories: number;
  conversations: number;
  facts: number;
  files: number;
  events: number;
  notes: number;
  lastActivity: string;
  storageUsed: string;
  avgRelevance: number;
}

const sampleStats: MemoryStats = {
  totalMemories: 1284,
  conversations: 342,
  facts: 267,
  files: 89,
  events: 412,
  notes: 174,
  lastActivity: '2 minutes ago',
  storageUsed: '24.5 MB',
  avgRelevance: 0.81,
};

interface KnowledgeNode {
  id: string;
  label: string;
  group: string;
  size: number;
  connections: string[];
}

const knowledgeNodes: KnowledgeNode[] = [
  { id: '1', label: 'JARVIS', group: 'system', size: 30, connections: ['2', '3', '4'] },
  { id: '2', label: 'User', group: 'user', size: 24, connections: ['1', '5', '6'] },
  { id: '3', label: 'Project Alpha', group: 'project', size: 18, connections: ['1', '7', '8'] },
  { id: '4', label: 'API Design', group: 'knowledge', size: 14, connections: ['1', '7'] },
  { id: '5', label: 'Preferences', group: 'user', size: 12, connections: ['2', '9'] },
  { id: '6', label: 'Documents', group: 'files', size: 10, connections: ['2'] },
  { id: '7', label: 'Architecture', group: 'knowledge', size: 16, connections: ['3', '4', '10'] },
  { id: '8', label: 'Timeline', group: 'project', size: 8, connections: ['3'] },
  { id: '9', label: 'Settings', group: 'system', size: 6, connections: ['5'] },
  { id: '10', label: 'Tech Stack', group: 'knowledge', size: 10, connections: ['7'] },
];

const groupColors: Record<string, string> = {
  system: '#00d4ff',
  user: '#10b981',
  project: '#f59e0b',
  knowledge: '#8b5cf6',
  files: '#ec4899',
};

const pageVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -16,
    transition: { duration: 0.2, ease: [0.65, 0, 0.35, 1] },
  },
};

export const MemoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'timeline' | 'graph' | 'search'>('timeline');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleSearchResultSelect = useCallback((result: any) => {
    setSearchResults((prev) => [...prev, result]);
  }, []);

  const timelineKey = useMemo(() => `timeline-${activeView}`, [activeView]);

  const renderStatsGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="glass rounded-xl p-3 border border-jarvis-glass-border text-center">
        <p className="text-2xl font-bold text-jarvis-500">
          {sampleStats.totalMemories.toLocaleString()}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">Total Memories</p>
      </div>
      <div className="glass rounded-xl p-3 border border-jarvis-glass-border text-center">
        <p className="text-2xl font-bold text-green-400">
          {sampleStats.conversations}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">Conversations</p>
      </div>
      <div className="glass rounded-xl p-3 border border-jarvis-glass-border text-center">
        <p className="text-2xl font-bold text-purple-400">{sampleStats.facts}</p>
        <p className="text-xs text-gray-500 mt-0.5">Facts & Knowledge</p>
      </div>
      <div className="glass rounded-xl p-3 border border-jarvis-glass-border text-center">
        <p className="text-sm font-medium text-gray-300">
          {sampleStats.lastActivity}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">Last Activity</p>
      </div>
    </div>
  );

  const renderKnowledgeGraph = () => {
    const centerX = 50;
    const centerY = 45;
    const radius = 28;

    const positions = knowledgeNodes.map((node, i) => {
      const angle = (i / knowledgeNodes.length) * 2 * Math.PI - Math.PI / 2;
      const distance = node.size > 20 ? radius * 0.5 : radius * (0.6 + (node.size / 30) * 0.4);
      return {
        ...node,
        x: centerX + distance * Math.cos(angle),
        y: centerY + distance * Math.sin(angle),
      };
    });

    const nodeMap = new Map(positions.map((n) => [n.id, n]));

    return (
      <div className="relative w-full aspect-[16/9] max-h-[400px]">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          aria-label="Knowledge graph visualization"
        >
          {/* Connections */}
          {positions.map((node) =>
            node.connections.map((targetId) => {
              const target = nodeMap.get(targetId);
              if (!target) return null;
              return (
                <line
                  key={`${node.id}-${targetId}`}
                  x1={node.x}
                  y1={node.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="rgba(0, 212, 255, 0.15)"
                  strokeWidth="0.3"
                />
              );
            })
          )}

          {/* Nodes */}
          {positions.map((node) => {
            const color = groupColors[node.group] || '#00d4ff';
            return (
              <motion.g
                key={node.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size * 0.08 + 1.2}
                  fill={`${color}20`}
                  stroke={color}
                  strokeWidth="0.4"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size * 0.04 + 0.6}
                  fill={color}
                  opacity={0.6}
                />
                <text
                  x={node.x}
                  y={node.y + node.size * 0.08 + 2.5}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="1.8"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {node.label}
                </text>
              </motion.g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 right-2 glass-light rounded-lg p-2 border border-jarvis-glass-border">
          <div className="text-[10px] text-gray-500 font-medium mb-1">Legend</div>
          {Object.entries(groupColors).map(([group, color]) => (
            <div key={group} className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize">{group}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col h-full"
      role="region"
      aria-label="Memory page"
    >
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-jarvis-glass-border">
        <div className="flex items-center gap-3">
          <HolographicButton
            variant="ghost"
            size="sm"
            onClick={handleBack}
            ariaLabel="Back to home"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </HolographicButton>
          <h1 className="text-lg font-semibold text-gray-100">Memories</h1>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-1 bg-jarvis-darker/40 rounded-lg p-0.5 border border-jarvis-glass-border">
          {(['timeline', 'graph', 'search'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeView === view
                  ? 'bg-jarvis-500/20 text-jarvis-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              aria-pressed={activeView === view}
            >
              {view === 'timeline' && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <polyline points="8 5 3 12 8 19" />
                </svg>
              )}
              {view === 'graph' && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="19" cy="5" r="2" />
                  <circle cx="5" cy="19" r="2" />
                  <line x1="12" y1="9" x2="17" y2="6" />
                  <line x1="7" y1="17" x2="10" y2="14" />
                </svg>
              )}
              {view === 'search' && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
              <span className="capitalize">{view}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {/* Memory Stats */}
        <GlassPanel intensity="light" padding="md">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-jarvis-400">{'\u{1F9E0}'}</span>
            <h2 className="text-sm font-medium text-gray-200">Memory Overview</h2>
          </div>
          {renderStatsGrid()}
        </GlassPanel>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeView === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <GlassPanel intensity="default" padding="lg">
                <MemorySearch onResultSelect={handleSearchResultSelect} />
              </GlassPanel>
            </motion.div>
          )}

          {activeView === 'timeline' && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <GlassPanel intensity="default" padding="lg">
                <MemoryTimeline key={timelineKey} />
              </GlassPanel>
            </motion.div>
          )}

          {activeView === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <GlassPanel intensity="default" padding="lg">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-jarvis-400">{'\u{1F578}'}</span>
                  <h2 className="text-sm font-medium text-gray-200">
                    Knowledge Graph
                  </h2>
                  <span className="text-[10px] text-gray-600 bg-jarvis-glass/40 px-1.5 py-0.5 rounded">
                    {knowledgeNodes.length} nodes
                  </span>
                </div>
                {renderKnowledgeGraph()}
                <div className="mt-4 pt-4 border-t border-jarvis-glass-border">
                  <p className="text-xs text-gray-500 text-center">
                    Visual representation of connected memories and knowledge areas.
                    Nodes represent topics, edges represent relationships.
                  </p>
                </div>
              </GlassPanel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MemoryPage;
