import { useEffect, useLayoutEffect, useRef } from 'react';
import { createBackStack } from '@/lib/back-stack';

const backStack = typeof window === 'undefined' ? null : createBackStack(window.history, queueMicrotask);
if (backStack) window.addEventListener('popstate', () => backStack.onPopState());

/**
 * While `active`, the phone's Back button calls `close` (newest layer first). When the layer closes another way,
 * its history entry is removed again. Keys must be unique per layer ('sheet', 'page:1', 'popup').
 */
export function useBackEntry(key: string, active: boolean, close: () => void) {
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!active || !backStack) return;
    let closedByBack = false;
    backStack.open(key, () => {
      closedByBack = true;
      closeRef.current();
    });
    return () => {
      if (!closedByBack) backStack.closedByUi(key);
    };
  }, [key, active]);
}
