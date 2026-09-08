import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTimestamp } from '../../utils/formatting';

interface MemoryResult {
  id: string;
  title: string;
  snippet: string;
  type: string;
  timestamp: number;
  relevance: number;
  tags?: string[];
}

interface MemorySearchProps {
  onResultSelect?: (result: MemoryResult) => void;
  className?: string;
}

const sampleResults: MemoryResult[] = [
  { id: '1', title: 'Project Architecture Discussion', snippet: 'Discussed the microservices architecture for the new platform...', type: 'conversation', timestamp: Date.now() - 7200000, relevance: 0.95, tags: ['architecture', 'project'] },
  { id: '2', title: 'Code Review Feedback', snippet: 'Suggested improvements for the authentication module...', type: 'conversation', timestamp: Date.now() - 14400000, relevance: 0.88, tags: ['code', 'review'] },
  { id: '3', title: 'User Preferences', snippet: 'User prefers TypeScript strict mode and comprehensive error handling...', type: 'fact', timestamp: Date.now() - 86400000, relevance: 0.82, tags: ['preference'] },
];

export const MemorySearch: React.FC<MemorySearchProps> = ({ onResultSelect, className = '' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const activeEl = document.activeElement;
        if (activeEl?.tagName !== 'INPUT' && activeEl?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);

    const lower = value.toLowerCase();
    const filtered = sampleResults.filter(
      (r) => r.title.toLowerCase().includes(lower) || r.snippet.toLowerCase().includes(lower)
    ).map((r) => ({
      ...r,
      relevance: r.relevance * (r.title.toLowerCase().includes(lower) ? 1.1 : 0.9),
    })).sort((a, b) => b.relevance - a.relevance);

    setTimeout(() => {
      setResults(filtered);
      setIsSearching(false);
    }, 300);
  }, []);

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="text-jarvis-400 bg-jarvis-500/10 rounded px-0.5">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div className={className} role="search" aria-label="Memory search">
      <div className="relative mb-4">
        <div className="glass rounded-xl border border-jarvis-glass-border focus-within:border-jarvis-500/50 transition-all">
          <div className="flex items-center px-3 py-2.5 gap-2">
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search memories... (Press '/' to focus)"
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
              aria-label="Search memories"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); setHasSearched(false); }}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                {'✕'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-jarvis-500"
                />
              ))}
            </div>
          </div>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
            <span className="text-2xl">{'\u{1F50D}'}</span>
            <p className="text-gray-500 text-sm mt-2">No results found for "{query}"</p>
          </motion.div>
        )}

        {!isSearching && results.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <p className="text-xs text-gray-500 px-1">{results.length} results found</p>
            <AnimatePresence>
              {results.map((result, index) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass rounded-xl p-3 border border-jarvis-glass-border hover:border-jarvis-500/30 transition-all cursor-pointer"
                  onClick={() => onResultSelect?.(result)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-200">{highlightMatch(result.title, query)}</h4>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{highlightMatch(result.snippet, query)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] text-gray-600">{formatTimestamp(result.timestamp, 'relative')}</span>
                      <span className="text-[10px] text-jarvis-500 font-mono">{(result.relevance * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {result.tags && (
                    <div className="flex gap-1 mt-1.5">
                      {result.tags.map((tag) => (
                        <span key={tag} className="text-[10px] text-gray-600 bg-jarvis-glass/40 px-1.5 py-0.5 rounded">#{tag}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {!hasSearched && (
          <div className="text-center py-8">
            <span className="text-2xl">{'\u{1F9E0}'}</span>
            <p className="text-gray-500 text-sm mt-2">Type to search through your memories</p>
            <p className="text-xs text-gray-600 mt-1">Search across conversations, facts, and events</p>
          </div>
        )}
      </div>
    </div>
  );
};
