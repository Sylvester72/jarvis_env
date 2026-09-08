import { StateCreator } from 'zustand';

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  icon?: string;
  author?: string;
  permissions?: string[];
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  apiEndpoint?: string;
}

export interface SettingsSlice {
  apiEndpoint: string;
  apiKey: string;
  modelConfig: ModelConfig;
  plugins: PluginInfo[];
  pluginsEnabled: boolean;
  autoStart: boolean;
  minimizeToTray: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  wakeWord: string;
  shortcut: string;
  theme: 'dark' | 'light' | 'system';
  language: string;
  memoryEnabled: boolean;
  visionEnabled: boolean;
  developerMode: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  automaticUpdates: boolean;
  privacyMode: boolean;
  telemetryEnabled: boolean;

  setApiEndpoint: (endpoint: string) => void;
  setApiKey: (key: string) => void;
  setModelConfig: (config: Partial<ModelConfig>) => void;
  setPluginEnabled: (pluginId: string, enabled: boolean) => void;
  setPluginsEnabled: (enabled: boolean) => void;
  setAutoStart: (enabled: boolean) => void;
  setMinimizeToTray: (minimize: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setWakeWord: (wakeWord: string) => void;
  setShortcut: (shortcut: string) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setLanguage: (lang: string) => void;
  setMemoryEnabled: (enabled: boolean) => void;
  setVisionEnabled: (enabled: boolean) => void;
  setDeveloperMode: (enabled: boolean) => void;
  setLogLevel: (level: 'debug' | 'info' | 'warn' | 'error') => void;
  setAutomaticUpdates: (enabled: boolean) => void;
  setPrivacyMode: (enabled: boolean) => void;
  setTelemetryEnabled: (enabled: boolean) => void;
  loadSettings: () => void;
  saveSettings: () => void;
}

const DEFAULT_SETTINGS = {
  apiEndpoint: 'http://localhost:8080',
  apiKey: '',
  modelConfig: {
    id: 'jarvis-pro',
    name: 'JARVIS Pro',
    provider: 'local',
    maxTokens: 4096,
    temperature: 0.7,
    topP: 0.9,
  },
  theme: 'dark' as const,
  language: 'en',
  wakeWord: 'jarvis',
  shortcut: 'CommandOrControl+Shift+Space',
  autoStart: false,
  minimizeToTray: true,
  notificationsEnabled: true,
  soundEnabled: true,
  memoryEnabled: true,
  visionEnabled: false,
  developerMode: false,
  logLevel: 'info' as const,
  automaticUpdates: true,
  privacyMode: false,
  telemetryEnabled: true,
  pluginsEnabled: true,
};

export const createSettingsSlice: StateCreator<SettingsSlice> = (set, get) => ({
  ...DEFAULT_SETTINGS,
  plugins: [
    {
      id: 'web-search',
      name: 'Web Search',
      version: '1.0.0',
      description: 'Search the web for real-time information',
      enabled: true,
      author: 'JARVIS',
      permissions: ['network'],
    },
    {
      id: 'file-system',
      name: 'File System',
      version: '1.0.0',
      description: 'Read and write files on your system',
      enabled: false,
      author: 'JARVIS',
      permissions: ['filesystem'],
    },
    {
      id: 'code-execution',
      name: 'Code Execution',
      version: '1.0.0',
      description: 'Execute code in sandboxed environments',
      enabled: false,
      author: 'JARVIS',
      permissions: ['execution'],
    },
    {
      id: 'vision',
      name: 'Vision',
      version: '1.0.0',
      description: 'Camera and screen capture with OCR',
      enabled: true,
      author: 'JARVIS',
      permissions: ['camera', 'screen'],
    },
    {
      id: 'calendar',
      name: 'Calendar',
      version: '1.0.0',
      description: 'Calendar and scheduling integration',
      enabled: false,
      author: 'JARVIS',
      permissions: ['calendar'],
    },
  ],

  setApiEndpoint: (endpoint) => set({ apiEndpoint: endpoint }),
  setApiKey: (key) => set({ apiKey: key }),

  setModelConfig: (config) =>
    set((state) => ({
      modelConfig: { ...state.modelConfig, ...config },
    })),

  setPluginEnabled: (pluginId, enabled) =>
    set((state) => ({
      plugins: state.plugins.map((p) =>
        p.id === pluginId ? { ...p, enabled } : p
      ),
    })),

  setPluginsEnabled: (enabled) => set({ pluginsEnabled: enabled }),
  setAutoStart: (enabled) => {
    set({ autoStart: enabled });
    try {
      if (window.electronAPI?.app.setAutoStart) {
        window.electronAPI.app.setAutoStart(enabled);
      }
    } catch {
      // Not running in Electron
    }
  },
  setMinimizeToTray: (minimize) => set({ minimizeToTray: minimize }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  setWakeWord: (wakeWord) => set({ wakeWord }),
  setShortcut: (shortcut) => set({ shortcut }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (lang) => set({ language: lang }),
  setMemoryEnabled: (enabled) => set({ memoryEnabled: enabled }),
  setVisionEnabled: (enabled) => set({ visionEnabled: enabled }),
  setDeveloperMode: (enabled) => set({ developerMode: enabled }),
  setLogLevel: (level) => set({ logLevel: level }),
  setAutomaticUpdates: (enabled) => set({ automaticUpdates: enabled }),
  setPrivacyMode: (enabled) => set({ privacyMode: enabled }),
  setTelemetryEnabled: (enabled) => set({ telemetryEnabled: enabled }),

  loadSettings: () => {
    try {
      const saved = localStorage.getItem('jarvis-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        set((state) => ({
          ...state,
          ...parsed,
          plugins: parsed.plugins || state.plugins,
          modelConfig: { ...state.modelConfig, ...parsed.modelConfig },
        }));
      }
    } catch {
      // Silently fail loading settings
    }
  },

  saveSettings: () => {
    try {
      const state = get();
      const settings = {
        apiEndpoint: state.apiEndpoint,
        modelConfig: state.modelConfig,
        theme: state.theme,
        language: state.language,
        wakeWord: state.wakeWord,
        shortcut: state.shortcut,
        autoStart: state.autoStart,
        minimizeToTray: state.minimizeToTray,
        notificationsEnabled: state.notificationsEnabled,
        soundEnabled: state.soundEnabled,
        memoryEnabled: state.memoryEnabled,
        visionEnabled: state.visionEnabled,
        developerMode: state.developerMode,
        logLevel: state.logLevel,
        automaticUpdates: state.automaticUpdates,
        privacyMode: state.privacyMode,
        telemetryEnabled: state.telemetryEnabled,
        pluginsEnabled: state.pluginsEnabled,
        plugins: state.plugins,
      };
      localStorage.setItem('jarvis-settings', JSON.stringify(settings));
    } catch {
      // Silently fail saving settings
    }
  },
});
