import React from 'react';
import { useAppStore } from '../../store/index';
import { motion } from 'framer-motion';

export const ModelSettings: React.FC = () => {
  const activeModel = useAppStore((state) => state.activeModel);
  const setActiveModel = useAppStore((state) => state.setActiveModel);
  const availableModels = useAppStore((state) => state.availableModels);
  const modelConfig = useAppStore((state) => state.modelConfig);
  const setModelConfig = useAppStore((state) => state.setModelConfig);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-200 mb-3">Active Model</h3>
        <div className="flex items-center gap-3 mb-3">
          <select
            value={activeModel}
            onChange={(e) => setActiveModel(e.target.value)}
            className="flex-1 bg-jarvis-darker/50 border border-jarvis-glass-border rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:border-jarvis-500/50 outline-none transition-colors"
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full font-medium">Active</span>
        </div>
        <div className="glass rounded-xl p-3 border border-jarvis-glass-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Provider</span>
            <span className="text-xs text-gray-300">{modelConfig.provider}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Model ID</span>
            <span className="text-xs text-gray-300 font-mono">{modelConfig.id}</span>
          </div>
        </div>
      </div>

      <div className="divider-gradient" />

      <div>
        <h3 className="text-sm font-medium text-gray-200 mb-3">Model Parameters</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-400">Temperature</span>
              <span className="text-xs text-gray-500 font-mono">{modelConfig.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range" min="0" max="2" step="0.05" value={modelConfig.temperature}
              onChange={(e) => setModelConfig({ temperature: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-jarvis-glass/40 rounded-full appearance-none cursor-pointer accent-jarvis-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-jarvis-500"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-400">Max Tokens</span>
              <span className="text-xs text-gray-500 font-mono">{modelConfig.maxTokens.toLocaleString()}</span>
            </div>
            <input
              type="range" min="256" max="8192" step="256" value={modelConfig.maxTokens}
              onChange={(e) => setModelConfig({ maxTokens: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-jarvis-glass/40 rounded-full appearance-none cursor-pointer accent-jarvis-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-jarvis-500"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-400">Top P</span>
              <span className="text-xs text-gray-500 font-mono">{modelConfig.topP.toFixed(2)}</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.05" value={modelConfig.topP}
              onChange={(e) => setModelConfig({ topP: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-jarvis-glass/40 rounded-full appearance-none cursor-pointer accent-jarvis-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-jarvis-500"
            />
          </div>
        </div>
      </div>

      <div className="divider-gradient" />

      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-xl bg-jarvis-500/20 text-jarvis-400 border border-jarvis-500/30 hover:bg-jarvis-500/30 text-sm transition-all">
          Test Connection
        </button>
        <button className="px-4 py-2 rounded-xl bg-jarvis-glass/40 text-gray-400 border border-jarvis-glass-border hover:text-gray-300 hover:bg-jarvis-glass/60 text-sm transition-all">
          Download Model
        </button>
      </div>
    </div>
  );
};
