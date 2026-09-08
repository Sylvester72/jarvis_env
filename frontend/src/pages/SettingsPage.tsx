import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/index';
import { GlassPanel } from '../components/UI/GlassPanel';
import { HolographicButton } from '../components/UI/HolographicButton';

interface SettingsSection {
  id: string;
  label: string;
  icon: string;
}

const settingsSections: SettingsSection[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'model', label: 'Model', icon: '\u{1F916}' },
  { id: 'voice', label: 'Voice', icon: '\u{1F3A4}' },
  { id: 'vision', label: 'Vision', icon: '\u{1F4F7}' },
  { id: 'memory', label: 'Memory', icon: '\u{1F9E0}' },
  { id: 'developer', label: 'Developer', icon: '\u{1F4BB}' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
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

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('general');

  const settings = useAppStore((state) => ({
    apiEndpoint: state.apiEndpoint,
    modelConfig: state.modelConfig,
    theme: state.theme,
    language: state.language,
    wakeWord: state.wakeWord,
    shortcut: state.shortcut,
    notificationsEnabled: state.notificationsEnabled,
    soundEnabled: state.soundEnabled,
    memoryEnabled: state.memoryEnabled,
    visionEnabled: state.visionEnabled,
    developerMode: state.developerMode,
    logLevel: state.logLevel,
    privacyMode: state.privacyMode,
    autoStart: state.autoStart,
    minimizeToTray: state.minimizeToTray,
    automaticUpdates: state.automaticUpdates,
    telemetryEnabled: state.telemetryEnabled,
  }));

  const setters = useAppStore((state) => ({
    setApiEndpoint: state.setApiEndpoint,
    setWakeWord: state.setWakeWord,
    setShortcut: state.setShortcut,
    setNotificationsEnabled: state.setNotificationsEnabled,
    setSoundEnabled: state.setSoundEnabled,
    setMemoryEnabled: state.setMemoryEnabled,
    setVisionEnabled: state.setVisionEnabled,
    setDeveloperMode: state.setDeveloperMode,
    setLogLevel: state.setLogLevel,
    setPrivacyMode: state.setPrivacyMode,
    setAutoStart: state.setAutoStart,
    setMinimizeToTray: state.setMinimizeToTray,
    setAutomaticUpdates: state.setAutomaticUpdates,
    setTelemetryEnabled: state.setTelemetryEnabled,
    setLanguage: state.setLanguage,
  }));

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const renderGeneralSettings = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          API Endpoint
        </label>
        <input
          type="text"
          value={settings.apiEndpoint}
          onChange={(e) => setters.setApiEndpoint(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 placeholder-gray-500 focus:border-jarvis-500/50 focus:outline-none transition-colors"
          placeholder="http://localhost:8080"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Auto Start</p>
          <p className="text-xs text-gray-500">Launch JARVIS on system startup</p>
        </div>
        <button
          onClick={() => setters.setAutoStart(!settings.autoStart)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.autoStart ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.autoStart}
          aria-label="Toggle auto start"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.autoStart ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Minimize to Tray</p>
          <p className="text-xs text-gray-500">Keep running in system tray when closed</p>
        </div>
        <button
          onClick={() => setters.setMinimizeToTray(!settings.minimizeToTray)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.minimizeToTray ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.minimizeToTray}
          aria-label="Toggle minimize to tray"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.minimizeToTray ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Notifications</p>
          <p className="text-xs text-gray-500">Show desktop notifications</p>
        </div>
        <button
          onClick={() => setters.setNotificationsEnabled(!settings.notificationsEnabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.notificationsEnabled ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.notificationsEnabled}
          aria-label="Toggle notifications"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Sound</p>
          <p className="text-xs text-gray-500">Play sound effects for events</p>
        </div>
        <button
          onClick={() => setters.setSoundEnabled(!settings.soundEnabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.soundEnabled ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.soundEnabled}
          aria-label="Toggle sound"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Automatic Updates</p>
          <p className="text-xs text-gray-500">Keep JARVIS up to date automatically</p>
        </div>
        <button
          onClick={() => setters.setAutomaticUpdates(!settings.automaticUpdates)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.automaticUpdates ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.automaticUpdates}
          aria-label="Toggle automatic updates"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.automaticUpdates ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Language
        </label>
        <select
          value={settings.language}
          onChange={(e) => setters.setLanguage(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 focus:border-jarvis-500/50 focus:outline-none transition-colors"
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
  );

  const renderModelSettings = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Model ID
        </label>
        <input
          type="text"
          value={settings.modelConfig.id}
          onChange={(e) =>
            useAppStore.getState().setModelConfig({ id: e.target.value })
          }
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 placeholder-gray-500 focus:border-jarvis-500/50 focus:outline-none transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Model Name
        </label>
        <input
          type="text"
          value={settings.modelConfig.name}
          onChange={(e) =>
            useAppStore.getState().setModelConfig({ name: e.target.value })
          }
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 placeholder-gray-500 focus:border-jarvis-500/50 focus:outline-none transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Provider
        </label>
        <input
          type="text"
          value={settings.modelConfig.provider}
          onChange={(e) =>
            useAppStore.getState().setModelConfig({ provider: e.target.value })
          }
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 placeholder-gray-500 focus:border-jarvis-500/50 focus:outline-none transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Max Tokens
        </label>
        <input
          type="number"
          value={settings.modelConfig.maxTokens}
          onChange={(e) =>
            useAppStore.getState().setModelConfig({
              maxTokens: parseInt(e.target.value, 10) || 4096,
            })
          }
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 focus:border-jarvis-500/50 focus:outline-none transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Temperature
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="2"
          value={settings.modelConfig.temperature}
          onChange={(e) =>
            useAppStore.getState().setModelConfig({
              temperature: parseFloat(e.target.value) || 0.7,
            })
          }
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 focus:border-jarvis-500/50 focus:outline-none transition-colors"
        />
      </div>
    </div>
  );

  const renderVoiceSettings = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Wake Word
        </label>
        <input
          type="text"
          value={settings.wakeWord}
          onChange={(e) => setters.setWakeWord(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 placeholder-gray-500 focus:border-jarvis-500/50 focus:outline-none transition-colors"
          placeholder="jarvis"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Keyboard Shortcut
        </label>
        <input
          type="text"
          value={settings.shortcut}
          onChange={(e) => setters.setShortcut(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 font-mono focus:border-jarvis-500/50 focus:outline-none transition-colors"
        />
        <p className="text-xs text-gray-600 mt-1">
          Press the key combination you want to use
        </p>
      </div>
    </div>
  );

  const renderVisionSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Vision Enabled</p>
          <p className="text-xs text-gray-500">
            Allow camera and screen capture features
          </p>
        </div>
        <button
          onClick={() => setters.setVisionEnabled(!settings.visionEnabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.visionEnabled ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.visionEnabled}
          aria-label="Toggle vision"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.visionEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );

  const renderMemorySettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Memory Enabled</p>
          <p className="text-xs text-gray-500">
            Allow JARVIS to remember context across sessions
          </p>
        </div>
        <button
          onClick={() => setters.setMemoryEnabled(!settings.memoryEnabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.memoryEnabled ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.memoryEnabled}
          aria-label="Toggle memory"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.memoryEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );

  const renderDeveloperSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Developer Mode</p>
          <p className="text-xs text-gray-500">
            Show advanced options and debug information
          </p>
        </div>
        <button
          onClick={() => setters.setDeveloperMode(!settings.developerMode)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.developerMode ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.developerMode}
          aria-label="Toggle developer mode"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.developerMode ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Log Level
        </label>
        <select
          value={settings.logLevel}
          onChange={(e) =>
            setters.setLogLevel(
              e.target.value as 'debug' | 'info' | 'warn' | 'error'
            )
          }
          className="w-full px-3 py-2 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border text-sm text-gray-200 focus:border-jarvis-500/50 focus:outline-none transition-colors"
        >
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Privacy Mode</p>
          <p className="text-xs text-gray-500">
            Omit sensitive data from logs and telemetry
          </p>
        </div>
        <button
          onClick={() => setters.setPrivacyMode(!settings.privacyMode)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.privacyMode ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.privacyMode}
          aria-label="Toggle privacy mode"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.privacyMode ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Telemetry</p>
          <p className="text-xs text-gray-500">
            Send anonymous usage data to improve JARVIS
          </p>
        </div>
        <button
          onClick={() => setters.setTelemetryEnabled(!settings.telemetryEnabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.telemetryEnabled ? 'bg-jarvis-500' : 'bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.telemetryEnabled}
          aria-label="Toggle telemetry"
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.telemetryEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );

  const renderAboutSection = () => (
    <div className="space-y-4 text-center">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-jarvis-500/10 border border-jarvis-500/30 flex items-center justify-center">
        <span className="text-4xl">{'\u{1F916}'}</span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-200">JARVIS Desktop</h3>
        <p className="text-xs text-gray-500 font-mono mt-1">v1.0.0</p>
      </div>
      <p className="text-sm text-gray-400 max-w-sm mx-auto">
        Your AI-powered desktop assistant. Built with love using Electron, React, and TypeScript.
      </p>
      <div className="pt-4 border-t border-jarvis-glass-border">
        <p className="text-xs text-gray-600">
          JARVIS (c) 2026. All rights reserved.
        </p>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSettings();
      case 'model':
        return renderModelSettings();
      case 'voice':
        return renderVoiceSettings();
      case 'vision':
        return renderVisionSettings();
      case 'memory':
        return renderMemorySettings();
      case 'developer':
        return renderDeveloperSettings();
      case 'about':
        return renderAboutSection();
      default:
        return renderGeneralSettings();
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col h-full"
      role="region"
      aria-label="Settings page"
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
          <h1 className="text-lg font-semibold text-gray-100">Settings</h1>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {/* Navigation sidebar */}
        <nav
          className="w-44 flex-shrink-0 space-y-1 overflow-y-auto scrollbar-thin"
          aria-label="Settings sections"
        >
          {settingsSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition-all ${
                activeSection === section.id
                  ? 'bg-jarvis-500/10 text-jarvis-400 border border-jarvis-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-jarvis-500/5 border border-transparent'
              }`}
              aria-current={activeSection === section.id ? 'true' : undefined}
            >
              <span className="text-base">{section.icon}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </nav>

        {/* Settings content */}
        <GlassPanel
          intensity="default"
          padding="lg"
          className="flex-1 overflow-y-auto scrollbar-thin"
        >
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderSectionContent()}
          </motion.div>
        </GlassPanel>
      </div>
    </motion.div>
  );
};

export default SettingsPage;
