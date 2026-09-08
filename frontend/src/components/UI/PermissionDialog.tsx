import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HolographicButton } from './HolographicButton';

export interface PermissionRequest {
  id: string;
  resource: string;
  resourceIcon?: string;
  name: string;
  description: string;
  details?: string;
  scope?: string;
}

interface PermissionDialogProps {
  isOpen: boolean;
  request: PermissionRequest | null;
  onAllow: (remember: boolean) => void;
  onDeny: (remember: boolean) => void;
  onClose: () => void;
}

const resourceIcons: Record<string, string> = {
  camera: '\u{1F4F7}',
  microphone: '\u{1F3A4}',
  screen: '\u{1F4BB}',
  filesystem: '\u{1F4C1}',
  network: '\u{1F310}',
  location: '\u{1F4CD}',
  calendar: '\u{1F4C5}',
  contacts: '\u{1F4D1}',
  notifications: '\u{1F514}',
  clipboard: '\u{1F4CB}',
  execution: '\u{2699}\u{FE0F}',
  default: '\u{1F512}',
};

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  isOpen,
  request,
  onAllow,
  onDeny,
  onClose,
}) => {
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        onAllow(rememberChoice);
      }
    },
    [onAllow, rememberChoice]
  );

  const getResourceIcon = (): string => {
    if (request?.resourceIcon) return request.resourceIcon;
    if (request?.resource && resourceIcons[request.resource]) {
      return resourceIcons[request.resource];
    }
    return resourceIcons.default;
  };

  return (
    <AnimatePresence>
      {isOpen && request && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Permission request: ${request.name}`}
          aria-describedby="permission-description"
          onKeyDown={handleKeyDown}
        >
          {/* Backdrop with glass morphism overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Animated permission card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 320,
            }}
            className="relative w-full max-w-md glass-heavy rounded-2xl overflow-hidden shadow-2xl border border-jarvis-glass-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Holographic header accent */}
            <div className="h-1 bg-gradient-to-r from-jarvis-500 via-jarvis-400 to-jarvis-accent-cyan" />

            {/* Content */}
            <div className="p-6">
              {/* Resource icon */}
              <div className="flex items-center justify-center mb-4">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: 'spring',
                    damping: 14,
                    stiffness: 200,
                    delay: 0.1,
                  }}
                  className="w-16 h-16 rounded-2xl bg-jarvis-500/10 border border-jarvis-500/30 flex items-center justify-center text-3xl"
                  aria-hidden="true"
                >
                  {getResourceIcon()}
                </motion.div>
              </div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xl font-semibold text-center text-gray-100 mb-1"
              >
                {request.name}
              </motion.h2>

              {/* Resource badge */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center mb-4"
              >
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-jarvis-500/10 text-jarvis-400 border border-jarvis-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-jarvis-500 animate-pulse" />
                  {request.resource.charAt(0).toUpperCase() + request.resource.slice(1)} Access
                </span>
              </motion.div>

              {/* Description */}
              <motion.p
                id="permission-description"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-sm text-gray-400 text-center leading-relaxed mb-5"
              >
                {request.description}
              </motion.p>

              {/* Details expandable */}
              {request.details && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ delay: 0.3 }}
                  className="mb-5 p-3 rounded-xl bg-jarvis-darker/60 border border-jarvis-glass-border"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-xs mt-0.5" aria-hidden="true">
                      {'ℹ️'}
                    </span>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {request.details}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Scope info */}
              {request.scope && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mb-5 flex items-center gap-2 text-xs text-gray-600 justify-center"
                >
                  <span className="w-1 h-1 rounded-full bg-gray-600" />
                  Scope: {request.scope}
                </motion.div>
              )}

              {/* Remember choice checkbox */}
              <motion.label
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="flex items-center justify-center gap-2.5 mb-6 cursor-pointer group"
                role="checkbox"
                aria-checked={rememberChoice}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setRememberChoice(!rememberChoice);
                  }
                }}
              >
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                    rememberChoice
                      ? 'bg-jarvis-500 border-jarvis-500'
                      : 'border-gray-600 group-hover:border-gray-500'
                  }`}
                  onClick={() => setRememberChoice(!rememberChoice)}
                >
                  {rememberChoice && (
                    <svg
                      className="w-3 h-3 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span
                  className="text-sm text-gray-400 select-none group-hover:text-gray-300 transition-colors"
                  onClick={() => setRememberChoice(!rememberChoice)}
                >
                  Remember my choice for this session
                </span>
              </motion.label>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-3"
              >
                <HolographicButton
                  variant="ghost"
                  size="lg"
                  fullWidth
                  onClick={() => onDeny(rememberChoice)}
                  ariaLabel="Deny permission"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Deny
                </HolographicButton>
                <HolographicButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => onAllow(rememberChoice)}
                  ariaLabel="Allow permission"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Allow
                </HolographicButton>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermissionDialog;
