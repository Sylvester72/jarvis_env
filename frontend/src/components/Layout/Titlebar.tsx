import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/index';

const STATUS_COLORS: Record<string, string> = {
  initializing: 'bg-yellow-500',
  ready: 'bg-green-500',
  disconnected: 'bg-gray-500',
  error: 'bg-red-500',
  updating: 'bg-blue-500',
} as const;

export const Titlebar: React.FC = () => {
  const status = useAppStore((state) => state.status);
  const [isMaximized, setIsMaximized] = useState(false);

  const isElectron =
    typeof window !== 'undefined' &&
    typeof window.electronAPI !== 'undefined' &&
    window.electronAPI !== null;

  useEffect(() => {
    if (!isElectron) return;

    const api = window.electronAPI!;

    api.window.isMaximized().then((maximized: boolean) => {
      setIsMaximized(maximized);
    });

    const cleanup = api.window.onMaximizeChange((maximized: boolean) => {
      setIsMaximized(maximized);
    });

    return () => {
      cleanup();
    };
  }, [isElectron]);

  const handleMinimize = useCallback(() => {
    window.electronAPI?.window.minimize();
  }, []);

  const handleMaximize = useCallback(() => {
    window.electronAPI?.window.maximize().then(() => {
      setIsMaximized((prev) => !prev);
    });
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI?.window.close();
  }, []);

  const statusColor = STATUS_COLORS[status] ?? 'bg-gray-500';

  return (
    <header
      className="titlebar flex items-center justify-between h-10 px-3 bg-jarvis-darker/90 backdrop-blur-md border-b border-jarvis-glass-border select-none z-50 shrink-0"
      role="toolbar"
      aria-label="Window Titlebar"
    >
      {/* Left: status indicator */}
      <div className="flex items-center gap-2.5 w-[200px]">
        <div className={`w-2 h-2 rounded-full ${statusColor} shadow-glow`} />
        <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">
          {status}
        </span>
      </div>

      {/* Center: JARVIS logo */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span className="text-sm font-semibold text-jarvis-500 tracking-widest uppercase glow-text">
          JARVIS
        </span>
      </div>

      {/* Right: window controls */}
      <div className="flex items-center gap-1 w-[200px] justify-end">
        <div
          className="flex gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {isElectron ? (
            <>
              <button
                onClick={handleMinimize}
                className="group w-3.5 h-3.5 flex items-center justify-center rounded-full bg-gray-600 hover:bg-yellow-500 transition-colors duration-200"
                aria-label="Minimize window"
              >
                <span className="opacity-0 group-hover:opacity-100 text-[8px] text-white font-bold leading-none transition-opacity duration-200">
                  _
                </span>
              </button>
              <button
                onClick={handleMaximize}
                className="group w-3.5 h-3.5 flex items-center justify-center rounded-full bg-gray-600 hover:bg-green-500 transition-colors duration-200"
                aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
              >
                <span className="opacity-0 group-hover:opacity-100 text-[8px] text-white font-bold leading-none transition-opacity duration-200">
                  {isMaximized ? '⧉' : '□'}
                </span>
              </button>
              <button
                onClick={handleClose}
                className="group w-3.5 h-3.5 flex items-center justify-center rounded-full bg-gray-600 hover:bg-red-500 transition-colors duration-200"
                aria-label="Close window"
              >
                <span className="opacity-0 group-hover:opacity-100 text-[8px] text-white font-bold leading-none transition-opacity duration-200">
                  X
                </span>
              </button>
            </>
          ) : (
            <div className="flex gap-1" aria-hidden="true">
              <span className="w-3.5 h-3.5 rounded-full bg-gray-600" />
              <span className="w-3.5 h-3.5 rounded-full bg-gray-600" />
              <span className="w-3.5 h-3.5 rounded-full bg-red-500" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Titlebar;
