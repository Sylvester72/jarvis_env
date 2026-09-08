import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/index';

export const WakeWordIndicator: React.FC = () => {
  const isWakeWordEnabled = useAppStore((state) => state.isWakeWordEnabled);
  const isListening = useAppStore((state) => state.isListening);
  const wakeWordDetected = useAppStore((state) => state.wakeWordDetected);
  const wakeWord = useAppStore((state) => state.wakeWord);

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="relative">
        <motion.div
          animate={isListening ? { scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] } : { scale: 1, opacity: 0.2 }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-jarvis-500"
          style={{ width: 32, height: 32 }}
        />
        <motion.div
          animate={wakeWordDetected ? { scale: [1, 1.5, 1], opacity: [1, 0, 1] } : {}}
          transition={{ duration: 0.5 }}
          className="relative w-8 h-8 rounded-full bg-jarvis-500/20 flex items-center justify-center border border-jarvis-500/30"
        >
          <svg className="w-4 h-4 text-jarvis-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        </motion.div>
      </div>

      <div className="flex flex-col">
        <AnimatePresence mode="wait">
          {wakeWordDetected ? (
            <motion.span key="detected" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm font-medium text-green-400">
              Wake word detected!
            </motion.span>
          ) : isListening ? (
            <motion.span key="listening" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-jarvis-400">
              Listening...
            </motion.span>
          ) : (
            <motion.span key="idle" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-gray-400">
              {isWakeWordEnabled ? `Say "${wakeWord}"` : 'Wake word disabled'}
            </motion.span>
          )}
        </AnimatePresence>
        {isListening && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-gray-500">
            Speak your request...
          </motion.span>
        )}
      </div>
    </div>
  );
};
