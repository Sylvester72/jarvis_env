import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/index';

const suggestions = [
  { icon: '💡', text: 'Help me brainstorm ideas', category: 'Creative' },
  { icon: '📝', text: 'Write a summary of this document', category: 'Writing' },
  { icon: '💻', text: 'Explain how this code works', category: 'Code' },
  { icon: '📊', text: 'Analyze this data for insights', category: 'Analysis' },
  { icon: '🌐', text: 'Search the web for latest news', category: 'Research' },
  { icon: '🔍', text: 'Debug this issue I\'m having', category: 'Help' },
  { icon: '📧', text: 'Draft an email about...', category: 'Writing' },
  { icon: '🧮', text: 'Help me solve this math problem', category: 'Analysis' },
  { icon: '📚', text: 'Summarize this article for me', category: 'Reading' },
  { icon: '🎯', text: 'Create a project plan for...', category: 'Planning' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export const SuggestedActions: React.FC = () => {
  const addMessage = useAppStore((state) => state.addMessage);
  const setIsProcessing = useAppStore((state) => state.setIsProcessing);
  const setStreamingContent = useAppStore((state) => state.setStreamingContent);

  const handleSuggestion = (text: string) => {
    addMessage({ role: 'user', content: text, timestamp: Date.now() });
    setIsProcessing(true);

    let responseText = '';
    const words = `I'd be happy to help with that! Let me process your request.`.split(' ');
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
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-2xl font-bold text-jarvis-500 glow-text mb-2">Good day, sir.</h1>
        <p className="text-gray-400 text-sm">How may I assist you today?</p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-wrap justify-center gap-2 max-w-2xl"
      >
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={index}
            variants={item}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSuggestion(suggestion.text)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass glass-hover text-sm text-gray-300 hover:text-jarvis-400 transition-all duration-200"
            aria-label={suggestion.text}
          >
            <span className="text-base" role="img" aria-hidden="true">{suggestion.icon}</span>
            <span className="whitespace-nowrap">{suggestion.text}</span>
          </motion.button>
        ))}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 text-xs text-gray-600"
      >
        Press Ctrl+L to focus input · Ctrl+Shift+Space for voice
      </motion.p>
    </div>
  );
};
