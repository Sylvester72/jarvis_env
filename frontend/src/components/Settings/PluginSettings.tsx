import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/index';

export const PluginSettings: React.FC = () => {
  const plugins = useAppStore((state) => state.plugins);
  const setPluginEnabled = useAppStore((state) => state.setPluginEnabled);
  const [search, setSearch] = useState('');

  const filtered = plugins.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl border border-jarvis-glass-border px-3 py-2.5 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plugins..."
          className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
        />
      </div>

      <AnimatePresence>
        {filtered.map((plugin, index) => (
          <motion.div
            key={plugin.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: index * 0.05 }}
            className="glass rounded-xl p-4 border border-jarvis-glass-border"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-jarvis-500/10 flex items-center justify-center border border-jarvis-500/20 flex-shrink-0 text-lg">
                  {plugin.icon || '🧩'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-200">{plugin.name}</h4>
                    <span className="text-[10px] text-gray-600 font-mono">v{plugin.version}</span>
                    {plugin.enabled ? (
                      <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">Enabled</span>
                    ) : (
                      <span className="text-[10px] text-gray-500 bg-gray-500/10 px-1.5 py-0.5 rounded-full">Disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{plugin.description}</p>
                  {plugin.author && (
                    <p className="text-[10px] text-gray-600 mt-1">by {plugin.author}</p>
                  )}
                  {plugin.permissions && plugin.permissions.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {plugin.permissions.map((perm) => (
                        <span key={perm} className="text-[10px] text-jarvis-500 bg-jarvis-500/10 px-1.5 py-0.5 rounded">
                          {perm}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPluginEnabled(plugin.id, !plugin.enabled)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-1 ${
                  plugin.enabled ? 'bg-jarvis-500' : 'bg-gray-700'
                }`}
                role="switch"
                aria-checked={plugin.enabled}
              >
                <motion.div
                  animate={{ x: plugin.enabled ? 20 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
