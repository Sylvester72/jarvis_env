import React, { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/index';

export const Waveform: React.FC<{ barCount?: number; height?: number; color?: string }> = ({
  barCount = 48,
  height = 40,
  color = '#00d4ff',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const barsRef = useRef<Float32Array>(new Float32Array(barCount));
  const audioLevel = useAppStore((state) => state.audioLevel);
  const isListening = useAppStore((state) => state.isListening);
  const isSpeaking = useAppStore((state) => state.isSpeaking);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const bars = barsRef.current;
    const barWidth = (width - (barCount - 1) * 1.5) / barCount;
    const centerY = height / 2;

    // Update bars
    for (let i = 0; i < barCount; i++) {
      if (!isListening && !isSpeaking) {
        bars[i] *= 0.9; // Decay to flat
        if (Math.abs(bars[i]) < 0.01) bars[i] = 0;
        continue;
      }

      const target = isListening
        ? Math.random() * audioLevel * 2
        : Math.sin(Date.now() / 200 + i * 0.3) * 0.3 + 0.3;

      bars[i] = bars[i] * 0.7 + target * 0.3;
    }

    // Draw bars
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, '#0088ff');
    gradient.addColorStop(1, color + '44');

    for (let i = 0; i < barCount; i++) {
      const barHeight = Math.max(bars[i] * height * 0.8, isListening ? 1 : 0.5);
      const x = i * (barWidth + 1.5);
      const y = centerY - barHeight / 2;

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [barCount, audioLevel, color, height, isListening, isSpeaking]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height }}
      aria-label="Audio waveform visualization"
    />
  );
};
