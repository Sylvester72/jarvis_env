import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/index';

export const VoiceIndicator: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const isListening = useAppStore((state) => state.isListening);
  const isSpeaking = useAppStore((state) => state.isSpeaking);
  const audioLevel = useAppStore((state) => state.audioLevel);

  const sizeMap = { sm: 24, md: 36, lg: 48 };
  const px = sizeMap[size];

  const getStatusColor = () => {
    if (isSpeaking) return '#10b981';
    if (isListening) return '#00d4ff';
    return '#6b7280';
  };

  const getStatusText = () => {
    if (isSpeaking) return 'Speaking';
    if (isListening) return 'Listening';
    return 'Idle';
  };

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: px, height: px }}
      role="status"
      aria-label={`Voice: ${getStatusText()}`}
      aria-live="polite"
    >
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.5, 0.2, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 rounded-full"
            style={{
              border: `2px solid ${getStatusColor()}`,
              transform: `scale(${1 + audioLevel * 0.3})`,
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={
          isListening
            ? { scale: [1, 1 + audioLevel * 0.15, 1] }
            : isSpeaking
            ? { scale: [1, 0.9, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 flex items-center justify-center rounded-full"
        style={{
          width: px * 0.6,
          height: px * 0.6,
          backgroundColor: `${getStatusColor()}22`,
          border: `1.5px solid ${getStatusColor()}44`,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={getStatusColor()}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ width: px * 0.3, height: px * 0.3 }}
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </motion.div>
    </div>
  );
};
