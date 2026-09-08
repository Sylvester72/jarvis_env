import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/index';

export const ReasoningChain: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const reasoningChain = useAppStore((state) => state.reasoningChain);
  const isProcessing = useAppStore((state) => state.isProcessing);

  if (reasoningChain.length === 0 && !isProcessing) return null;

  return (
    <div className="glass rounded-xl overflow-hidden border border-jarvis-glass-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        aria-expanded={expanded}
        aria-label="Toggle reasoning steps"
      >
        <div className="flex items-center gap-2">
          <span className="text-jarvis-400">🧠</span>
          <span className="font-medium">Reasoning Chain</span>
          <span className="text-xs text-gray-600">({reasoningChain.length} steps)</span>
        </div>
        <motion.svg
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              {reasoningChain.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3 text-xs"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-jarvis-500/10 text-jarvis-500 flex items-center justify-center text-[10px] font-mono font-medium">
                    {index + 1}
                  </span>
                  <span className="text-gray-400 leading-tight">{step}</span>
                </motion.div>
              ))}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-xs text-jarvis-400"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-jarvis-500 animate-pulse" />
                  <span>Processing next step...</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
