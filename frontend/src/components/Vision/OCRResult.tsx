import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OCRBlock {
  text: string;
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number };
  language?: string;
}

interface OCRResultProps {
  blocks?: OCRBlock[];
  imageWidth?: number;
  imageHeight?: number;
  className?: string;
}

const sampleBlocks: OCRBlock[] = [
  { text: 'JARVIS AI Assistant', confidence: 0.98, language: 'en' },
  { text: 'System Status: Online', confidence: 0.95, language: 'en' },
  { text: 'Ready for commands', confidence: 0.92, language: 'en' },
];

export const OCRResult: React.FC<OCRResultProps> = ({
  blocks = sampleBlocks,
  className = '',
}) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  if (!blocks || blocks.length === 0) return null;

  const fullText = blocks.map((b) => b.text).join('\n');
  const avgConfidence =
    blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-xl border border-jarvis-glass-border ${className}`}
      role="region"
      aria-label="OCR text results"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-jarvis-glass-border">
        <div className="flex items-center gap-2">
          <span className="text-jarvis-400" role="img" aria-label="OCR icon">
            📝
          </span>
          <span className="text-sm font-medium text-gray-200">
            Recognized Text
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full ${
              avgConfidence > 0.9
                ? 'bg-green-500/10 text-green-400'
                : avgConfidence > 0.7
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : 'bg-red-500/10 text-red-400'
            }`}
          >
            {(avgConfidence * 100).toFixed(0)}%
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-jarvis-400 hover:text-jarvis-300 flex items-center gap-1 transition-colors"
          aria-label={copyStatus === 'copied' ? 'Copied' : 'Copy text'}
        >
          {copyStatus === 'copied' ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="p-4 max-h-48 overflow-y-auto scrollbar-thin">
        <AnimatePresence>
          {blocks.map((block, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="mb-3 last:mb-0"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs text-jarvis-500 font-mono mt-0.5 flex-shrink-0">
                  [{index + 1}]
                </span>
                <div className="flex-1">
                  <p className="text-sm text-gray-200 leading-relaxed">
                    {block.text}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1 bg-jarvis-glass/40 rounded-full overflow-hidden max-w-[100px]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-jarvis-500 to-jarvis-400"
                        style={{ width: `${block.confidence * 100}%` }}
                      />
                    </div>
                    {block.language && (
                      <span className="text-[10px] text-gray-600 uppercase">
                        {block.language}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
