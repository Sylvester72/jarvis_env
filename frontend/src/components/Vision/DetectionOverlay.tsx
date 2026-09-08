import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Detection {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  color?: string;
}

interface DetectionOverlayProps {
  detections: Detection[];
  imageWidth: number;
  imageHeight: number;
  containerWidth?: number;
  containerHeight?: number;
  className?: string;
}

const defaultColors = [
  '#00d4ff',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  detections,
  imageWidth,
  imageHeight,
  containerWidth = 640,
  containerHeight = 480,
  className = '',
}) => {
  if (!detections || detections.length === 0) return null;

  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;

  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox={`0 0 ${containerWidth} ${containerHeight}`}
      aria-label="Detection overlay"
    >
      {detections.map((det, index) => {
        const color = det.color || defaultColors[index % defaultColors.length];
        const x = det.bbox.x * scaleX;
        const y = det.bbox.y * scaleY;
        const width = det.bbox.width * scaleX;
        const height = det.bbox.height * scaleY;

        return (
          <motion.g
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            {/* Semi-transparent filled box */}
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill={`${color}15`}
              stroke={color}
              strokeWidth="1.5"
              rx="4"
            />

            {/* Dashed inner border accent */}
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill="none"
              stroke={color}
              strokeWidth="1"
              rx="4"
              strokeDasharray="4 3"
              opacity="0.5"
            />

            {/* Label background and text */}
            <g>
              <rect
                x={x}
                y={y - 22}
                width={det.label.length * 8 + 30}
                height="20"
                rx="4"
                fill={color}
                opacity="0.9"
              />
              <text
                x={x + 4}
                y={y - 8}
                fill="#0a0e1a"
                fontSize="11"
                fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {det.label}
              </text>
              <text
                x={x + det.label.length * 8 + 26}
                y={y - 8}
                fill="white"
                fontSize="10"
                fontWeight="500"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
              >
                {(det.confidence * 100).toFixed(0)}%
              </text>
            </g>
          </motion.g>
        );
      })}
    </svg>
  );
};
