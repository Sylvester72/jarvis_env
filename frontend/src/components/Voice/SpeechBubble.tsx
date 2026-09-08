import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/index';

export const SpeechBubble: React.FC = () => {
  const transcript = useAppStore((state) => state.transcript);
  const interimTranscript = useAppStore((state) => state.interimTranscript);
  const isListening = useAppStore((state) => state.isListening);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  if (!isListening && !transcript) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass rounded-2xl p-4 max-w-md mx-auto my-2"
      role="region"
      aria-label="Speech transcription"
    >
      <div ref={scrollRef} className="max-h-32 overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {transcript && (
            <motion.p
              key="final"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-gray-200 leading-relaxed"
            >
              {transcript}
            </motion.p>
          )}
          {interimTranscript && (
            <motion.p
              key="interim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-jarvis-400/70 leading-relaxed italic"
            >
              {interimTranscript}
            </motion.p>
          )}
          {isListening && !transcript && !interimTranscript && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-sm text-gray-500"
            >
              Listening...
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {isListening && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-jarvis-glass-border">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-500">Recording</span>
        </div>
      )}
    </motion.div>
  );
};
