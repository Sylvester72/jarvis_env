import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ScreenViewProps {
  onCapture?: (imageData: string) => void;
  className?: string;
}

export const ScreenView: React.FC<ScreenViewProps> = ({ onCapture, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const startCapture = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopCapture();
      });

      setIsCapturing(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Screen capture cancelled');
      } else {
        setError(`Capture error: ${err.message}`);
      }
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  }, []);

  const takeScreenshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isCapturing) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    setThumbnail(dataUrl);
    onCapture?.(dataUrl);
  }, [isCapturing, onCapture]);

  useEffect(() => {
    return () => stopCapture();
  }, [stopCapture]);

  return (
    <div
      className={`glass rounded-2xl overflow-hidden border border-jarvis-glass-border ${className}`}
      role="region"
      aria-label="Screen capture view"
    >
      <div className="relative bg-jarvis-darker aspect-video flex items-center justify-center overflow-hidden">
        {!isCapturing && !thumbnail && !error && (
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-jarvis-500/10 flex items-center justify-center border border-jarvis-500/30">
              <svg
                className="w-8 h-8 text-jarvis-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">No active screen capture</p>
          </div>
        )}

        {error && (
          <div className="text-center p-8">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-xs text-jarvis-400 hover:text-jarvis-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {thumbnail && !isCapturing && (
          <img
            src={thumbnail}
            alt="Screen capture"
            className="w-full h-full object-contain"
          />
        )}

        <video
          ref={videoRef}
          className={`w-full h-full object-contain ${isCapturing ? '' : 'hidden'}`}
          playsInline
          muted
          aria-hidden="true"
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        {isCapturing && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-white font-medium bg-black/50 px-2 py-0.5 rounded-full">
              Capturing
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 p-3">
        {!isCapturing ? (
          <button
            onClick={startCapture}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jarvis-500/20 text-jarvis-400 hover:bg-jarvis-500/30 border border-jarvis-500/30 transition-all text-sm"
            aria-label="Start screen capture"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Share Screen
          </button>
        ) : (
          <>
            <button
              onClick={takeScreenshot}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-jarvis-500/20 text-jarvis-400 border border-jarvis-500/30 hover:bg-jarvis-500/30 transition-all text-sm"
              aria-label="Take screenshot"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Screenshot
            </button>
            <button
              onClick={stopCapture}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all text-sm"
              aria-label="Stop screen capture"
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
