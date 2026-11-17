import { useEffect, useRef, useState } from 'react';
import { focusRestoreTarget } from '@/lib/focus';

/**
 * For a popup/card without a focus trap: on unmount, focus goes back to whatever had it when the popup mounted (else
 * `fallback()`, e.g. the map canvas), but only when focus was lost with the popup.
 */
export function useRestoreFocus(fallback: () => HTMLElement | null | undefined) {
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null));
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  });
  useEffect(
    () => () => {
      focusRestoreTarget(document.activeElement, document.body, opener, fallbackRef.current())?.focus({ preventScroll: true });
    },
    [opener],
  );
}
