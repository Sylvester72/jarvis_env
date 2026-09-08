import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/index';
import { GlassPanel } from '../components/UI/GlassPanel';
import { HolographicButton } from '../components/UI/HolographicButton';
import { CameraView } from '../components/Vision/CameraView';
import { ScreenView } from '../components/Vision/ScreenView';
import { OCRResult } from '../components/Vision/OCRResult';
import { DetectionOverlay } from '../components/Vision/DetectionOverlay';

interface Detection {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  color?: string;
}

const sampleDetections: Detection[] = [
  { label: 'Person', confidence: 0.97, bbox: { x: 120, y: 50, width: 180, height: 320 }, color: '#00d4ff' },
  { label: 'Laptop', confidence: 0.89, bbox: { x: 350, y: 200, width: 200, height: 140 }, color: '#10b981' },
  { label: 'Book', confidence: 0.76, bbox: { x: 30, y: 280, width: 80, height: 100 }, color: '#f59e0b' },
];

const detectionColors = [
  '#00d4ff',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

const pageVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -16,
    transition: { duration: 0.2, ease: [0.65, 0, 0.35, 1] },
  },
};

export const VisionPage: React.FC = () => {
  const navigate = useNavigate();
  const visionEnabled = useAppStore((state) => state.visionEnabled);
  const setVisionEnabled = useAppStore((state) => state.setVisionEnabled);
  const addToast = useAppStore((state) => state.addToast);

  const [activeView, setActiveView] = useState<'camera' | 'screen'>('camera');
  const [snapshotData, setSnapshotData] = useState<string | null>(null);
  const [showDetections, setShowDetections] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleCameraSnapshot = useCallback(
    (imageData: string) => {
      setSnapshotData(imageData);
      setSelectedImage(imageData);

      // Simulate object detection
      setDetections(
        sampleDetections.map((d, i) => ({
          ...d,
          color: detectionColors[i % detectionColors.length],
        }))
      );

      addToast({
        type: 'success',
        title: 'Snapshot captured',
        message: 'Image captured and analysis started',
      });
    },
    [addToast]
  );

  const handleScreenCapture = useCallback(
    (imageData: string) => {
      setSnapshotData(imageData);
      setSelectedImage(imageData);

      addToast({
        type: 'info',
        title: 'Screen captured',
        message: 'Screen content captured successfully',
      });
    },
    [addToast]
  );

  const handleClearCapture = useCallback(() => {
    setSnapshotData(null);
    setSelectedImage(null);
    setDetections([]);
  }, []);

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col h-full"
      role="region"
      aria-label="Vision page"
    >
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-jarvis-glass-border">
        <div className="flex items-center gap-3">
          <HolographicButton
            variant="ghost"
            size="sm"
            onClick={handleBack}
            ariaLabel="Back to home"
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
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </HolographicButton>
          <h1 className="text-lg font-semibold text-gray-100">Vision</h1>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {/* Vision enabled toggle */}
        <GlassPanel intensity="light" padding="sm">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{'\u{1F4F7}'}</span>
              <div>
                <p className="text-sm font-medium text-gray-200">
                  Vision System
                </p>
                <p className="text-xs text-gray-500">
                  Camera and screen capture capabilities
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-jarvis-darker/40 rounded-lg p-0.5 border border-jarvis-glass-border">
                {(['camera', 'screen'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setActiveView(view)}
                    disabled={!visionEnabled}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                      activeView === view
                        ? 'bg-jarvis-500/20 text-jarvis-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-300'
                    } ${!visionEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    aria-pressed={activeView === view}
                    aria-label={`${view} view`}
                  >
                    {view === 'camera' ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 7l-7 5 7 5V7z" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    )}
                    <span className="capitalize">{view}</span>
                  </button>
                ))}
              </div>

              {/* Master toggle */}
              <button
                onClick={() => setVisionEnabled(!visionEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  visionEnabled ? 'bg-jarvis-500' : 'bg-gray-700'
                }`}
                role="switch"
                aria-checked={visionEnabled}
                aria-label="Toggle vision system"
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    visionEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </GlassPanel>

        {!visionEnabled ? (
          <GlassPanel intensity="default" padding="lg">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-400 mb-1">
                Vision System Disabled
              </h3>
              <p className="text-xs text-gray-600 max-w-sm mx-auto">
                Enable the vision system to access camera and screen capture features.
                Toggle the switch above to get started.
              </p>
            </div>
          </GlassPanel>
        ) : (
          <>
            {/* Camera / Screen view */}
            <GlassPanel intensity="default" padding="md">
              <AnimatePresence mode="wait">
                {activeView === 'camera' ? (
                  <motion.div
                    key="camera"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CameraView
                      onSnapshot={handleCameraSnapshot}
                      className="w-full"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="screen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ScreenView
                      onCapture={handleScreenCapture}
                      className="w-full"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassPanel>

            {/* Captured image with detection overlay */}
            {selectedImage && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {/* Captured image preview */}
                  <GlassPanel intensity="default" padding="md">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-jarvis-400">{'\u{1F4F8}'}</span>
                        <h3 className="text-sm font-medium text-gray-200">
                          Captured Image
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowDetections(!showDetections)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            showDetections
                              ? 'bg-jarvis-500/15 text-jarvis-400 border border-jarvis-500/30'
                              : 'text-gray-500 hover:text-gray-300 border border-transparent'
                          }`}
                          aria-label={showDetections ? 'Hide detections' : 'Show detections'}
                          aria-pressed={showDetections}
                        >
                          <span className="flex items-center gap-1.5">
                            <svg
                              className="w-3 h-3"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="3" />
                              <circle cx="19" cy="5" r="2" />
                              <circle cx="5" cy="19" r="2" />
                              <line x1="12" y1="9" x2="17" y2="6" />
                              <line x1="7" y1="17" x2="10" y2="14" />
                            </svg>
                            Detections
                          </span>
                        </button>
                        <HolographicButton
                          variant="ghost"
                          size="sm"
                          onClick={handleClearCapture}
                          ariaLabel="Clear captured image"
                        >
                          <svg
                            className="w-3.5 h-3.5"
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
                          Clear
                        </HolographicButton>
                      </div>
                    </div>

                    <div className="relative rounded-xl overflow-hidden bg-jarvis-darker">
                      <img
                        src={selectedImage}
                        alt="Captured snapshot"
                        className="w-full h-auto max-h-[400px] object-contain"
                      />
                      {showDetections && detections.length > 0 && (
                        <DetectionOverlay
                          detections={detections}
                          imageWidth={640}
                          imageHeight={480}
                          containerWidth={640}
                          containerHeight={480}
                          className="absolute inset-0"
                        />
                      )}
                    </div>
                  </GlassPanel>

                  {/* OCR Result */}
                  <OCRResult className="w-full" />

                  {/* Detection summary */}
                  {showDetections && detections.length > 0 && (
                    <GlassPanel intensity="light" padding="md">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-jarvis-400">{'\u{1F50D}'}</span>
                        <h3 className="text-sm font-medium text-gray-200">
                          Detection Results
                        </h3>
                        <span className="text-[10px] text-gray-600 bg-jarvis-glass/40 px-1.5 py-0.5 rounded">
                          {detections.length} objects
                        </span>
                      </div>
                      <div className="space-y-2">
                        {detections.map((det, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between px-3 py-2 rounded-xl bg-jarvis-darker/40 border border-jarvis-glass-border"
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    det.color ||
                                    detectionColors[index % detectionColors.length],
                                }}
                              />
                              <span className="text-sm text-gray-300">
                                {det.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-jarvis-glass/40 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${det.confidence * 100}%`,
                                    backgroundColor:
                                      det.color ||
                                      detectionColors[index % detectionColors.length],
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 font-mono w-10 text-right">
                                {(det.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassPanel>
                  )}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Vision control panel */}
            <GlassPanel intensity="light" padding="md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-jarvis-400">{'\u{2699}\u{FE0F}'}</span>
                <h3 className="text-sm font-medium text-gray-200">
                  Vision Settings
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-jarvis-darker/40 border border-jarvis-glass-border">
                  <span className="text-xs text-gray-400">Auto-detect</span>
                  <div className="relative w-8 h-4 rounded-full bg-jarvis-500 transition-colors">
                    <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-white shadow" />
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-jarvis-darker/40 border border-jarvis-glass-border">
                  <span className="text-xs text-gray-400">Save captures</span>
                  <div className="relative w-8 h-4 rounded-full bg-gray-700 transition-colors">
                    <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow" />
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-jarvis-darker/40 border border-jarvis-glass-border">
                  <span className="text-xs text-gray-400">High resolution</span>
                  <div className="relative w-8 h-4 rounded-full bg-jarvis-500 transition-colors">
                    <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-white shadow" />
                  </div>
                </div>
              </div>
            </GlassPanel>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default VisionPage;
