import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../lib/utils';

// ==========================================
// 1. GLOBAL FAST-SCROLL VELOCITY DETECTOR
// ==========================================
let isFastScrollingGlobal = false;
let scrollTimeoutId: any = null;
let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
let lastScrollTime = typeof window !== 'undefined' ? performance.now() : 0;
const scrollSettledListeners = new Set<() => void>();

function notifyScrollSettled() {
  scrollSettledListeners.forEach(cb => {
    try { cb(); } catch {}
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => {
    const now = performance.now();
    const currentY = window.scrollY;
    const timeDelta = Math.max(1, now - lastScrollTime);
    const distance = Math.abs(currentY - lastScrollY);
    const velocity = distance / timeDelta; // pixels per millisecond

    lastScrollY = currentY;
    lastScrollTime = now;

    // Fast flick/fling detection: velocity > 0.85 px/ms
    if (velocity > 0.85) {
      isFastScrollingGlobal = true;
    }

    if (scrollTimeoutId) clearTimeout(scrollTimeoutId);
    scrollTimeoutId = setTimeout(() => {
      isFastScrollingGlobal = false;
      notifyScrollSettled();
    }, 70); // 70ms debounce marks the scroll as settled/idle
  }, { passive: true });
}

// ==========================================
// 2. IN-MEMORY CACHE FOR INSTANT BACK-SCROLL
// ==========================================
const MAX_CACHE_SIZE = 3000;
const loadedImageCache = new Set<string>();

export function markStorefrontImageCached(url: string) {
  if (!url) return;
  if (loadedImageCache.size >= MAX_CACHE_SIZE) {
    const oldest = loadedImageCache.keys().next().value;
    if (oldest) loadedImageCache.delete(oldest);
  }
  loadedImageCache.add(url);
}

export function isStorefrontImageCached(url: string): boolean {
  return Boolean(url && loadedImageCache.has(url));
}

// ==========================================
// 3. STOREFRONT PRODUCT IMAGE COMPONENT
// ==========================================
export interface StorefrontProductImageProps {
  src?: string;
  hoverSrc?: string;
  alt?: string;
  className?: string;
  productImageHover?: boolean;
}

export const StorefrontProductImage = React.memo(function StorefrontProductImage({
  src,
  hoverSrc,
  alt = '',
  className,
  productImageHover = false,
}: StorefrontProductImageProps) {
  const cleanSrc = (src && src !== 'undefined' && src !== 'null' && src.trim().length > 0) ? src.trim() : '';
  const cleanHoverSrc = (hoverSrc && hoverSrc !== 'undefined' && hoverSrc !== 'null' && hoverSrc.trim().length > 0) ? hoverSrc.trim() : '';
  const isCached = isStorefrontImageCached(cleanSrc);

  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState<boolean>(isCached);
  const [isLoaded, setIsLoaded] = useState<boolean>(isCached);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(!isCached && Boolean(cleanSrc));
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const isIntersectingRef = useRef<boolean>(false);

  // Viewport intersection observer with tight buffer (loads just before entering viewport on normal scroll)
  useEffect(() => {
    if (isCached || shouldLoad || !cleanSrc) return;

    const el = containerRef.current;
    if (!el) return;

    let unmounted = false;
    let cleanupSettled: (() => void) | null = null;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      isIntersectingRef.current = entry.isIntersecting;

      if (entry.isIntersecting) {
        if (!isFastScrollingGlobal) {
          // Normal scroll or already settled: load immediately with high priority!
          if (!unmounted) setShouldLoad(true);
        } else {
          // Fast scrolling fling: wait for the scroll to settle to ensure user actually stopped here
          if (cleanupSettled) {
            cleanupSettled();
            cleanupSettled = null;
          }

          const onSettled = () => {
            if (cleanupSettled) {
              cleanupSettled();
              cleanupSettled = null;
            }
            if (unmounted) return;
            // Check if element is still near or in the viewport when scroll stopped
            const rect = el.getBoundingClientRect();
            const inOrNearViewport = rect.bottom >= -150 && rect.top <= (window.innerHeight + 250);
            if (inOrNearViewport) {
              setShouldLoad(true);
            }
          };

          cleanupSettled = () => {
            scrollSettledListeners.delete(onSettled);
          };
          scrollSettledListeners.add(onSettled);
        }
      } else {
        if (cleanupSettled) {
          cleanupSettled();
          cleanupSettled = null;
        }
      }
    }, {
      // 100px top buffer, 250px bottom buffer: keeps queue light, loads right on screen entry
      rootMargin: '100px 0px 250px 0px',
      threshold: 0.01,
    });

    observer.observe(el);

    return () => {
      unmounted = true;
      if (cleanupSettled) {
        cleanupSettled();
        cleanupSettled = null;
      }
      observer.disconnect();
    };
  }, [cleanSrc, isCached, shouldLoad]);

  const handleImageLoad = useCallback(() => {
    if (cleanSrc) markStorefrontImageCached(cleanSrc);
    setIsLoaded(true);
    // Smoothly fade out skeleton
    setTimeout(() => {
      setShowSkeleton(false);
    }, 150);
  }, [cleanSrc]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => productImageHover && setIsHovered(true)}
      onMouseLeave={() => productImageHover && setIsHovered(false)}
      className="relative w-full h-full overflow-hidden bg-gray-100"
    >
      {/* Lightweight subtle skeleton shimmer while loading */}
      {showSkeleton && (
        <div 
          className={cn(
            "absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200/60 to-gray-100 animate-pulse transition-opacity duration-300 pointer-events-none z-10",
            isLoaded ? "opacity-0" : "opacity-100"
          )} 
        />
      )}

      {/* Primary Image: loads with high priority once in viewport */}
      {shouldLoad && cleanSrc && (
        <img
          src={cleanSrc}
          alt={alt}
          decoding="async"
          fetchPriority={isLoaded ? "auto" : "high"}
          onLoad={handleImageLoad}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            className,
            isLoaded ? "opacity-100" : "opacity-0",
            productImageHover && cleanHoverSrc && isHovered ? "opacity-0" : ""
          )}
        />
      )}

      {/* On-Demand Hover Image: NEVER requested until the user actually hovers over the card */}
      {productImageHover && cleanHoverSrc && isHovered && (
        <img
          src={cleanHoverSrc}
          alt={`${alt} hover`}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-100 z-10"
        />
      )}
    </div>
  );
});

StorefrontProductImage.displayName = 'StorefrontProductImage';
