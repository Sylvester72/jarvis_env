import React, { useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { MainLayout } from './components/Layout/MainLayout';
import { MainPage } from './pages/MainPage';
import { SettingsPage } from './pages/SettingsPage';
import { PluginsPage } from './pages/PluginsPage';
import { MemoryPage } from './pages/MemoryPage';
import { VisionPage } from './pages/VisionPage';
import { useAppStore } from './store/index';
import { WebSocketClient } from './utils/websocket';
import { AudioManager } from './utils/audio';
import { ParticleBackground } from './components/UI/ParticleBackground';

declare global {
  interface Window {
    electronAPI?: {
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        getBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
        onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
      };
      app: {
        getVersion: () => Promise<string>;
        getPlatform: () => Promise<string>;
        setAutoStart: (enabled: boolean) => Promise<void>;
        getAutoStart: () => Promise<boolean>;
      };
      dialog: {
        openFile: (options: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
        saveFile: (options: any) => Promise<{ canceled: boolean; filePath: string }>;
      };
      onWakeWordTriggered: (callback: () => void) => () => void;
      onNavigate: (callback: (path: string) => void) => () => void;
      onToggleMinimalUI: (callback: (isMinimal: boolean) => void) => () => void;
      sendNotification: (title: string, body: string) => void;
      system: {
        getAccentColor: () => Promise<string>;
        getDarkMode: () => Promise<boolean>;
      };
    };
  }
}

export const App: React.FC = () => {
  const wsRef = useRef<WebSocketClient | null>(null);
  const audioRef = useRef<AudioManager | null>(null);

  const setStatus = useAppStore((state) => state.setStatus);
  const setMode = useAppStore((state) => state.setMode);
  const setMinimalUI = useAppStore((state) => state.setMinimalUI);
  const addMessage = useAppStore((state) => state.addMessage);
  const setListening = useAppStore((state) => state.setListening);
  const setSpeaking = useAppStore((state) => state.setSpeaking);
  const isListening = useAppStore((state) => state.isListening);
  const isMinimalUI = useAppStore((state) => state.isMinimalUI);

  useEffect(() => {
    setStatus('initializing');
    const ws = new WebSocketClient();
    wsRef.current = ws;

    ws.on('open', () => {
      setStatus('ready');
      ws.send({ type: 'handshake', client: 'desktop' });
    });

    ws.on('message', (data: any) => {
      handleWebSocketMessage(data);
    });

    ws.on('close', () => {
      setStatus('disconnected');
    });

    ws.on('error', () => {
      setStatus('error');
    });

    ws.connect();

    const audio = new AudioManager();
    audioRef.current = audio;

    return () => {
      ws.disconnect();
      audio.dispose();
    };
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const cleanupNavigate = api.onNavigate((path: string) => {
      window.location.hash = `#${path}`;
    });

    const cleanupToggleMinimal = api.onToggleMinimalUI((isMinimal: boolean) => {
      setMinimalUI(isMinimal);
    });

    const cleanupWakeWord = api.onWakeWordTriggered(() => {
      handleWakeWord();
    });

    return () => {
      cleanupNavigate();
      cleanupToggleMinimal();
      cleanupWakeWord();
    };
  }, []);

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'transcript':
        if (data.text) {
          addMessage({ role: 'user', content: data.text, timestamp: Date.now() });
        }
        break;
      case 'response':
        addMessage({
          role: 'assistant',
          content: data.text,
          timestamp: Date.now(),
          toolCalls: data.toolCalls,
        });
        break;
      case 'voice_start':
        setSpeaking(true);
        break;
      case 'voice_end':
        setSpeaking(false);
        break;
      case 'status':
        setStatus(data.status);
        break;
      case 'mode_change':
        setMode(data.mode);
        break;
      case 'listening_start':
        setListening(true);
        break;
      case 'listening_stop':
        setListening(false);
        break;
      case 'error':
        addMessage({ role: 'system', content: `Error: ${data.message}`, timestamp: Date.now() });
        break;
    }
  }, []);

  const handleWakeWord = useCallback(() => {
    setListening(true);
    if (audioRef.current) {
      audioRef.current.startCapture();
    }
  }, []);

  return (
    <Router>
      <div className="app-container relative w-screen h-screen overflow-hidden">
        <ParticleBackground />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<MainPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="plugins" element={<PluginsPage />} />
              <Route path="memory" element={<MemoryPage />} />
              <Route path="vision" element={<VisionPage />} />
            </Route>
          </Routes>
        </AnimatePresence>
        <div
          id="notification-container"
          className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        />
      </div>
    </Router>
  );
};

export default App;
