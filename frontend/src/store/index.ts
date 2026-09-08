import { create } from 'zustand';
import { AISlice, createAISlice } from './slices/ai-slice';
import { VoiceSlice, createVoiceSlice } from './slices/voice-slice';
import { UISlice, createUISlice } from './slices/ui-slice';
import { SettingsSlice, createSettingsSlice } from './slices/settings-slice';

export type AppStore = AISlice & VoiceSlice & UISlice & SettingsSlice;

export const useAppStore = create<AppStore>()((...args) => ({
  ...createAISlice(...args),
  ...createVoiceSlice(...args),
  ...createUISlice(...args),
  ...createSettingsSlice(...args),
}));

export type {
  AISlice,
  VoiceSlice,
  UISlice,
  SettingsSlice,
} from './slices/ai-slice';
export type { AppStatus, AppMode, PanelId, Toast } from './slices/ui-slice';
export type { AudioDeviceState } from './slices/voice-slice';
export type { Message, Conversation, ToolCall } from './slices/ai-slice';
export type { PluginInfo, ModelConfig } from './slices/settings-slice';
