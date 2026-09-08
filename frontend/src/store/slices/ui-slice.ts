import { StateCreator } from 'zustand';

export type AppStatus = 'initializing' | 'ready' | 'disconnected' | 'error' | 'updating';
export type AppMode = 'assistant' | 'vision' | 'memory' | 'plugins' | 'settings';

export type PanelId =
  | 'chat'
  | 'voice'
  | 'vision'
  | 'memory'
  | 'plugins'
  | 'settings'
  | 'files'
  | 'knowledge';

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface UISlice {
  status: AppStatus;
  mode: AppMode;
  isMinimalUI: boolean;
  sidebarCollapsed: boolean;
  activePanel: PanelId;
  openPanels: PanelId[];
  toasts: Toast[];
  modalStack: string[];
  isFullscreen: boolean;
  activeDialog: string | null;
  theme: 'dark' | 'light' | 'system';

  setStatus: (status: AppStatus) => void;
  setMode: (mode: AppMode) => void;
  setMinimalUI: (minimal: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActivePanel: (panel: PanelId) => void;
  togglePanel: (panel: PanelId) => void;
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  pushModal: (modalId: string) => void;
  popModal: () => void;
  setFullscreen: (fullscreen: boolean) => void;
  setActiveDialog: (dialogId: string | null) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

let toastCounter = 0;
export const createUISlice: StateCreator<UISlice> = (set, get) => ({
  status: 'initializing',
  mode: 'assistant',
  isMinimalUI: false,
  sidebarCollapsed: false,
  activePanel: 'chat',
  openPanels: ['chat'],
  toasts: [],
  modalStack: [],
  isFullscreen: false,
  activeDialog: null,
  theme: 'dark',

  setStatus: (status) => set({ status }),
  setMode: (mode) => set({ mode }),
  setMinimalUI: (minimal) => set({ isMinimalUI: minimal }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setActivePanel: (panel) => set({ activePanel: panel }),

  togglePanel: (panel) =>
    set((state) => ({
      openPanels: state.openPanels.includes(panel)
        ? state.openPanels.filter((p) => p !== panel)
        : [...state.openPanels, panel],
      activePanel: state.openPanels.includes(panel) ? state.activePanel : panel,
    })),

  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  pushModal: (modalId) =>
    set((state) => ({
      modalStack: [...state.modalStack, modalId],
      activeDialog: modalId,
    })),

  popModal: () =>
    set((state) => ({
      modalStack: state.modalStack.slice(0, -1),
      activeDialog: state.modalStack[state.modalStack.length - 2] ?? null,
    })),

  setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),

  setActiveDialog: (dialogId) => set({ activeDialog: dialogId }),

  setTheme: (theme) => set({ theme }),
});
