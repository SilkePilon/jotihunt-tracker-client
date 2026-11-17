import { useEffect, useRef, useState } from 'react';
import { focusDropped } from '@/lib/focus';

/**
 * For a pushed view (one view slides in, the other one leaves and goes inert): on mount, when the change dropped focus
 * (it sat in the leaving view, or on a button that collapsed), hand it to `target(root)` (the new view's title or Back
 * button, or the row that opened the view being left). `enabled` is read on mount: false for the first view, which
 * arrives with its dialog/page (that one places focus itself). Returns the ref for the view's root element.
 */
export function useViewFocus<T extends HTMLElement>(enabled: boolean, target: (root: T) => Element | null | undefined) {
  const ref = useRef<T>(null);
  const [active] = useState(enabled);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });
  useEffect(() => {
    const root = ref.current;
    if (!active || !root || !focusDropped(document.activeElement, document.body)) return;
    const next = targetRef.current(root);
    if (next instanceof HTMLElement) next.focus({ preventScroll: true });
  }, [active]);
  return ref;
}
