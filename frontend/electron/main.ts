import { app, BrowserWindow, screen, ipcMain, Tray, Menu, globalShortcut, nativeImage, systemPreferences, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isMinimalUI = false;

const WINDOW_STATE_FILE = 'window-state.json';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function loadWindowState(): WindowState {
  try {
    const statePath = getWindowStatePath();
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
  } catch {
    // Fall through to defaults
  }
  return {
    width: 1200,
    height: 800,
    isMaximized: false,
  };
}

function saveWindowState(state: WindowState): void {
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
  } catch {
    // Silently fail on save errors
  }
}

function createWindow(): void {
  const savedState = loadWindowState();
  const { width, height, x, y, isMaximized } = savedState;

  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  const windowX = x ?? Math.round((screenWidth - width) / 2);
  const windowY = y ?? Math.round((screenHeight - height) / 2);

  mainWindow = new BrowserWindow({
    width,
    height,
    x: windowX,
    y: windowY,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    show: false,
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin' ? { titleBarOverlay: false } : {}),
  });

  mainWindow.setBackgroundColor('#00000000');

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  if (isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      const [winWidth, winHeight] = mainWindow.getSize();
      const [winX, winY] = mainWindow.getPosition();
      saveWindowState({ x: winX, y: winY, width: winWidth, height: winHeight, isMaximized: false });
    }
  });

  mainWindow.on('move', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      const [winX, winY] = mainWindow.getPosition();
      const [winWidth, winHeight] = mainWindow.getSize();
      saveWindowState({ x: winX, y: winY, width: winWidth, height: winHeight, isMaximized: false });
    }
  });

  mainWindow.on('maximize', () => {
    saveWindowState({ width: 1200, height: 800, isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    const [winWidth, winHeight] = mainWindow?.getSize() || [1200, 800];
    const [winX, winY] = mainWindow?.getPosition() || [0, 0];
    saveWindowState({ x: winX, y: winY, width: winWidth, height: winHeight, isMaximized: false });
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, '..', 'public', 'icon.png');
  let trayIcon: nativeImage.Image;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  const resizedIcon = trayIcon.resize({ width: 16, height: 16 });
  tray = new Tray(resizedIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open JARVIS',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Toggle Minimal UI',
      click: () => {
        isMinimalUI = !isMinimalUI;
        mainWindow?.webContents.send('toggle-minimal-ui', isMinimalUI);
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('navigate', '/settings');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('JARVIS AI Assistant');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function registerGlobalShortcuts(): void {
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+J', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  if (!shortcutRegistered) {
    console.warn('Failed to register global shortcut CommandOrControl+Shift+J');
  }

  const wakeRegistered = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    mainWindow?.webContents.send('wake-word-triggered');
  });

  if (!wakeRegistered) {
    console.warn('Failed to register wake word shortcut');
  }
}

function setupIPC(): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  ipcMain.handle('window:getBounds', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      const [width, height] = mainWindow.getSize();
      return { x, y, width, height };
    }
    return null;
  });

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });

  ipcMain.handle('app:setAutoStart', (_event, enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
    });
  });

  ipcMain.handle('app:getAutoStart', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('dialog:openFile', async (_event, options: Electron.OpenDialogOptions) => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle('dialog:saveFile', async (_event, options: Electron.SaveDialogOptions) => {
    if (!mainWindow) return { canceled: true, filePath: '' };
    return dialog.showSaveDialog(mainWindow, options);
  });

  ipcMain.handle('tray:updateIcon', (_event, iconPath: string) => {
    try {
      const newIcon = nativeImage.createFromPath(iconPath);
      tray?.setImage(newIcon.resize({ width: 16, height: 16 }));
    } catch {
      // Silently fail icon update
    }
  });

  ipcMain.handle('system:getAccentColor', () => {
    if (process.platform === 'darwin') {
      return systemPreferences.getAccentColor();
    }
    return '#00d4ff';
  });

  ipcMain.handle('system:getDarkMode', () => {
    if (process.platform === 'darwin') {
      return systemPreferences.isDarkMode();
    }
    return true;
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerGlobalShortcuts();
  setupIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;
});
