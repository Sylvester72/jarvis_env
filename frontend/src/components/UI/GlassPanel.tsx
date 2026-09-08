import React from 'react';
import { motion } from 'framer-motion';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'light' | 'default' | 'heavy';
  hover?: boolean;
  animate?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  as?: 'div' | 'section' | 'article' | 'aside';
  style?: React.CSSProperties;
  role?: string;
  'aria-label'?: string;
}

const intensityMap = {
  light: 'bg-jarvis-glass/40 backdrop-blur-md',
  default: 'bg-jarvis-glass/60 backdrop-blur-xl',
  heavy: 'bg-jarvis-glass/80 backdrop-blur-2xl',
};

const paddingMap = {
  none: 'p-0',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

const roundedMap = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
  '2xl': 'rounded-4xl',
};

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = '',
  intensity = 'default',
  hover = false,
  animate = false,
  padding = 'md',
  rounded = 'xl',
  as: Component = 'div',
  style,
  role,
  'aria-label': ariaLabel,
}) => {
  const baseClasses = [
    intensityMap[intensity],
    paddingMap[padding],
    roundedMap[rounded],
    'border border-jarvis-glass-border',
    'transition-all duration-300',
    hover ? 'hover:shadow-glow hover:border-jarvis-500/40' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={baseClasses}
        style={style}
        role={role}
        aria-label={ariaLabel}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <Component
      className={baseClasses}
      style={style}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </Component>
  );
};
