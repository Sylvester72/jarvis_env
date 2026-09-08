import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface ElectronAPI {
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
  tray: {
    updateIcon: (iconPath: string) => Promise<void>;
  };
  system: {
    getAccentColor: () => Promise<string>;
    getDarkMode: () => Promise<boolean>;
  };
  onWakeWordTriggered: (callback: () => void) => () => void;
  onNavigate: (callback: (path: string) => void) => () => void;
  onToggleMinimalUI: (callback: (isMinimal: boolean) => void) => () => void;
  sendNotification: (title: string, body: string) => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    getBounds: () => ipcRenderer.invoke('window:getBounds'),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      const handler = (_event: IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
      ipcRenderer.on('window:maximize-change', handler);
      return () => ipcRenderer.removeListener('window:maximize-change', handler);
    },
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    setAutoStart: (enabled: boolean) => ipcRenderer.invoke('app:setAutoStart', enabled),
    getAutoStart: () => ipcRenderer.invoke('app:getAutoStart'),
  },
  dialog: {
    openFile: (options: any) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options: any) => ipcRenderer.invoke('dialog:saveFile', options),
  },
  tray: {
    updateIcon: (iconPath: string) => ipcRenderer.invoke('tray:updateIcon', iconPath),
  },
  system: {
    getAccentColor: () => ipcRenderer.invoke('system:getAccentColor'),
    getDarkMode: () => ipcRenderer.invoke('system:getDarkMode'),
  },
  onWakeWordTriggered: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('wake-word-triggered', handler);
    return () => ipcRenderer.removeListener('wake-word-triggered', handler);
  },
  onNavigate: (callback: (path: string) => void) => {
    const handler = (_event: IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.removeListener('navigate', handler);
  },
  onToggleMinimalUI: (callback: (isMinimal: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, isMinimal: boolean) => callback(isMinimal);
    ipcRenderer.on('toggle-minimal-ui', handler);
    return () => ipcRenderer.removeListener('toggle-minimal-ui', handler);
  },
  sendNotification: (title: string, body: string) => {
    new Notification(title, { body });
  },
});
