import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Image as ImageIcon, ImageOff } from 'lucide-react';
import { cn } from '../lib/utils';

// Bounded session-level memory cache of loaded URLs to eliminate skeleton flicker when scrolling back and forth
const MAX_CACHE_SIZE = 2000;
const loadedImageCache = new Set<string>();

function markUrlCached(url: string) {
  if (!url) return;
  if (loadedImageCache.size >= MAX_CACHE_SIZE) {
    const oldest = loadedImageCache.keys().next().value;
    if (oldest) loadedImageCache.delete(oldest);
  }
  loadedImageCache.add(url);
}

export interface DashboardProductImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  dimmedOrOutOfStock?: boolean;
}

export const DashboardProductImage = React.memo(({
  src,
  alt = '',
  className,
  containerClassName,
  dimmedOrOutOfStock = false,
  ...rest
}: DashboardProductImageProps) => {
  const cleanSrc = (src && src !== 'undefined' && src !== 'null' && src.trim().length > 0) ? src.trim() : '';
  const isCached = Boolean(cleanSrc && loadedImageCache.has(cleanSrc));
  
  const [prevSrc, setPrevSrc] = useState(cleanSrc);
  const [isLoaded, setIsLoaded] = useState(isCached);
  const [hasError, setHasError] = useState(!cleanSrc);
  const [showSkeleton, setShowSkeleton] = useState(!isCached && Boolean(cleanSrc));
  const imgRef = useRef<HTMLImageElement>(null);

  // Synchronously adjust state when cleanSrc changes during render to avoid stale-state flash
  if (cleanSrc !== prevSrc) {
    setPrevSrc(cleanSrc);
    setIsLoaded(isCached);
    setHasError(!cleanSrc);
    setShowSkeleton(!isCached && Boolean(cleanSrc));
  }

  // Handle immediate browser cache hit on mount when image is already complete and decoded
  useEffect(() => {
    if (cleanSrc && imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      markUrlCached(cleanSrc);
      setIsLoaded(true);
      setShowSkeleton(false);
    }
  }, [cleanSrc]);

  // Cleanly dismiss skeleton after smooth fade-out transition (frees DOM and GPU composite layers)
  useEffect(() => {
    if (isLoaded && showSkeleton) {
      const timer = setTimeout(() => {
        setShowSkeleton(false);
      }, 320);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, showSkeleton]);

  const handleLoad = useCallback(() => {
    if (cleanSrc) markUrlCached(cleanSrc);
    setIsLoaded(true);
  }, [cleanSrc]);

  const handleError = useCallback(() => {
    setHasError(true);
    setShowSkeleton(false);
  }, []);

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-[var(--dash-card)] select-none", containerClassName)}>
      {/* 1. Ultra-lightweight GPU-accelerated Shimmer Skeleton */}
      {showSkeleton && !hasError && (
        <div 
          className={cn(
            "absolute inset-0 z-0 flex items-center justify-center bg-[var(--dash-card)] transition-opacity duration-300 pointer-events-none",
            isLoaded ? "opacity-0" : "opacity-100"
          )}
          aria-hidden="true"
        >
          {/* Hardware-accelerated shimmer wave */}
          <div className="dash-img-skeleton-shimmer absolute inset-0 pointer-events-none" />
          
          {/* Subtle placeholder icon aligned with theme border color */}
          <ImageIcon className="w-8 h-8 text-slate-500/20 shrink-0" strokeWidth={1.5} />
        </div>
      )}

      {/* 2. Graceful Error / Fallback State */}
      {hasError && (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-[var(--dash-card)] text-slate-500 gap-1 p-2 text-center pointer-events-none select-none">
          <ImageOff className="w-6 h-6 text-slate-500/50" strokeWidth={1.5} />
          <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500/70">No image</span>
        </div>
      )}

      {/* 3. Product Image with Smooth Fade-in - eager within virtualized overscan, async decoding for 60fps scrolling */}
      {cleanSrc && !hasError && (
        <img
          ref={imgRef}
          src={cleanSrc}
          alt={alt}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-out",
            isLoaded 
              ? (dimmedOrOutOfStock ? "opacity-75 grayscale" : "opacity-100") 
              : "opacity-0",
            className
          )}
          {...rest}
        />
      )}
    </div>
  );
});

DashboardProductImage.displayName = 'DashboardProductImage';
