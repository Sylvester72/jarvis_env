import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { formatTimestamp } from '../../utils/formatting';

interface MessageBubbleProps {
  message: {
    id: string;
    role: string;
    content: string;
    timestamp: number;
    toolCalls?: any[];
  };
  isStreaming?: boolean;
}

function renderContent(content: string): React.ReactNode {
  const blocks: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push(
        <p key={`text-${blockIndex}`} className="whitespace-pre-wrap">
          {content.slice(lastIndex, match.index)}
        </p>
      );
    }

    const language = match[1] || 'text';
    const code = match[2];

    blocks.push(
      <div key={`code-${blockIndex}`} className="code-block group relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 uppercase">{language}</span>
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="text-xs text-jarvis-500 hover:text-jarvis-400 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Copy code"
          >
            Copy
          </button>
        </div>
        <code>{code}</code>
      </div>
    );

    lastIndex = match.index + match[0].length;
    blockIndex++;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    const lines = remaining.split('\n');
    blocks.push(
      <p key={`text-${blockIndex}`} className="whitespace-pre-wrap">
        {remaining}
      </p>
    );
  }

  return blocks;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming }) => {
  const [showTime, setShowTime] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : isSystem ? 'justify-center' : 'justify-start'} mb-2`}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      <div className="flex items-start gap-2 max-w-[80%]">
        {isAssistant && (
          <div className="w-7 h-7 rounded-full bg-jarvis-500/20 flex items-center justify-center flex-shrink-0 mt-1">
            <span className="text-xs">🤖</span>
          </div>
        )}
        <div>
          <div className={`message-bubble ${message.role}`} role="article" aria-label={`${message.role} message`}>
            {isAssistant || message.role === 'system' ? (
              <div className={`text-sm leading-relaxed ${isStreaming ? 'border-r-2 border-jarvis-500 animate-pulse' : ''}`}>
                {renderContent(message.content)}
              </div>
            ) : (
              <p className="text-sm leading-relaxed">{message.content}</p>
            )}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mt-2 pt-2 border-t border-jarvis-glass-border">
                {message.toolCalls.map((tc: any) => (
                  <div key={tc.id} className="text-xs text-jarvis-400 flex items-center gap-1">
                    <span>🔧</span>
                    <span>{tc.name}</span>
                    <span className={`ml-auto ${tc.status === 'completed' ? 'text-green-400' : tc.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {tc.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {showTime && (
            <p className={`text-xs text-gray-600 mt-0.5 ${isUser ? 'text-right' : 'text-left'}`}>
              {formatTimestamp(message.timestamp, 'time')}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
