import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store/index';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { SuggestedActions } from './SuggestedActions';
import { ThinkingAnimation } from '../AI/ThinkingAnimation';

export const ChatPanel: React.FC = () => {
  const messages = useAppStore((state) => {
    const conv = state.conversations.find(c => c.id === state.currentConversationId);
    return conv?.messages || [];
  });
  const isProcessing = useAppStore((state) => state.isProcessing);
  const streamingContent = useAppStore((state) => state.streamingContent);
  const currentConversationId = useAppStore((state) => state.currentConversationId);
  const conversations = useAppStore((state) => state.conversations);

  const currentConv = conversations.find(c => c.id === currentConversationId);

  return (
    <div className="flex flex-col h-full glass rounded-2xl overflow-hidden" role="region" aria-label="Chat Panel">
      {currentConv && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-jarvis-glass-border">
          <h2 className="text-sm font-medium text-gray-200 truncate">{currentConv.title}</h2>
          <span className="text-xs text-gray-500 font-mono">{currentConv.model}</span>
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        {messages.length === 0 && !isProcessing ? (
          <SuggestedActions />
        ) : (
          <MessageList messages={messages} streamingContent={streamingContent} />
        )}
        {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0">
            <ThinkingAnimation />
          </div>
        )}
      </div>
      <MessageInput />
    </div>
  );
};
