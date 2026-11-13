import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  X,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Check,
  Move,
} from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  mode: 'avatar' | 'banner';
  fileName?: string;
  onCancel: () => void;
  onApply: (croppedFile: File, previewUrl: string) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  mode,
  fileName = 'image.png',
  onCancel,
  onApply,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // total degrees (-360..360)
  const [flipX, setFlipX] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [applying, setApplying] = useState(false);

  const frameWidth = mode === 'avatar' ? 300 : 480;
  const frameHeight = mode === 'avatar' ? 300 : 160;
  const exportWidth = mode === 'avatar' ? 512 : 1200;
  const exportHeight = mode === 'avatar' ? 512 : 400;

  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setImgLoaded(false);
      imgRef.current = null;
      return;
    }

    setZoom(1);
    setRotation(0);
    setFlipX(false);
    setOffset({ x: 0, y: 0 });
    setImgLoaded(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  const drawToCanvas = useCallback(
    (
      targetCanvas: HTMLCanvasElement,
      targetW: number,
      targetH: number,
      scaleFactorFromPreview = 1
    ) => {
      const ctx = targetCanvas.getContext('2d');
      const img = imgRef.current;
      if (!ctx || !img) return;

      targetCanvas.width = targetW;
      targetCanvas.height = targetH;

      ctx.clearRect(0, 0, targetW, targetH);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, targetW, targetH);

      const rad = (rotation * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(rad));
      const absSin = Math.abs(Math.sin(rad));

      // Compute base scale so rotated image covers the crop frame at zoom = 1
      const rotatedW = img.naturalWidth * absCos + img.naturalHeight * absSin;
      const rotatedH = img.naturalWidth * absSin + img.naturalHeight * absCos;
      const coverScale = Math.max(targetW / rotatedW, targetH / rotatedH);

      ctx.save();
      ctx.translate(
        targetW / 2 + offset.x * scaleFactorFromPreview,
        targetH / 2 + offset.y * scaleFactorFromPreview
      );
      ctx.rotate(rad);
      ctx.scale(
        (flipX ? -1 : 1) * coverScale * zoom,
        coverScale * zoom
      );
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        img,
        -img.naturalWidth / 2,
        -img.naturalHeight / 2,
        img.naturalWidth,
        img.naturalHeight
      );
      ctx.restore();
    },
    [zoom, rotation, flipX, offset]
  );

  useEffect(() => {
    if (!isOpen || !imgLoaded || !canvasRef.current) return;
    drawToCanvas(canvasRef.current, frameWidth, frameHeight, 1);
  }, [isOpen, imgLoaded, drawToCanvas, frameWidth, frameHeight]);

  if (!isOpen || !imageSrc) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.ox + dx,
      y: dragStartRef.current.oy + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => Math.min(3, Math.max(1, Number((z + delta).toFixed(2)))));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setFlipX(false);
    setOffset({ x: 0, y: 0 });
  };

  const handleApply = async () => {
    if (!imgRef.current) return;
    setApplying(true);
    try {
      const outCanvas = document.createElement('canvas');
      const scaleFactor = exportWidth / frameWidth;
      drawToCanvas(outCanvas, exportWidth, exportHeight, scaleFactor);

      const blob = await new Promise<Blob | null>((resolve) =>
        outCanvas.toBlob((b) => resolve(b), 'image/png', 0.95)
      );
      if (!blob) return;

      const base = fileName.replace(/\.[^.]+$/, '') || (mode === 'avatar' ? 'avatar' : 'banner');
      const croppedFile = new File([blob], `${base}_cropped.png`, { type: 'image/png' });
      const previewUrl = URL.createObjectURL(croppedFile);
      onApply(croppedFile, previewUrl);
    } finally {
      setApplying(false);
    }
  };

  const quarterTurn = Math.round(rotation / 90) * 90;
  const fineTilt = Math.max(-45, Math.min(45, rotation - quarterTurn));

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
              {mode === 'avatar' ? 'Edit Profile Picture' : 'Edit Profile Banner'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Drag to frame, scroll or slide to zoom, and rotate to fit.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Crop Canvas Viewport */}
        <div className="p-6 space-y-5">
          <div className="bg-zinc-950 rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center border border-zinc-800">
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              style={{
                width: '100%',
                maxWidth: `${frameWidth}px`,
                aspectRatio: `${frameWidth} / ${frameHeight}`,
              }}
              className={`relative overflow-hidden select-none touch-none rounded-xl bg-zinc-900 ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full block"
              />

              {/* Circular Overlay Mask for Avatars / Frame Border for Banners */}
              {mode === 'avatar' ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    boxShadow: 'inset 0 0 0 9999px rgba(9, 9, 11, 0.55)',
                    borderRadius: '9999px',
                    border: '2px solid rgba(255, 255, 255, 0.85)',
                  }}
                />
              ) : (
                <div className="pointer-events-none absolute inset-0 border-2 border-white/80 rounded-xl" />
              )}

              {/* Subtle rule-of-thirds grid while dragging */}
              {isDragging && (
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
                  <div className="border-r border-b border-white/50" />
                  <div className="border-r border-b border-white/50" />
                  <div className="border-b border-white/50" />
                  <div className="border-r border-b border-white/50" />
                  <div className="border-r border-b border-white/50" />
                  <div className="border-b border-white/50" />
                  <div className="border-r border-white/50" />
                  <div className="border-r border-white/50" />
                  <div />
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Move className="w-3.5 h-3.5" />
              <span>Drag image to reposition inside the frame</span>
            </div>
          </div>

          {/* Zoom & Rotation Controls */}
          <div className="space-y-4">
            {/* Zoom Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Zoom</span>
                <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  {zoom.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, Number((z - 0.15).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  aria-label="Zoom level"
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Straighten / Fine Rotation Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Rotate & Straighten
                </span>
                <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  {Math.round(rotation)}°
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRotation((r) => r - 90)}
                  className="py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Rotate 90 degrees left"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>-90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => r + 90)}
                  className="py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Rotate 90 degrees right"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>+90°</span>
                </button>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={fineTilt}
                  onChange={(e) => setRotation(quarterTurn + Number(e.target.value))}
                  aria-label="Fine rotation angle"
                  className="flex-1 min-w-[120px] accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setFlipX((f) => !f)}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer border transition-colors ${
                    flipX
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Flip horizontal"
                >
                  <FlipHorizontal2 className="w-3.5 h-3.5" />
                  <span>Flip</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="py-2 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="py-2 px-4 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!imgLoaded || applying}
                onClick={handleApply}
                className="py-2 px-5 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{applying ? 'Applying...' : 'Apply'}</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
