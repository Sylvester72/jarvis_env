import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/index';

export const MessageInput: React.FC = () => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addMessage = useAppStore((state) => state.addMessage);
  const isProcessing = useAppStore((state) => state.isProcessing);
  const isListening = useAppStore((state) => state.isListening);
  const setListening = useAppStore((state) => state.setListening);
  const setIsProcessing = useAppStore((state) => state.setIsProcessing);
  const appendStreamingContent = useAppStore((state) => state.appendStreamingContent);
  const setStreamingContent = useAppStore((state) => state.setStreamingContent);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isProcessing) return;

    addMessage({ role: 'user', content: trimmed, timestamp: Date.now() });
    setText('');

    setIsProcessing(true);

    let responseText = '';
    const words = `I'm processing your request about "${trimmed.substring(0, 40)}". As JARVIS, I'm here to assist you with any task. How can I help you further?`.split(' ');

    let wordIndex = 0;
    const interval = setInterval(() => {
      if (wordIndex < words.length) {
        responseText += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
        setStreamingContent(responseText);
        wordIndex++;
      } else {
        clearInterval(interval);
        addMessage({ role: 'assistant', content: responseText, timestamp: Date.now() });
        setStreamingContent('');
        setIsProcessing(false);
      }
    }, 50);
  }, [text, isProcessing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    setListening(!isListening);
  };

  return (
    <div className="px-4 py-3 border-t border-jarvis-glass-border">
      <div className="glass rounded-2xl p-1.5 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening...' : 'Type a message...'}
          rows={1}
          data-input="message"
          className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 resize-none outline-none px-3 py-2 max-h-40 scrollbar-thin"
          disabled={isProcessing || isListening}
          aria-label="Message input"
        />

        <div className="flex items-center gap-1 pb-1">
          <button
            onClick={toggleVoice}
            className={`p-2 rounded-xl transition-all duration-200 ${
              isListening
                ? 'bg-red-500/20 text-red-400 shadow-glow'
                : 'text-gray-400 hover:text-jarvis-500 hover:bg-jarvis-500/10'
            }`}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            title={isListening ? 'Stop listening' : 'Voice input'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          <button
            onClick={handleSend}
            disabled={!text.trim() || isProcessing}
            className="p-2 rounded-xl bg-jarvis-500/20 text-jarvis-500 hover:bg-jarvis-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {text.length > 0 && (
        <div className="text-right mt-1">
          <span className={`text-xs ${text.length > 4000 ? 'text-red-400' : 'text-gray-600'}`}>
            {text.length}/4000
          </span>
        </div>
      )}
    </div>
  );
};
