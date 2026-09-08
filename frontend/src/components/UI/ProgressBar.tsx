import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showPercentage?: boolean;
  className?: string;
  color?: string;
}

const sizeMap = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  indeterminate = false,
  size = 'md',
  label,
  showPercentage = false,
  className = '',
  color,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={`w-full ${className}`}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label || 'Progress'}
    >
      {(label || showPercentage) && (
        <div className="flex justify-between mb-1">
          {label && <span className="text-xs text-gray-400">{label}</span>}
          {showPercentage && (
            <span className="text-xs text-gray-500 font-mono">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-jarvis-glass/40 rounded-full overflow-hidden ${sizeMap[size]}`}
      >
        {indeterminate ? (
          <div
            className={`h-full rounded-full bg-gradient-to-r from-jarvis-500/30 via-jarvis-500 to-jarvis-500/30 bg-[length:200%_100%] animate-shimmer ${sizeMap[size]}`}
          />
        ) : (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full bg-gradient-to-r from-jarvis-500 to-jarvis-400 ${sizeMap[size]}`}
            style={color ? { background: color } : undefined}
          />
        )}
      </div>
    </div>
  );
};
