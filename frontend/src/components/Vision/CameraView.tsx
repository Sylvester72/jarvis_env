import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CameraViewProps {
  onSnapshot?: (imageData: string) => void;
  className?: string;
}

export const CameraView: React.FC<CameraViewProps> = ({ onSnapshot, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setHasPermission(true);
    } catch (err: any) {
      const message =
        err.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : err.name === 'NotFoundError'
            ? 'No camera found'
            : `Camera error: ${err.message}`;
      setError(message);
      setHasPermission(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const flipCamera = useCallback(() => {
    if (isActive) stopCamera();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, [isActive, stopCamera]);

  const takeSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isActive) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onSnapshot?.(dataUrl);
  }, [isActive, onSnapshot]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (streamRef.current) {
      startCamera();
    }
  }, [facingMode, startCamera]);

  return (
    <div
      className={`glass rounded-2xl overflow-hidden border border-jarvis-glass-border ${className}`}
      role="region"
      aria-label="Camera view"
    >
      <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
        {!isActive && !error && (
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-jarvis-500/10 flex items-center justify-center border border-jarvis-500/30">
              <svg
                className="w-8 h-8 text-jarvis-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm mb-4">Camera is off</p>
          </div>
        )}

        {error && (
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
              <svg
                className="w-8 h-8 text-red-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${isActive ? '' : 'hidden'}`}
          playsInline
          muted
          aria-hidden="true"
        />

        {isActive && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-white font-medium bg-black/50 px-2 py-0.5 rounded-full">
              REC
            </span>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      </div>

      <div className="flex items-center justify-center gap-2 p-3">
        {!isActive ? (
          <button
            onClick={startCamera}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jarvis-500/20 text-jarvis-400 hover:bg-jarvis-500/30 border border-jarvis-500/30 transition-all text-sm"
            aria-label="Start camera"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Start Camera
          </button>
        ) : (
          <>
            <button
              onClick={takeSnapshot}
              className="w-10 h-10 rounded-full bg-jarvis-500/20 border-2 border-jarvis-500 flex items-center justify-center hover:bg-jarvis-500/30 transition-all"
              aria-label="Take snapshot"
            >
              <div className="w-4 h-4 rounded-full bg-jarvis-500" />
            </button>
            <button
              onClick={flipCamera}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-jarvis-glass/40 text-gray-300 hover:text-jarvis-400 border border-jarvis-glass-border transition-all text-sm"
              aria-label="Flip camera"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <path d="M13 9l3 3-3 3" />
                <path d="M7 12h9" />
              </svg>
              Flip
            </button>
            <button
              onClick={stopCamera}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all text-sm"
              aria-label="Stop camera"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
};
