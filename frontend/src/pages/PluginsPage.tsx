import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/index';
import { GlassPanel } from '../components/UI/GlassPanel';
import { HolographicButton } from '../components/UI/HolographicButton';
import type { PluginInfo } from '../store/index';

interface AvailablePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  category: string;
  featured: boolean;
  downloads: number;
  rating: number;
  permissions: string[];
}

const availablePlugins: AvailablePlugin[] = [
  {
    id: 'web-scraper',
    name: 'Web Scraper',
    version: '2.1.0',
    description: 'Extract and parse content from any webpage with advanced selector support',
    author: 'JARVIS Labs',
    icon: '\u{1F310}',
    category: 'data',
    featured: true,
    downloads: 15420,
    rating: 4.7,
    permissions: ['network'],
  },
  {
    id: 'image-generator',
    name: 'Image Generator',
    version: '1.3.0',
    description: 'Generate images using AI models directly from chat',
    author: 'JARVIS Labs',
    icon: '\u{1F5BC}',
    category: 'creative',
    featured: true,
    downloads: 23100,
    rating: 4.8,
    permissions: ['network'],
  },
  {
    id: 'terminal',
    name: 'Terminal',
    version: '1.0.0',
    description: 'Execute terminal commands with approval safeguards',
    author: 'Community',
    icon: '\u{1F4BB}',
    category: 'tools',
    featured: true,
    downloads: 8900,
    rating: 4.5,
    permissions: ['execution'],
  },
  {
    id: 'email',
    name: 'Email Assistant',
    version: '1.1.0',
    description: 'Read, compose, and manage emails through JARVIS',
    author: 'JARVIS Labs',
    icon: '\u{2709}',
    category: 'productivity',
    featured: false,
    downloads: 12300,
    rating: 4.3,
    permissions: ['network'],
  },
  {
    id: 'music',
    name: 'Music Controller',
    version: '1.0.0',
    description: 'Control music playback and manage playlists',
    author: 'Community',
    icon: '\u{1F3B5}',
    category: 'entertainment',
    featured: false,
    downloads: 6700,
    rating: 4.1,
    permissions: [],
  },
  {
    id: 'notes',
    name: 'Notes Sync',
    version: '2.0.0',
    description: 'Sync notes with popular note-taking services',
    author: 'Community',
    icon: '\u{1F4DD}',
    category: 'productivity',
    featured: true,
    downloads: 18900,
    rating: 4.6,
    permissions: ['network', 'filesystem'],
  },
  {
    id: 'calendar-sync',
    name: 'Calendar Sync',
    version: '1.2.0',
    description: 'Deep integration with Google Calendar and Outlook',
    author: 'JARVIS Labs',
    icon: '\u{1F4C5}',
    category: 'productivity',
    featured: false,
    downloads: 10200,
    rating: 4.4,
    permissions: ['calendar', 'network'],
  },
  {
    id: 'weather',
    name: 'Weather',
    version: '1.0.0',
    description: 'Real-time weather forecasts and alerts',
    author: 'Community',
    icon: '\u{26C5}',
    category: 'data',
    featured: false,
    downloads: 14500,
    rating: 4.2,
    permissions: ['network'],
  },
];

const categories = [
  { id: 'all', label: 'All' },
  { id: 'featured', label: 'Featured' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'data', label: 'Data' },
  { id: 'tools', label: 'Tools' },
  { id: 'creative', label: 'Creative' },
  { id: 'entertainment', label: 'Entertainment' },
];

const pageVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -16,
    transition: { duration: 0.2, ease: [0.65, 0, 0.35, 1] },
  },
};

export const PluginsPage: React.FC = () => {
  const navigate = useNavigate();
  const plugins = useAppStore((state) => state.plugins);
  const pluginsEnabled = useAppStore((state) => state.pluginsEnabled);
  const setPluginEnabled = useAppStore((state) => state.setPluginEnabled);
  const setPluginsEnabled = useAppStore((state) => state.setPluginsEnabled);

  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const installedPluginIds = useMemo(
    () => new Set(plugins.map((p) => p.id)),
    [plugins]
  );

  const filteredAvailablePlugins = useMemo(() => {
    let filtered = availablePlugins;

    if (activeCategory === 'featured') {
      filtered = filtered.filter((p) => p.featured);
    } else if (activeCategory !== 'all') {
      filtered = filtered.filter((p) => p.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.description.toLowerCase().includes(lower) ||
          p.author.toLowerCase().includes(lower)
      );
    }

    if (activeTab === 'installed') {
      filtered = filtered.filter((p) => installedPluginIds.has(p.id));
    }

    return filtered;
  }, [activeCategory, searchQuery, activeTab, installedPluginIds]);

  const handleTogglePlugin = useCallback(
    (pluginId: string, enabled: boolean) => {
      setPluginEnabled(pluginId, enabled);
    },
    [setPluginEnabled]
  );

  const handleInstall = useCallback(
    (pluginId: string) => {
      // Mark as installed by enabling it — in production this would trigger actual installation
      setPluginEnabled(pluginId, true);
    },
    [setPluginEnabled]
  );

  const renderPluginCard = (
    plugin: AvailablePlugin,
    isInstalled: boolean,
    isEnabled: boolean
  ) => (
    <motion.div
      key={plugin.id}
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="glass rounded-xl border border-jarvis-glass-border overflow-hidden hover:border-jarvis-500/30 transition-all group"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Plugin icon */}
          <div className="w-10 h-10 rounded-xl bg-jarvis-500/10 border border-jarvis-500/20 flex items-center justify-center text-xl flex-shrink-0">
            {plugin.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-gray-200 truncate">
                  {plugin.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  by {plugin.author} &middot; v{plugin.version}
                </p>
              </div>

              {/* Featured badge */}
              {plugin.featured && (
                <span className="text-[10px] text-jarvis-500 bg-jarvis-500/10 px-1.5 py-0.5 rounded-full border border-jarvis-500/20 flex-shrink-0">
                  Featured
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
              {plugin.description}
            </p>

            {/* Permissions */}
            {plugin.permissions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {plugin.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="text-[10px] text-gray-600 bg-jarvis-glass/40 px-1.5 py-0.5 rounded"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            )}

            {/* Rating and downloads */}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
              <span className="flex items-center gap-0.5">
                <span className="text-yellow-500">{'★'}</span>
                {plugin.rating}
              </span>
              <span>{plugin.downloads.toLocaleString()} downloads</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2.5 bg-jarvis-darker/30 border-t border-jarvis-glass-border flex items-center justify-between">
        {isInstalled ? (
          <>
            <span className="text-xs text-gray-500">Installed</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600">
                {isEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={() => handleTogglePlugin(plugin.id, !isEnabled)}
                className={`relative w-8 h-4 rounded-full transition-colors ${
                  isEnabled ? 'bg-jarvis-500' : 'bg-gray-700'
                }`}
                role="switch"
                aria-checked={isEnabled}
                aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${plugin.name}`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    isEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </>
        ) : (
          <HolographicButton
            variant="primary"
            size="sm"
            onClick={() => handleInstall(plugin.id)}
            ariaLabel={`Install ${plugin.name}`}
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Install
          </HolographicButton>
        )}
      </div>
    </motion.div>
  );

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col h-full"
      role="region"
      aria-label="Plugins page"
    >
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-jarvis-glass-border">
        <div className="flex items-center gap-3">
          <HolographicButton
            variant="ghost"
            size="sm"
            onClick={handleBack}
            ariaLabel="Back to home"
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
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </HolographicButton>
          <h1 className="text-lg font-semibold text-gray-100">Plugins</h1>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {/* Plugin Settings Panel */}
        <GlassPanel intensity="default" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{'\u{1F9F0}'}</span>
                <h2 className="text-sm font-medium text-gray-200">
                  Plugin System
                </h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enable or disable the plugin system globally
              </p>
            </div>
            <button
              onClick={() => setPluginsEnabled(!pluginsEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                pluginsEnabled ? 'bg-jarvis-500' : 'bg-gray-700'
              }`}
              role="switch"
              aria-checked={pluginsEnabled}
              aria-label="Toggle plugin system"
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  pluginsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Installed plugins summary */}
          {pluginsEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-4 border-t border-jarvis-glass-border"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {plugins.map((plugin: PluginInfo) => (
                  <div
                    key={plugin.id}
                    className={`relative p-3 rounded-xl border transition-all ${
                      plugin.enabled
                        ? 'bg-jarvis-500/5 border-jarvis-500/20'
                        : 'bg-jarvis-darker/40 border-jarvis-glass-border opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {plugin.enabled && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      )}
                      <span className="text-xs font-medium text-gray-300 truncate">
                        {plugin.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600 truncate">
                      v{plugin.version}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </GlassPanel>

        {/* Plugin Store Section */}
        <GlassPanel intensity="default" padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <h2 className="text-sm font-medium text-gray-200">Plugin Store</h2>

            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plugins..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-jarvis-darker/60 border border-jarvis-glass-border text-xs text-gray-200 placeholder-gray-500 focus:border-jarvis-500/50 focus:outline-none transition-colors"
                aria-label="Search plugins"
              />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-jarvis-darker/40 rounded-lg p-0.5 border border-jarvis-glass-border">
              {(['installed', 'available'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-jarvis-500/20 text-jarvis-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  aria-pressed={activeTab === tab}
                >
                  {tab === 'installed' ? 'Installed' : 'Available'}
                </button>
              ))}
            </div>
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-jarvis-500/15 text-jarvis-400 border border-jarvis-500/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Plugin grid */}
          <AnimatePresence mode="popLayout">
            {filteredAvailablePlugins.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <span className="text-3xl">{'\u{1F50D}'}</span>
                <p className="text-gray-500 text-sm mt-3">
                  {searchQuery
                    ? 'No plugins match your search'
                    : activeTab === 'installed'
                      ? 'No plugins installed yet. Switch to "Available" to browse.'
                      : 'No plugins found in this category'}
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredAvailablePlugins.map((plugin) => {
                  const isInstalled = installedPluginIds.has(plugin.id);
                  const installed = plugins.find((p) => p.id === plugin.id);
                  const isEnabled = installed?.enabled ?? false;
                  return renderPluginCard(plugin, isInstalled, isEnabled);
                })}
              </div>
            )}
          </AnimatePresence>
        </GlassPanel>
      </div>
    </motion.div>
  );
};

export default PluginsPage;
