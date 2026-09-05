import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Wand2, GripVertical, Grip } from 'lucide-react';
import { optimizeImageRun, urlToImageData, arrayBufferToDataUrl, OptimizeOptions, getDefaultImageOptimization, setDefaultImageOptimization } from '../lib/imageOptimizationWorker';
import { cn } from '../lib/utils';

interface ImageOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (optimizedDataUrl: string, originalSize: number, optimizedSize: number) => void;
  originalDataUrl: string;
  originalSize: number;
  initialWidth: number;
  initialHeight: number;
}

export default function ImageOptimizerModal({ 
  isOpen, 
  onClose, 
  onSave, 
  originalDataUrl, 
  originalSize,
  initialWidth,
  initialHeight
}: ImageOptimizerModalProps) {
  const [quality, setQuality] = useState(75);
  const [scale, setScale] = useState(100);
  const [useOriginal, setUseOriginal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [optimizedDataUrl, setOptimizedDataUrl] = useState<string | null>(null);
  const [optimizedSize, setOptimizedSize] = useState<number | null>(null);
  const [optimizedWidth, setOptimizedWidth] = useState(initialWidth);
  const [optimizedHeight, setOptimizedHeight] = useState(initialHeight);

  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  const [isDefaultMode, setIsDefaultMode] = useState(false);

  useEffect(() => {
    if (isOpen && originalDataUrl) {
      setLoadError(false);
      setImageData(null);
      setOptimizedDataUrl(null);
      const config = getDefaultImageOptimization();
      if (config && config.enabled) {
        setIsDefaultMode(true);
        setQuality(config.quality);
        setScale(config.scale);
      } else {
        setIsDefaultMode(false);
        setQuality(70);
        setScale(70);
      }
      urlToImageData(originalDataUrl, 1920)
        .then(data => {
          setImageData(data);
        })
        .catch(err => {
          console.error("Failed to load original image:", err);
          setLoadError(true);
        });
    }
    if (!isOpen) {
       setImageData(null);
       setOptimizedDataUrl(null);
       setLoadError(false);
       setQuality(70);
       setScale(70);
       setUseOriginal(false);
    }
  }, [isOpen, originalDataUrl]);

  const handleSetDefault = () => {
    const cur = getDefaultImageOptimization();
    setDefaultImageOptimization({ enabled: true, quality, scale, thumbnailWidth: cur.thumbnailWidth || 470, thumbnailQuality: cur.thumbnailQuality || 70 });
    setIsDefaultMode(true);
  };

  const handleReset = () => {
    setDefaultImageOptimization(null);
    setIsDefaultMode(false);
  };

  useEffect(() => {
    if (!imageData || !isOpen) return;

    if (useOriginal) {
      setOptimizedDataUrl(originalDataUrl);
      setOptimizedSize(originalSize);
      setOptimizedWidth(imageData.width);
      setOptimizedHeight(imageData.height);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setIsProcessing(true);
      
      const newWidth = Math.max(1, Math.round(imageData.width * (scale / 100)));
      const newHeight = Math.max(1, Math.round(imageData.height * (scale / 100)));
      
      const options: OptimizeOptions = { quality };
      if (scale !== 100) {
         options.resize = { width: newWidth, height: newHeight };
      }

      optimizeImageRun(imageData, options)
        .then(result => {
           const dataUrl = arrayBufferToDataUrl(result.buffer, 'image/webp');
           setOptimizedDataUrl(dataUrl);
           setOptimizedSize(result.buffer.byteLength);
           setOptimizedWidth(result.width);
           setOptimizedHeight(result.height);
        })
        .catch(err => {
           console.error("Optimization failed", err);
           setOptimizedDataUrl(originalDataUrl);
           setOptimizedSize(originalSize);
           setOptimizedWidth(imageData.width);
           setOptimizedHeight(imageData.height);
        })
        .finally(() => {
           setIsProcessing(false);
        });
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [quality, scale, useOriginal, imageData, isOpen, originalDataUrl, originalSize]);

  const handleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        let pos = ((clientX - rect.left) / rect.width) * 100;
        setSliderPos(Math.max(0, Math.min(100, pos)));
    };
    
    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' B';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] bg-[var(--dash-bg)]/80 backdrop-blur-sm flex justify-center items-center md:p-4"
        >
          <style>{`
            .custom-range::-webkit-slider-thumb {
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #020C09;
              border: 2px solid #fafafa;
              cursor: pointer;
              margin-top: -8px;
            }
            .custom-range::-webkit-slider-runnable-track {
              height: 4px;
              border-radius: 2px;
            }
          `}</style>
          
          <motion.div 
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            className="w-full h-full md:h-auto md:max-h-[90vh] max-w-lg bg-[#020C09] md:rounded-2xl flex flex-col shadow-2xl relative overflow-hidden text-gray-200"
          >
            {/* Top controls */}
            <div className="p-4 px-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-semibold text-white">Use original image</span>
                    <button 
                      onClick={() => setUseOriginal(!useOriginal)}
                      className={cn(
                        "w-[46px] h-6 rounded-full transition-colors relative flex items-center shrink-0 border-none",
                        useOriginal ? "bg-gray-600" : "bg-[#0b1b15]"
                      )}
                    >
                      <div className={cn(
                        "w-[18px] h-[18px] rounded-full absolute transition-transform shadow-sm",
                        useOriginal ? "translate-x-[26px] bg-white" : "translate-x-1 bg-[#fafafa]"
                      )} />
                    </button>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {isDefaultMode ? "Mode: Custom Default Optimization" : "Mode: Auto Optimization"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleReset} className="text-[11px] px-2.5 py-1.5 bg-[#0b1b15] text-gray-400 hover:text-white rounded border border-[#0e2a22] transition-colors whitespace-nowrap">Reset</button>
                  <button onClick={handleSetDefault} className="text-[11px] px-2.5 py-1.5 bg-[#fafafa]/10 text-[#fafafa] font-medium hover:bg-[#fafafa]/20 rounded border border-[#fafafa]/30 transition-colors whitespace-nowrap">Default</button>
                  <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 ml-1 shrink-0">
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Sliders Container */}
              <div className="space-y-5">
                <div className={cn("transition-opacity duration-300 relative", useOriginal && "opacity-30 pointer-events-none")}>
                  <div className="flex justify-between text-sm mb-2 text-white">
                    <span>Quality</span>
                    <span className="font-semibold">{quality}%</span>
                  </div>
                  <input 
                    type="range" min="1" max="100" value={quality}
                    onChange={e => setQuality(Number(e.target.value))}
                    className="w-full appearance-none bg-transparent custom-range focus:outline-none"
                    style={{
                      background: `linear-gradient(to right, #fafafa 0%, #fafafa ${quality}%, #0e2a22 ${quality}%, #0e2a22 100%)`,
                      height: '4px',
                      borderRadius: '2px'
                    }}
                  />
                </div>

                <div className={cn("transition-opacity duration-300 relative", useOriginal && "opacity-30 pointer-events-none")}>
                  <div className="flex justify-between text-sm mb-2 text-white">
                    <span>
                      Resolution <span className="text-gray-500 font-medium ml-1">({optimizedWidth} x {optimizedHeight})</span>
                    </span>
                    <span className="font-semibold">{scale}%</span>
                  </div>
                  <input 
                    type="range" min="10" max="100" step="1" value={scale}
                    onChange={e => setScale(Number(e.target.value))}
                    className="w-full appearance-none bg-transparent custom-range focus:outline-none"
                    style={{
                      background: `linear-gradient(to right, #fafafa 0%, #fafafa ${scale}%, #0e2a22 ${scale}%, #0e2a22 100%)`,
                      height: '4px',
                      borderRadius: '2px'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Before / After Label Strip */}
            <div className="px-5 pb-2 text-[13px] relative flex justify-between items-end border-b border-[#0e2a22]/50">
                <div className="flex flex-col">
                  <div className="text-gray-400">Before: <span className="text-white font-medium">{formatSize(originalSize)}</span></div>
                  <div className="text-gray-500 text-xs">({imageData?.width || initialWidth} x {imageData?.height || initialHeight})</div>
                </div>

                <div className="flex flex-col text-right">
                  <div className="text-gray-400">After: <span className="text-[#fafafa] font-medium">{optimizedSize !== null ? formatSize(optimizedSize) : '...' }</span></div>
                  <div className="text-[#fafafa] text-xs opacity-80">({optimizedWidth} x {optimizedHeight})</div>
                </div>

                {/* Fixed Center Grab Handle Info Icon Overlap */}
                <div className="absolute left-[50%] top-1/2 -translate-y-1/2 -translate-x-[50%] w-6 h-6 border-2 border-[#fafafa] bg-[#020C09] rounded-md flex items-center justify-center z-20" >
                  <div className="grid grid-cols-2 gap-[2px]">
                    <div className="w-[3px] h-[3px] bg-white rounded-full"></div>
                    <div className="w-[3px] h-[3px] bg-white rounded-full"></div>
                    <div className="w-[3px] h-[3px] bg-white rounded-full"></div>
                    <div className="w-[3px] h-[3px] bg-white rounded-full"></div>
                  </div>
                </div>
            </div>

            {/* Split Image View */}
            <div className="flex-1 min-h-[350px] relative bg-white overflow-hidden shadow-inner" ref={containerRef}>
              {loadError ? (
                 <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] text-red-400 p-4 text-center">
                   Failed to load original image format. Cannot optimize.
                 </div>
              ) : imageData === null ? (
                 <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-30">
                    <div className="w-8 h-8 border-2 border-[#fafafa]/20 border-t-[#fafafa] rounded-full animate-spin" />
                 </div>
              ) : (
                <>
                  {/* Base/Right: Optimized */}
                  <div className="absolute inset-0 flex items-center justify-center select-none bg-[#f1f1f1]">
                    {optimizedDataUrl && (
                      <img src={optimizedDataUrl} alt="Optimized" className="max-w-full max-h-full object-contain pointer-events-none select-none" />
                    )}
                  </div>

                  {/* Top/Left: Original */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center select-none bg-[#f1f1f1] border-r-2 border-[#fafafa]"
                    style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                  >
                    <img src={originalDataUrl} alt="Original" className="max-w-full max-h-full object-contain pointer-events-none select-none" />
                  </div>

                  {/* Slider Draggable Line */}
                  <div 
                    className="absolute top-0 bottom-0 w-8 -ml-4 flex items-center justify-center cursor-col-resize z-10 touch-none"
                    style={{ left: `${sliderPos}%` }}
                    onMouseDown={handleDrag}
                    onTouchStart={handleDrag}
                  >
                    {/* Invisible Wide Hitbox for dragging */}
                  </div>

                  {isProcessing && (
                    <div className="absolute inset-0 bg-[var(--dash-bg)]/10 flex items-center justify-center z-20">
                      <div className="w-8 h-8 border-2 border-[#fafafa]/20 border-t-[#fafafa] rounded-full animate-spin drop-shadow-md" />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 px-5 flex gap-4 justify-center md:justify-end items-center border-t border-[#0e2a22]">
              <button 
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = optimizedDataUrl || originalDataUrl;
                  a.download = `optimized_${Date.now()}.webp`;
                  a.click();
                }}
                disabled={!optimizedDataUrl && !originalDataUrl}
                className="py-2.5 px-6 border-2 border-[#0e2a22] text-white rounded-lg hover:bg-white/5 transition-colors font-medium text-sm disabled:opacity-50"
              >
                Download
              </button>
              <button 
                onClick={() => {
                  if (onSave && optimizedDataUrl) {
                    onSave(optimizedDataUrl, originalSize, optimizedSize || originalSize);
                  } else if (onSave && originalDataUrl) {
                    onSave(originalDataUrl, originalSize, originalSize); 
                  }
                }}
                disabled={isProcessing || (!optimizedDataUrl && !useOriginal)}
                className="py-2.5 px-6 bg-[#fafafa] text-[var(--dash-bg)] rounded-lg hover:bg-[#e4e4e7] transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-[15px]"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-[var(--dash-bg)]/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <><Wand2 size={18} /> Optimize</>
                )}
              </button>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
