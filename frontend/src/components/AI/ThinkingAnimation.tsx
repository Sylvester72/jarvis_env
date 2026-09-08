import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/index';

const thinkingStages = [
  'Thinking',
  'Processing',
  'Reasoning',
  'Computing',
  'Analyzing',
];

export const ThinkingAnimation: React.FC = () => {
  const isProcessing = useAppStore((state) => state.isProcessing);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setStageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % thinkingStages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  if (!isProcessing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 px-4 py-2.5 glass border-t border-jarvis-glass-border"
      role="status"
      aria-live="polite"
      aria-label="AI is thinking"
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
            className="w-1.5 h-1.5 rounded-full bg-jarvis-500"
            style={{
              boxShadow: '0 0 6px rgba(0, 212, 255, 0.4)',
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.span
          key={stageIndex}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-jarvis-400 font-medium"
        >
          {thinkingStages[stageIndex]}...
        </motion.span>
      </AnimatePresence>

      <div className="flex-1 h-px bg-gradient-to-r from-jarvis-500/30 via-jarvis-500/10 to-transparent ml-2" />
    </motion.div>
  );
};
