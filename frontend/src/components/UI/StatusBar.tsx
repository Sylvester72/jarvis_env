import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/index';
import { VoiceIndicator } from '../Voice/VoiceIndicator';

export const StatusBar: React.FC = () => {
  const status = useAppStore((state) => state.status);
  const activeModel = useAppStore((state) => state.activeModel);
  const conversations = useAppStore((state) => state.conversations);
  const isListening = useAppStore((state) => state.isListening);
  const isMinimalUI = useAppStore((state) => state.isMinimalUI);

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalTokens = conversations.reduce(
    (sum, c) => sum + (c.tokensUsed || 0),
    0
  );

  if (isMinimalUI) return null;

  const statusColors: Record<string, string> = {
    initializing: 'bg-yellow-400',
    ready: 'bg-green-400',
    disconnected: 'bg-gray-500',
    error: 'bg-red-400',
    updating: 'bg-blue-400',
  };

  return (
    <footer
      className="flex items-center justify-between h-7 px-4 bg-jarvis-darker/80 backdrop-blur-md border-t border-jarvis-glass-border text-xs z-40"
      role="status"
      aria-label="Application status"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              statusColors[status] || 'bg-gray-500'
            }`}
            aria-hidden="true"
          />
          <span className="text-gray-500 capitalize">{status}</span>
        </div>
        <span className="text-gray-700" aria-hidden="true">|</span>
        <span className="text-gray-500 font-mono">{activeModel}</span>
        {totalTokens > 0 && (
          <>
            <span className="text-gray-700" aria-hidden="true">|</span>
            <span className="text-gray-600">
              {totalTokens.toLocaleString()} tokens
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <VoiceIndicator size="sm" />
        {isListening && (
          <span className="text-jarvis-400 animate-pulse" aria-live="assertive">
            REC
          </span>
        )}
        <span className="text-gray-700" aria-hidden="true">|</span>
        <span className="text-gray-500 font-mono tabular-nums">
          {time.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </footer>
  );
};
