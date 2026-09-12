import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, ImageOff } from 'lucide-react';
import { cn } from '../lib/utils';

// Session-level memory cache of loaded URLs to eliminate skeleton flicker when scrolling back and forth in virtualized lists
const loadedImageCache = new Set<string>();

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
  
  const [isLoaded, setIsLoaded] = useState(isCached);
  const [hasError, setHasError] = useState(!cleanSrc);
  const [showSkeleton, setShowSkeleton] = useState(!isCached && Boolean(cleanSrc));
  const imgRef = useRef<HTMLImageElement>(null);

  // Sync state when src changes
  useEffect(() => {
    if (!cleanSrc) {
      setIsLoaded(false);
      setHasError(true);
      setShowSkeleton(false);
      return;
    }

    if (loadedImageCache.has(cleanSrc)) {
      setIsLoaded(true);
      setHasError(false);
      setShowSkeleton(false);
      return;
    }

    setIsLoaded(false);
    setHasError(false);
    setShowSkeleton(true);
  }, [cleanSrc]);

  // Handle immediate browser cache hit on mount before onLoad fires
  useEffect(() => {
    if (cleanSrc && imgRef.current?.complete) {
      if (imgRef.current.naturalWidth > 0) {
        loadedImageCache.add(cleanSrc);
        setIsLoaded(true);
        setShowSkeleton(false);
      } else if (imgRef.current.naturalWidth === 0) {
        setHasError(true);
        setShowSkeleton(false);
      }
    }
  }, [cleanSrc]);

  // Cleanly dismiss skeleton after smooth fade-out transition (frees GPU compositor layer)
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        setShowSkeleton(false);
      }, 320);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  const handleLoad = () => {
    if (cleanSrc) loadedImageCache.add(cleanSrc);
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setShowSkeleton(false);
  };

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-[var(--dash-card)] select-none", containerClassName)}>
      {/* 1. Ultra-lightweight GPU-accelerated Shimmer Skeleton */}
      {showSkeleton && !hasError && (
        <div 
          className={cn(
            "absolute inset-0 z-0 flex items-center justify-center bg-slate-800/80 transition-opacity duration-300 pointer-events-none",
            isLoaded ? "opacity-0" : "opacity-100"
          )}
          aria-hidden="true"
        >
          {/* Hardware-accelerated shimmer wave */}
          <div className="dash-img-skeleton-shimmer absolute inset-0 pointer-events-none" />
          
          {/* Subtle placeholder icon */}
          <ImageIcon className="w-8 h-8 text-slate-600/30 shrink-0" strokeWidth={1.5} />
        </div>
      )}

      {/* 2. Graceful Error / Fallback State */}
      {hasError && (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-slate-800/90 text-slate-500 gap-1 p-2 text-center pointer-events-none select-none">
          <ImageOff className="w-6 h-6 text-slate-500/60" strokeWidth={1.5} />
          <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500/80">No image</span>
        </div>
      )}

      {/* 3. Product Image with Smooth Fade-in */}
      {cleanSrc && !hasError && (
        <img
          ref={imgRef}
          src={cleanSrc}
          alt={alt}
          loading="lazy"
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
