import { StateCreator } from 'zustand';

export type AudioDeviceState = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

export interface VoiceSlice {
  isListening: boolean;
  isSpeaking: boolean;
  isWakeWordEnabled: boolean;
  wakeWordDetected: boolean;
  voiceMode: 'push-to-talk' | 'always-on' | 'wake-word';
  audioLevel: number;
  audioDeviceState: AudioDeviceState;
  selectedInputDevice: string | null;
  selectedOutputDevice: string | null;
  availableInputDevices: MediaDeviceInfo[];
  availableOutputDevices: MediaDeviceInfo[];
  voiceSpeed: number;
  voicePitch: number;
  voiceVolume: number;
  transcript: string;
  interimTranscript: string;
  speechRecognitionLanguage: string;

  setListening: (listening: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setWakeWordDetected: (detected: boolean) => void;
  setVoiceMode: (mode: 'push-to-talk' | 'always-on' | 'wake-word') => void;
  setAudioLevel: (level: number) => void;
  setAudioDeviceState: (state: AudioDeviceState) => void;
  setSelectedInputDevice: (deviceId: string | null) => void;
  setSelectedOutputDevice: (deviceId: string | null) => void;
  setAvailableInputDevices: (devices: MediaDeviceInfo[]) => void;
  setAvailableOutputDevices: (devices: MediaDeviceInfo[]) => void;
  setVoiceSpeed: (speed: number) => void;
  setVoicePitch: (pitch: number) => void;
  setVoiceVolume: (volume: number) => void;
  setTranscript: (transcript: string) => void;
  setInterimTranscript: (transcript: string) => void;
  setSpeechRecognitionLanguage: (lang: string) => void;
}

export const createVoiceSlice: StateCreator<VoiceSlice> = (set) => ({
  isListening: false,
  isSpeaking: false,
  isWakeWordEnabled: true,
  wakeWordDetected: false,
  voiceMode: 'wake-word',
  audioLevel: 0,
  audioDeviceState: 'idle',
  selectedInputDevice: null,
  selectedOutputDevice: null,
  availableInputDevices: [],
  availableOutputDevices: [],
  voiceSpeed: 1.0,
  voicePitch: 1.0,
  voiceVolume: 0.8,
  transcript: '',
  interimTranscript: '',
  speechRecognitionLanguage: 'en-US',

  setListening: (listening) => set({ isListening: listening }),
  setSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setWakeWordEnabled: (enabled) => set({ isWakeWordEnabled: enabled }),
  setWakeWordDetected: (detected) => set({ wakeWordDetected: detected }),
  setVoiceMode: (mode) => set({ voiceMode: mode }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setAudioDeviceState: (state) => set({ audioDeviceState: state }),
  setSelectedInputDevice: (deviceId) => set({ selectedInputDevice: deviceId }),
  setSelectedOutputDevice: (deviceId) => set({ selectedOutputDevice: deviceId }),
  setAvailableInputDevices: (devices) => set({ availableInputDevices: devices }),
  setAvailableOutputDevices: (devices) => set({ availableOutputDevices: devices }),
  setVoiceSpeed: (speed) => set({ voiceSpeed: speed }),
  setVoicePitch: (pitch) => set({ voicePitch: pitch }),
  setVoiceVolume: (volume) => set({ voiceVolume: volume }),
  setTranscript: (transcript) => set({ transcript: transcript }),
  setInterimTranscript: (transcript) => set({ interimTranscript: transcript }),
  setSpeechRecognitionLanguage: (lang) => set({ speechRecognitionLanguage: lang }),
});
