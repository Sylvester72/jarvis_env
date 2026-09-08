import { useAppStore } from '../store/index';

export interface Command {
  id: string;
  keys: string;
  description: string;
  category: 'navigation' | 'assistant' | 'voice' | 'view' | 'system';
  action: () => void;
}

type KeyCombo = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
};

const commandRegistry: Map<string, Command> = new Map();

function parseKeyCombo(keys: string): KeyCombo {
  const parts = keys.toLowerCase().split('+');
  const combo: KeyCombo = {
    key: parts[parts.length - 1],
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('command') || parts.includes('cmd'),
  };

  if (combo.meta) {
    combo.ctrl = false;
  }

  return combo;
}

function matchesEvent(combo: KeyCombo, event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  const targetKey = combo.key.toLowerCase();

  const keyMatch =
    targetKey === key ||
    (targetKey === 'space' && key === ' ') ||
    (targetKey === 'escape' && key === 'escape') ||
    (targetKey === 'enter' && key === 'enter') ||
    (targetKey === 'tab' && key === 'tab');

  if (!keyMatch) return false;

  const isMeta = event.metaKey || (navigator.platform === 'MacIntel' && event.ctrlKey && combo.meta);

  if (combo.meta) return isMeta && !event.shiftKey && !event.altKey;
  if (combo.ctrl && event.ctrlKey !== combo.ctrl) return false;
  if (combo.shift && event.shiftKey !== combo.shift) return false;
  if (combo.alt && event.altKey !== combo.alt) return false;

  if (!combo.ctrl && !combo.shift && !combo.alt && !combo.meta) {
    return !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  return true;
}

export function registerCommand(command: Command): void {
  commandRegistry.set(command.id, command);
}

export function unregisterCommand(id: string): void {
  commandRegistry.delete(id);
}

export function executeCommand(id: string): void {
  const command = commandRegistry.get(id);
  if (command) {
    command.action();
  }
}

export function setupKeyboardShortcuts(): () => void {
  const handler = (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target as HTMLElement)?.isContentEditable
    ) {
      if (
        event.key === 'Escape' ||
        (event.key === 'Enter' && (event.ctrlKey || event.metaKey))
      ) {
        // Allow these keys even when focused on input
      } else {
        return;
      }
    }

    for (const command of commandRegistry.values()) {
      const combo = parseKeyCombo(command.keys);
      if (matchesEvent(combo, event)) {
        event.preventDefault();
        event.stopPropagation();
        command.action();
        return;
      }
    }
  };

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

export function registerDefaultCommands(): void {
  const store = useAppStore;

  registerCommand({
    id: 'toggle-sidebar',
    keys: 'Ctrl+B',
    description: 'Toggle sidebar visibility',
    category: 'view',
    action: () => store.getState().toggleSidebar(),
  });

  registerCommand({
    id: 'new-conversation',
    keys: 'Ctrl+N',
    description: 'Create new conversation',
    category: 'assistant',
    action: () => store.getState().createConversation(),
  });

  registerCommand({
    id: 'focus-input',
    keys: 'Ctrl+L',
    description: 'Focus message input',
    category: 'assistant',
    action: () => {
      const input = document.querySelector<HTMLInputElement>('[data-input="message"]');
      input?.focus();
    },
  });

  registerCommand({
    id: 'toggle-voice',
    keys: 'Ctrl+Shift+Space',
    description: 'Toggle voice input',
    category: 'voice',
    action: () => {
      const { isListening, setListening } = store.getState();
      setListening(!isListening);
    },
  });

  registerCommand({
    id: 'open-settings',
    keys: 'Ctrl+,',
    description: 'Open settings',
    category: 'navigation',
    action: () => {
      window.location.hash = '#/settings';
    },
  });

  registerCommand({
    id: 'escape',
    keys: 'Escape',
    description: 'Close modal or cancel',
    category: 'system',
    action: () => {
      const state = store.getState();
      if (state.activeDialog) {
        state.popModal();
      } else if (state.isListening) {
        state.setListening(false);
      }
    },
  });

  registerCommand({
    id: 'toggle-minimal-ui',
    keys: 'Ctrl+Shift+M',
    description: 'Toggle minimal UI mode',
    category: 'view',
    action: () => {
      const { isMinimalUI, setMinimalUI } = store.getState();
      setMinimalUI(!isMinimalUI);
    },
  });

  registerCommand({
    id: 'navigate-home',
    keys: 'Ctrl+Shift+H',
    description: 'Go to home page',
    category: 'navigation',
    action: () => {
      window.location.hash = '#/';
    },
  });
}

export function getCommandsByCategory(): Record<string, Command[]> {
  const categorized: Record<string, Command[]> = {};
  for (const command of commandRegistry.values()) {
    if (!categorized[command.category]) {
      categorized[command.category] = [];
    }
    categorized[command.category].push(command);
  }
  return categorized;
}

export function formatKeyCombo(keys: string): string {
  const parts = keys.split('+');
  const formatted = parts.map((part) => {
    const lower = part.toLowerCase();
    switch (lower) {
      case 'ctrl':
        return 'Ctrl';
      case 'shift':
        return 'Shift';
      case 'alt':
        return 'Alt';
      case 'meta':
      case 'command':
      case 'cmd':
        return navigator.platform === 'MacIntel' ? 'Cmd' : 'Win';
      case 'space':
        return 'Space';
      case 'escape':
        return 'Esc';
      case 'enter':
        return 'Enter';
      case 'tab':
        return 'Tab';
      case 'arrowup':
        return 'Up';
      case 'arrowdown':
        return 'Down';
      case 'arrowleft':
        return 'Left';
      case 'arrowright':
        return 'Right';
      default:
        return part.toUpperCase();
    }
  });

  return formatted.join(' + ');
}
