import React, { useState, useRef, useEffect, useCallback } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

const positionClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  className = '',
}) => {
  const [visible, setVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const id = useRef(
    `tooltip-${Math.random().toString(36).substring(2, 11)}`
  );

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  }, []);

  // Smart positioning: flip if tooltip would go off-screen
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newPosition = position;

    if (position === 'top' && triggerRect.top - tooltipRect.height < 0) {
      newPosition = 'bottom';
    } else if (
      position === 'bottom' &&
      triggerRect.bottom + tooltipRect.height > viewportHeight
    ) {
      newPosition = 'top';
    } else if (position === 'left' && triggerRect.left - tooltipRect.width < 0) {
      newPosition = 'right';
    } else if (
      position === 'right' &&
      triggerRect.right + tooltipRect.width > viewportWidth
    ) {
      newPosition = 'left';
    }

    setAdjustedPosition(newPosition);
  }, [visible, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      className={`inline-flex relative ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={id.current}
    >
      {children}
      {visible && (
        <div
          ref={tooltipRef}
          id={id.current}
          role="tooltip"
          className={`absolute z-[9999] px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none
            bg-gray-900/95 backdrop-blur-md border border-jarvis-glass-border text-gray-200
            shadow-lg animate-fade-in ${positionClasses[adjustedPosition]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
