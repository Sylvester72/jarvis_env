import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const thinkingPhrases = [
  'Thinking...',
  'Processing...',
  'Analyzing...',
  'Computing...',
  'Reasoning...',
  'Consulting knowledge base...',
];

interface LoaderProps {
  className?: string;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

const dotSizes = {
  sm: 4,
  md: 6,
  lg: 8,
};

const containerSizes = {
  sm: 'min-h-[5rem]',
  md: 'min-h-[8rem]',
  lg: 'min-h-[10rem]',
};

export const Loader: React.FC<LoaderProps> = ({
  className = '',
  text,
  size = 'md',
}) => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const dotSize = dotSizes[size];

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % thinkingPhrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${containerSizes[size]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
            className="rounded-full bg-jarvis-500"
            style={{
              width: dotSize,
              height: dotSize,
              boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)',
            }}
          />
        ))}
      </div>
      <motion.p
        key={phraseIndex}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-sm text-jarvis-400 font-medium"
      >
        {text || thinkingPhrases[phraseIndex]}
      </motion.p>
    </div>
  );
};
