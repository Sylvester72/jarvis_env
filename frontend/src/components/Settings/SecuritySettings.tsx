import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/index';
import { Modal } from '../UI/Modal';

export const SecuritySettings: React.FC = () => {
  const privacyMode = useAppStore((state) => state.privacyMode);
  const setPrivacyMode = useAppStore((state) => state.setPrivacyMode);
  const telemetryEnabled = useAppStore((state) => state.telemetryEnabled);
  const setTelemetryEnabled = useAppStore((state) => state.setTelemetryEnabled);
  const clearConversations = useAppStore((state) => state.clearConversations);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const permissions = [
    { name: 'Microphone', icon: '🎤', status: 'granted' as const },
    { name: 'Camera', icon: '📷', status: 'prompt' as const },
    { name: 'Screen Capture', icon: '🖥️', status: 'prompt' as const },
    { name: 'File System', icon: '📁', status: 'granted' as const },
    { name: 'Notifications', icon: '🔔', status: 'granted' as const },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-200 mb-3">Privacy</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-300">Privacy Mode</span>
              <p className="text-xs text-gray-500">Disable logging and data persistence</p>
            </div>
            <button
              onClick={() => setPrivacyMode(!privacyMode)}
              className={`relative w-10 h-5 rounded-full transition-colors ${privacyMode ? 'bg-jarvis-500' : 'bg-gray-700'}`}
              role="switch"
              aria-checked={privacyMode}
            >
              <motion.div
                animate={{ x: privacyMode ? 20 : 2 }}
                className="w-4 h-4 rounded-full bg-white absolute top-0.5"
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-300">Telemetry</span>
              <p className="text-xs text-gray-500">Help improve JARVIS by sending anonymous usage data</p>
            </div>
            <button
              onClick={() => setTelemetryEnabled(!telemetryEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${telemetryEnabled ? 'bg-jarvis-500' : 'bg-gray-700'}`}
              role="switch"
              aria-checked={telemetryEnabled}
            >
              <motion.div
                animate={{ x: telemetryEnabled ? 20 : 2 }}
                className="w-4 h-4 rounded-full bg-white absolute top-0.5"
              />
            </button>
          </div>
        </div>
      </div>

      <div className="divider-gradient" />

      <div>
        <h3 className="text-sm font-medium text-gray-200 mb-3">Permissions</h3>
        <div className="space-y-2">
          {permissions.map((perm) => (
            <div key={perm.name} className="flex items-center justify-between glass rounded-xl px-3 py-2.5 border border-jarvis-glass-border">
              <div className="flex items-center gap-2">
                <span className="text-sm">{perm.icon}</span>
                <span className="text-sm text-gray-300">{perm.name}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                perm.status === 'granted' ? 'bg-green-500/10 text-green-400' :
                perm.status === 'denied' ? 'bg-red-500/10 text-red-400' :
                'bg-yellow-500/10 text-yellow-400'
              }`}>
                {perm.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="divider-gradient" />

      <div>
        <h3 className="text-sm font-medium text-gray-200 mb-3">Data Management</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-sm transition-all"
          >
            Clear Conversations
          </button>
          <button className="px-4 py-2 rounded-xl bg-jarvis-glass/40 text-gray-400 border border-jarvis-glass-border hover:text-gray-300 text-sm transition-all">
            Export Data
          </button>
          <button className="px-4 py-2 rounded-xl bg-jarvis-glass/40 text-gray-400 border border-jarvis-glass-border hover:text-gray-300 text-sm transition-all">
            Import Data
          </button>
        </div>
      </div>

      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All Conversations"
        size="sm"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 rounded-xl text-sm text-gray-400 border border-jarvis-glass-border hover:text-gray-300 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => { clearConversations(); setShowClearConfirm(false); }}
              className="px-4 py-2 rounded-xl text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
            >
              Clear All
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-400">
          Are you sure you want to clear all conversation history? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
