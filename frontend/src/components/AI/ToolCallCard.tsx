import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const statusConfig = {
  pending: { color: 'text-gray-400', bg: 'bg-gray-500/10', dot: 'bg-gray-400' },
  running: { color: 'text-jarvis-400', bg: 'bg-jarvis-500/10', dot: 'bg-jarvis-500 animate-pulse' },
  completed: { color: 'text-green-400', bg: 'bg-green-500/10', dot: 'bg-green-400' },
  failed: { color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400' },
};

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  const [elapsed, setElapsed] = useState(0);
  const [showArgs, setShowArgs] = useState(false);
  const config = statusConfig[toolCall.status];

  useEffect(() => {
    if (toolCall.status !== 'running' || !toolCall.startTime) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - (toolCall.startTime || Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [toolCall.status, toolCall.startTime]);

  const formatElapsed = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-3 ${config.bg} border-jarvis-glass-border`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.dot}`} />
          <span className="text-sm font-medium text-gray-200">🔧 {toolCall.name}</span>
          <span className={`text-xs font-medium ${config.color}`}>{toolCall.status}</span>
        </div>
        <div className="flex items-center gap-2">
          {toolCall.status === 'running' && (
            <span className="text-xs text-gray-500 font-mono">{formatElapsed(elapsed)}</span>
          )}
          {toolCall.status === 'completed' && toolCall.endTime && toolCall.startTime && (
            <span className="text-xs text-gray-500 font-mono">{toolCall.endTime - toolCall.startTime}ms</span>
          )}
          <button
            onClick={() => setShowArgs(!showArgs)}
            className="text-xs text-gray-500 hover:text-gray-300"
            aria-label="Toggle arguments"
          >
            {showArgs ? 'Hide' : 'Args'}
          </button>
        </div>
      </div>

      {showArgs && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-2 overflow-hidden"
        >
          <pre className="text-xs text-gray-400 font-mono bg-jarvis-darker/50 rounded-lg p-2 overflow-x-auto">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        </motion.div>
      )}

      {toolCall.status === 'completed' && toolCall.result && (
        <div className="mt-2 text-xs text-gray-400 font-mono bg-jarvis-darker/30 rounded-lg p-2 truncate">
          {typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result)}
        </div>
      )}

      {toolCall.status === 'failed' && toolCall.error && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
          {toolCall.error}
        </div>
      )}
    </motion.div>
  );
};
