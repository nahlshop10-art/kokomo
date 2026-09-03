import { useEffect } from 'react';

let lockCount = 0;

export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;
    
    // Add lock
    lockCount++;
    if (lockCount === 1) {
      document.body.classList.add('scroll-locked');
      document.documentElement.classList.add('scroll-locked');
    }

    // Cleanup
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.classList.remove('scroll-locked');
        document.documentElement.classList.remove('scroll-locked');
      }
    };
  }, [isLocked]);
}

export function forceUnlockAllScroll() {
  lockCount = 0;
  if (typeof document !== 'undefined') {
    document.body.classList.remove('scroll-locked');
    document.documentElement.classList.remove('scroll-locked');
  }
}
