import React, { useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MessageBubble } from './MessageBubble';
import { useAppStore } from '../../store/index';

interface MessageListProps {
  messages: any[];
  streamingContent?: string;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, streamingContent }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isProcessing = useAppStore((state) => state.isProcessing);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const getDateSeparator = (timestamp: number, prevTimestamp?: number) => {
    if (!prevTimestamp) return true;
    const date = new Date(timestamp);
    const prevDate = new Date(prevTimestamp);
    return date.toDateString() !== prevDate.toDateString();
  };

  return (
    <div ref={containerRef} className="h-full overflow-y-auto scrollbar-thin px-4 py-4 space-y-1">
      <AnimatePresence initial={false}>
        {messages.map((msg, index) => (
          <React.Fragment key={msg.id}>
            {(index === 0 || getDateSeparator(msg.timestamp, messages[index - 1]?.timestamp)) && (
              <div className="flex justify-center my-3">
                <span className="text-xs text-gray-500 bg-jarvis-surface/50 px-3 py-1 rounded-full">
                  {new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
            <MessageBubble message={msg} />
          </React.Fragment>
        ))}
      </AnimatePresence>

      {isProcessing && streamingContent && (
        <MessageBubble
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent,
            timestamp: Date.now(),
          }}
          isStreaming={true}
        />
      )}

      {isProcessing && !streamingContent && (
        <div className="flex items-start gap-2 py-2">
          <div className="w-7 h-7 rounded-full bg-jarvis-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs">🤖</span>
          </div>
          <div className="typing-indicator">
            <span /><span /><span />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
