import { useEffect, useRef, useMemo } from 'react';

/**
 * Returns a set of event handlers that trigger `prefetchFn` with appropriate
 * timing per input modality:
 *
 *   - onMouseEnter: 100ms debounce (filters out finger/cursor "drive-by"s
 *     during a fast scroll over multiple nav items).
 *   - onMouseLeave: cancels the pending hover prefetch.
 *   - onTouchStart: fires immediately — touching a tab is an explicit intent.
 *   - onFocus: fires immediately — keyboard navigation is also explicit intent.
 *
 * The timer is cleaned up on unmount to avoid stale prefetches after navigation.
 */
export function usePrefetchHandlers(prefetchFn: () => void) {
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    };
  }, []);

  return useMemo(
    () => ({
      onMouseEnter: () => {
        if (timer.current !== undefined) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          prefetchFn();
          timer.current = undefined;
        }, 100);
      },
      onMouseLeave: () => {
        if (timer.current !== undefined) {
          window.clearTimeout(timer.current);
          timer.current = undefined;
        }
      },
      onTouchStart: () => {
        prefetchFn();
      },
      onFocus: () => {
        prefetchFn();
      },
    }),
    [prefetchFn],
  );
}
