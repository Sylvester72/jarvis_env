import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'waiting' | 'completed' | 'error';
  activity?: string;
  subAgents?: Agent[];
}

interface AgentStatusProps {
  agents?: Agent[];
  compact?: boolean;
}

const statusIcons: Record<string, string> = {
  idle: '💤',
  working: '⚡',
  waiting: '⏳',
  completed: '✅',
  error: '❌',
};

const statusColors: Record<string, string> = {
  idle: 'text-gray-400',
  working: 'text-jarvis-400',
  waiting: 'text-yellow-400',
  completed: 'text-green-400',
  error: 'text-red-400',
};

const defaultAgents: Agent[] = [
  {
    id: 'main',
    name: 'JARVIS',
    role: 'Primary Assistant',
    status: 'working',
    activity: 'Processing your request',
    subAgents: [
      { id: 'search', name: 'Web Search', role: 'Search Agent', status: 'waiting', activity: 'Waiting for query' },
      { id: 'reason', name: 'Reasoner', role: 'Reasoning Engine', status: 'completed', activity: 'Analysis complete' },
    ],
  },
];

export const AgentStatus: React.FC<AgentStatusProps> = ({ agents = defaultAgents, compact = false }) => {
  const [expanded, setExpanded] = useState(true);

  const renderAgent = (agent: Agent, depth: number = 0) => (
    <div key={agent.id} className={`${depth > 0 ? 'ml-4 mt-1.5 pl-3 border-l border-jarvis-glass-border' : ''}`}>
      <div className="flex items-center gap-2 py-1">
        <motion.span
          animate={agent.status === 'working' ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-sm"
        >
          {statusIcons[agent.status]}
        </motion.span>
        <span className="text-sm font-medium text-gray-200">{agent.name}</span>
        <span className={`text-xs ${statusColors[agent.status]} font-medium`}>{agent.status}</span>
        {agent.activity && !compact && (
          <span className="text-xs text-gray-500 ml-1 truncate max-w-[200px]">{agent.activity}</span>
        )}
        {agent.status === 'working' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-3 h-3 border-2 border-jarvis-500 border-t-transparent rounded-full ml-auto"
          />
        )}
      </div>
      {agent.subAgents?.map((sub) => renderAgent(sub, depth + 1))}
    </div>
  );

  return (
    <div className="glass rounded-xl border border-jarvis-glass-border overflow-hidden">
      {!compact && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          aria-expanded={expanded}
        >
          <span className="font-medium">Agent Status</span>
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        </button>
      )}

      <AnimatePresence>
        {(expanded || compact) && (
          <motion.div
            initial={compact ? undefined : { height: 0 }}
            animate={compact ? undefined : { height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1">
              {agents.map((agent) => renderAgent(agent))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
