import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/index';
import { ChatPanel } from '../components/Chat/ChatPanel';
import { VoiceIndicator } from '../components/Voice/VoiceIndicator';
import { SpeechBubble } from '../components/Voice/SpeechBubble';
import { ReasoningChain } from '../components/AI/ReasoningChain';
import { AgentStatus } from '../components/AI/AgentStatus';
import { HolographicButton } from '../components/UI/HolographicButton';
import { GlassPanel } from '../components/UI/GlassPanel';

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.2, ease: [0.65, 0, 0.35, 1] },
  },
};

export const MainPage: React.FC = () => {
  const currentConversationId = useAppStore((state) => state.currentConversationId);
  const isProcessing = useAppStore((state) => state.isProcessing);
  const isListening = useAppStore((state) => state.isListening);
  const transcript = useAppStore((state) => state.transcript);
  const interimTranscript = useAppStore((state) => state.interimTranscript);
  const conversations = useAppStore((state) => state.conversations);
  const activeModel = useAppStore((state) => state.activeModel);
  const availableModels = useAppStore((state) => state.availableModels);
  const createConversation = useAppStore((state) => state.createConversation);
  const setActiveModel = useAppStore((state) => state.setActiveModel);

  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const hasActiveConversation = currentConversationId !== null;
  const currentConv = conversations.find((c) => c.id === currentConversationId);
  const showSpeechBubble = isListening || transcript || interimTranscript;

  const handleNewConversation = useCallback(() => {
    createConversation();
  }, [createConversation]);

  const handleModelSelect = useCallback(
    (model: string) => {
      setActiveModel(model);
      setModelDropdownOpen(false);
    },
    [setActiveModel]
  );

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col h-full"
      role="region"
      aria-label="Main assistant interface"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-jarvis-glass-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-jarvis-500 glow-text">
            JARVIS
          </h1>

          {hasActiveConversation && (
            <span className="text-xs text-gray-500 font-mono hidden sm:inline-block truncate max-w-[200px]">
              {currentConv?.title || 'Untitled'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 bg-jarvis-glass/40 border border-jarvis-glass-border hover:border-jarvis-500/30 transition-all"
              aria-haspopup="listbox"
              aria-expanded={modelDropdownOpen}
              aria-label="Select model"
            >
              <svg
                className="w-3.5 h-3.5 text-jarvis-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                <path d="M2 12h20" />
              </svg>
              <span>{activeModel}</span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${
                  modelDropdownOpen ? 'rotate-180' : ''
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <AnimatePresence>
              {modelDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-48 glass-heavy rounded-xl border border-jarvis-glass-border shadow-2xl overflow-hidden z-30"
                  role="listbox"
                  aria-label="Available models"
                >
                  {availableModels.map((model) => (
                    <button
                      key={model}
                      onClick={() => handleModelSelect(model)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                        model === activeModel
                          ? 'text-jarvis-400 bg-jarvis-500/10'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-jarvis-500/5'
                      }`}
                      role="option"
                      aria-selected={model === activeModel}
                    >
                      {model === activeModel && (
                        <svg
                          className="w-3 h-3 text-jarvis-500 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      <span className={model === activeModel ? '' : 'ml-5'}>
                        {model}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* New conversation button */}
          <HolographicButton
            variant="secondary"
            size="sm"
            onClick={handleNewConversation}
            ariaLabel="New conversation"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="hidden sm:inline">New</span>
          </HolographicButton>

          {/* Toggle right panel */}
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className={`p-1.5 rounded-lg transition-all ${
              rightPanelOpen
                ? 'text-jarvis-400 bg-jarvis-500/10'
                : 'text-gray-500 hover:text-gray-300 hover:bg-jarvis-500/5'
            }`}
            aria-label={rightPanelOpen ? 'Close reasoning panel' : 'Open reasoning panel'}
            aria-pressed={rightPanelOpen}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {/* Chat panel - center stage */}
        <div className="flex-1 min-w-0 relative">
          <ChatPanel />

          {/* Voice indicator overlay */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-4 right-4 z-20"
              >
                <div className="glass-heavy rounded-full p-2 border border-jarvis-500/30 shadow-glow">
                  <VoiceIndicator size="md" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Speech bubble when transcribing */}
          <AnimatePresence>
            {showSpeechBubble && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="absolute bottom-16 left-4 right-4 z-20 pointer-events-none"
              >
                <SpeechBubble />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right panel - Reasoning Chain + Agent Status (collapsible) */}
        <AnimatePresence>
          {rightPanelOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex-shrink-0 overflow-hidden"
              role="complementary"
              aria-label="Assistant reasoning and status"
            >
              <div className="w-[280px] h-full flex flex-col gap-3">
                <ReasoningChain />
                <GlassPanel padding="sm" intensity="light">
                  <AgentStatus compact={false} />
                </GlassPanel>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Empty state when no conversation */}
      {!hasActiveConversation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="text-center max-w-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', damping: 15 }}
              className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-jarvis-500/10 border border-jarvis-500/30 flex items-center justify-center"
            >
              <svg
                className="w-10 h-10 text-jarvis-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a10 10 0 0 1 10 10c0 5-4 8-10 8-2 0-4-.5-6-1.5L2 22l3.5-4.5A10 10 0 0 1 12 2z" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl font-semibold text-gray-200 mb-2"
            >
              Start a Conversation
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-gray-500 mb-6"
            >
              Click "New" above or type a message below to begin interacting with JARVIS.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap justify-center gap-2 pointer-events-auto"
            >
              {[
                { icon: '\u{1F4DD}', label: 'Take notes' },
                { icon: '\u{1F4A1}', label: 'Brainstorm ideas' },
                { icon: '\u{1F4BB}', label: 'Write code' },
              ].map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 bg-jarvis-glass/40 border border-jarvis-glass-border"
                >
                  <span>{item.icon}</span>
                  {item.label}
                </span>
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default MainPage;
