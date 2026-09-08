import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/index';

export const VoiceSettings: React.FC = () => {
  const wakeWord = useAppStore((state) => state.wakeWord);
  const setWakeWord = useAppStore((state) => state.setWakeWord);
  const voiceMode = useAppStore((state) => state.voiceMode);
  const setVoiceMode = useAppStore((state) => state.setVoiceMode);
  const voiceSpeed = useAppStore((state) => state.voiceSpeed);
  const setVoiceSpeed = useAppStore((state) => state.setVoiceSpeed);
  const voicePitch = useAppStore((state) => state.voicePitch);
  const setVoicePitch = useAppStore((state) => state.setVoicePitch);
  const voiceVolume = useAppStore((state) => state.voiceVolume);
  const setVoiceVolume = useAppStore((state) => state.setVoiceVolume);
  const isWakeWordEnabled = useAppStore((state) => state.isWakeWordEnabled);
  const setWakeWordEnabled = useAppStore((state) => state.setWakeWordEnabled);
  const speechRecognitionLanguage = useAppStore((state) => state.speechRecognitionLanguage);
  const setSpeechRecognitionLanguage = useAppStore((state) => state.setSpeechRecognitionLanguage);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-200 mb-3">Voice Activation</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Wake word detection</span>
            <button
              onClick={() => setWakeWordEnabled(!isWakeWordEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isWakeWordEnabled ? 'bg-jarvis-500' : 'bg-gray-700'}`}
              role="switch"
              aria-checked={isWakeWordEnabled}
            >
              <motion.div
                animate={{ x: isWakeWordEnabled ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white absolute top-0.5"
              />
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Wake Word</label>
            <input
              type="text"
              value={wakeWord}
              onChange={(e) => setWakeWord(e.target.value)}
              className="w-full bg-jarvis-darker/50 border border-jarvis-glass-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-jarvis-500/50 outline-none transition-colors"
              placeholder="e.g. jarvis"
            />
          </div>
        </div>
      </div>

      <div className="divider-gradient" />

      <div>
        <h3 className="text-sm font-medium text-gray-200 mb-3">Voice Mode</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['push-to-talk', 'always-on', 'wake-word'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setVoiceMode(mode)}
              className={`px-3 py-2.5 rounded-xl text-sm border transition-all ${
                voiceMode === mode
                  ? 'bg-jarvis-500/15 text-jarvis-400 border-jarvis-500/30'
                  : 'bg-jarvis-glass/40 text-gray-400 border-jarvis-glass-border hover:text-gray-300'
              }`}
            >
              {mode.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="divider-gradient" />

      <div>
        <h3 className="text-sm font-medium text-gray-200 mb-3">Voice Configuration</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-400">Speed</span>
              <span className="text-xs text-gray-500 font-mono">{voiceSpeed.toFixed(1)}x</span>
            </div>
            <input type="range" min="0.5" max="2.0" step="0.1" value={voiceSpeed} onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-jarvis-glass/40 rounded-full appearance-none cursor-pointer accent-jarvis-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-jarvis-500 [&::-webkit-slider-thumb]:shadow-glow" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-400">Pitch</span>
              <span className="text-xs text-gray-500 font-mono">{voicePitch.toFixed(1)}</span>
            </div>
            <input type="range" min="0.5" max="2.0" step="0.1" value={voicePitch} onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-jarvis-glass/40 rounded-full appearance-none cursor-pointer accent-jarvis-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-jarvis-500 [&::-webkit-slider-thumb]:shadow-glow" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-400">Volume</span>
              <span className="text-xs text-gray-500 font-mono">{(voiceVolume * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={voiceVolume} onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-jarvis-glass/40 rounded-full appearance-none cursor-pointer accent-jarvis-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-jarvis-500 [&::-webkit-slider-thumb]:shadow-glow" />
          </div>
        </div>
      </div>

      <div className="divider-gradient" />

      <div>
        <h3 className="text-sm font-medium text-gray-200 mb-3">Recognition</h3>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Speech Language</label>
          <select
            value={speechRecognitionLanguage}
            onChange={(e) => setSpeechRecognitionLanguage(e.target.value)}
            className="w-full bg-jarvis-darker/50 border border-jarvis-glass-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-jarvis-500/50 outline-none transition-colors"
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="es-ES">Spanish</option>
            <option value="fr-FR">French</option>
            <option value="de-DE">German</option>
            <option value="ja-JP">Japanese</option>
            <option value="zh-CN">Chinese (Simplified)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
