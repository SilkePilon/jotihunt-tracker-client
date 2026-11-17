import { useCallback, useEffect, useRef, useState } from 'react';
import { focusRestoreTarget } from '@/lib/focus';

/**
 * For a popup/card without a focus trap: on unmount, focus goes back to whatever had it when the popup mounted (else
 * `fallback()`, e.g. the map canvas), but only when focus was lost with the popup. Returns a setter for a better
 * opener found later (the trigger of a menu that opened the popup and handed focus back to it while closing).
 */
export function useRestoreFocus(fallback: () => HTMLElement | null | undefined) {
  const [initialOpener] = useState(() => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null));
  const opener = useRef(initialOpener);
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  });
  useEffect(() => {
    const target = opener;
    return () => {
      focusRestoreTarget(document.activeElement, document.body, target.current, fallbackRef.current())?.focus({ preventScroll: true });
    };
  }, []);
  return useCallback((element: HTMLElement) => {
    opener.current = element;
  }, []);
}
