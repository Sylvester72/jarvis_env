import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceSettings } from './VoiceSettings';
import { ModelSettings } from './ModelSettings';
import { PluginSettings } from './PluginSettings';
import { SecuritySettings } from './SecuritySettings';
import { useAppStore } from '../../store/index';

const sections = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'voice', label: 'Voice', icon: '🎤' },
  { id: 'model', label: 'AI Model', icon: '🧠' },
  { id: 'plugins', label: 'Plugins', icon: '🧩' },
  { id: 'security', label: 'Security', icon: '🔒' },
];

export const SettingsPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState('general');
  const saveSettings = useAppStore((state) => state.saveSettings);
  const setApiEndpoint = useAppStore((state) => state.setApiEndpoint);
  const setApiKey = useAppStore((state) => state.setApiKey);
  const setAutoStart = useAppStore((state) => state.setAutoStart);
  const setNotificationsEnabled = useAppStore((state) => state.setNotificationsEnabled);
  const setSoundEnabled = useAppStore((state) => state.setSoundEnabled);
  const apiEndpoint = useAppStore((state) => state.apiEndpoint);
  const apiKey = useAppStore((state) => state.apiKey);
  const autoStart = useAppStore((state) => state.autoStart);
  const notificationsEnabled = useAppStore((state) => state.notificationsEnabled);
  const soundEnabled = useAppStore((state) => state.soundEnabled);
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const developerMode = useAppStore((state) => state.developerMode);
  const setDeveloperMode = useAppStore((state) => state.setDeveloperMode);

  const renderSection = () => {
    switch (activeSection) {
      case 'voice': return <VoiceSettings />;
      case 'model': return <ModelSettings />;
      case 'plugins': return <PluginSettings />;
      case 'security': return <SecuritySettings />;
      default: return (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-200 mb-3">API Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">API Endpoint</label>
                <input
                  type="text"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  className="w-full bg-jarvis-darker/50 border border-jarvis-glass-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-jarvis-500/50 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-jarvis-darker/50 border border-jarvis-glass-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-jarvis-500/50 outline-none transition-colors"
                />
              </div>
            </div>
          </div>
          <div className="divider-gradient" />
          <div>
            <h3 className="text-sm font-medium text-gray-200 mb-3">Application</h3>
            <div className="space-y-3">
              <ToggleSetting label="Launch on startup" enabled={autoStart} onChange={setAutoStart} />
              <ToggleSetting label="Enable notifications" enabled={notificationsEnabled} onChange={setNotificationsEnabled} />
              <ToggleSetting label="Sound effects" enabled={soundEnabled} onChange={setSoundEnabled} />
              <ToggleSetting label="Developer mode" enabled={developerMode} onChange={setDeveloperMode} />
              <div>
                <label className="text-xs text-gray-400 block mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-jarvis-darker/50 border border-jarvis-glass-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-jarvis-500/50 outline-none transition-colors"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex h-full glass rounded-2xl overflow-hidden border border-jarvis-glass-border">
      <div className="w-48 border-r border-jarvis-glass-border p-2 flex-shrink-0">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
              activeSection === section.id
                ? 'bg-jarvis-500/15 text-jarvis-400 border border-jarvis-500/20'
                : 'text-gray-400 hover:text-gray-300 hover:bg-jarvis-glass/40'
            }`}
          >
            <span className="text-base">{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderSection()}
          </motion.div>
        </AnimatePresence>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-jarvis-glass-border">
          <button
            onClick={() => saveSettings()}
            className="px-4 py-2 rounded-xl bg-jarvis-500/20 text-jarvis-400 border border-jarvis-500/30 hover:bg-jarvis-500/30 text-sm transition-all"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

function ToggleSetting({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-jarvis-500' : 'bg-gray-700'}`}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
      >
        <motion.div
          animate={{ x: enabled ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="w-4 h-4 rounded-full bg-white absolute top-0.5"
        />
      </button>
    </div>
  );
}
