import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTimestamp } from '../../utils/formatting';

interface MemoryEntry {
  id: string;
  type: 'conversation' | 'fact' | 'file' | 'event' | 'note';
  title: string;
  summary: string;
  content?: string;
  timestamp: number;
  tags?: string[];
  importance?: number;
}

interface MemoryTimelineProps {
  entries?: MemoryEntry[];
  maxEntries?: number;
  className?: string;
}

const typeConfig = {
  conversation: { icon: '\u{1F4AC}', color: 'border-jarvis-500', bg: 'bg-jarvis-500/10' },
  fact: { icon: '\u{1F9E0}', color: 'border-purple-500', bg: 'bg-purple-500/10' },
  file: { icon: '\u{1F4C4}', color: 'border-green-500', bg: 'bg-green-500/10' },
  event: { icon: '\u{1F4C5}', color: 'border-yellow-500', bg: 'bg-yellow-500/10' },
  note: { icon: '\u{1F4DD}', color: 'border-blue-500', bg: 'bg-blue-500/10' },
};

const sampleEntries: MemoryEntry[] = [
  { id: '1', type: 'conversation', title: 'Project Planning', summary: 'Discussed architecture for the new feature implementation', timestamp: Date.now() - 3600000, tags: ['project'], importance: 0.9 },
  { id: '2', type: 'fact', title: 'User Preference', summary: 'User prefers dark mode and concise responses', timestamp: Date.now() - 86400000, tags: ['preference'], importance: 0.8 },
  { id: '3', type: 'file', title: 'Document Uploaded', summary: 'Uploaded requirements.pdf for review', timestamp: Date.now() - 172800000, tags: ['document'], importance: 0.6 },
  { id: '4', type: 'event', title: 'Calendar Sync', summary: 'Team standup at 10:00 AM daily', timestamp: Date.now() - 259200000, tags: ['calendar'], importance: 0.7 },
  { id: '5', type: 'note', title: 'Quick Note', summary: 'Research vector databases for memory enhancement', timestamp: Date.now() - 345600000, tags: ['research'], importance: 0.5 },
];

export const MemoryTimeline: React.FC<MemoryTimelineProps> = ({
  entries = sampleEntries,
  className = '',
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div className={`${className}`} role="region" aria-label="Memory timeline">
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="text-sm font-medium text-gray-300">Filter:</span>
        {['all', 'conversation', 'fact', 'file', 'event', 'note'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              filter === type
                ? 'bg-jarvis-500/20 text-jarvis-400 border border-jarvis-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative"
      >
        <div className="absolute left-[17px] top-2 bottom-2 w-px bg-jarvis-glass-border" aria-hidden="true" />

        <AnimatePresence>
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <span className="text-3xl">{'\u{1F4ED}'}</span>
              <p className="text-gray-500 text-sm mt-2">No memories found</p>
            </motion.div>
          ) : (
            filtered.map((entry) => {
              const config = typeConfig[entry.type];
              const isExpanded = expandedId === entry.id;

              return (
                <motion.div
                  key={entry.id}
                  variants={itemVariants}
                  layout
                  className="relative pl-10 pb-4 group"
                >
                  <div className={`absolute left-[10px] w-4 h-4 rounded-full border-2 ${config.color} ${config.bg} flex items-center justify-center z-10`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${config.color.replace('border-', 'bg-')}`} />
                  </div>

                  <motion.div
                    layout
                    className="glass rounded-xl p-3 border border-jarvis-glass-border hover:border-jarvis-glass-border/50 transition-all cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">{typeConfig[entry.type].icon}</span>
                          <h3 className="text-sm font-medium text-gray-200 truncate">{entry.title}</h3>
                          <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium px-1.5 py-0.5 rounded bg-jarvis-glass/40">
                            {entry.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2">{entry.summary}</p>
                      </div>
                      <span className="text-xs text-gray-600 whitespace-nowrap flex-shrink-0">
                        {formatTimestamp(entry.timestamp, 'relative')}
                      </span>
                    </div>

                    {entry.importance && (
                      <div className="mt-2 flex items-center gap-1">
                        <div className="flex-1 h-1 bg-jarvis-glass/40 rounded-full overflow-hidden max-w-[100px]">
                          <div className="h-full rounded-full bg-jarvis-500" style={{ width: `${entry.importance * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-600">Importance</span>
                      </div>
                    )}

                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="text-[10px] text-jarvis-500 bg-jarvis-500/10 px-1.5 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <AnimatePresence>
                      {isExpanded && entry.content && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 pt-2 border-t border-jarvis-glass-border">
                            <p className="text-xs text-gray-400 leading-relaxed">{entry.content}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
