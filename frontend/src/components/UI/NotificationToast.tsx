import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/index';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: ToastAction;
}

const typeConfig: Record<
  ToastType,
  { bg: string; icon: string; bar: string }
> = {
  info: {
    bg: 'bg-jarvis-500/10 border-jarvis-500/30',
    icon: '💡',
    bar: 'bg-jarvis-500',
  },
  success: {
    bg: 'bg-green-500/10 border-green-500/30',
    icon: '✅',
    bar: 'bg-green-500',
  },
  warning: {
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    icon: '⚠️',
    bar: 'bg-yellow-500',
  },
  error: {
    bg: 'bg-red-500/10 border-red-500/30',
    icon: '❌',
    bar: 'bg-red-500',
  },
};

export const NotificationToast: React.FC = () => {
  const toasts: Toast[] = useAppStore((state) => state.toasts);
  const removeToast = useAppStore((state) => state.removeToast);

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed top-12 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const config = typeConfig[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className={`pointer-events-auto relative overflow-hidden rounded-xl border ${config.bg} backdrop-blur-xl min-w-[300px] max-w-[400px]`}
              role="alert"
            >
              <div className="flex items-start gap-3 p-3">
                <span className="text-lg flex-shrink-0" aria-hidden="true">
                  {config.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200">
                    {toast.title}
                  </p>
                  {toast.message && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {toast.message}
                    </p>
                  )}
                  {toast.action && (
                    <button
                      onClick={toast.action.onClick}
                      className="mt-1.5 text-xs text-jarvis-400 hover:text-jarvis-300 underline"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-gray-500 hover:text-gray-300 flex-shrink-0 p-0.5"
                  aria-label="Dismiss notification"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {toast.duration != null && toast.duration > 0 && (
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{
                    duration: toast.duration / 1000,
                    ease: 'linear',
                  }}
                  className={`h-0.5 ${config.bar}`}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
