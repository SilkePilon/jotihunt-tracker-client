import { useEffect, useRef, useState } from 'react';
import { focusDropped } from '@/lib/focus';

/**
 * Whether a view that is (again) present should take focus: a view enabled on mount does, and so does any view that
 * comes back after it started leaving (AnimatePresence re-enters the leaving element when the user goes back quickly),
 * even the first view, which arrived with its dialog and was left alone then.
 */
export function viewFocusWanted(enabledOnMount: boolean, reentered: boolean): boolean {
  return enabledOnMount || reentered;
}

/**
 * For a pushed view (one view slides in, the other one leaves and goes inert): on mount, when the change dropped focus
 * (it sat in the leaving view, or on a button that collapsed), hand it to `target(root)` (the new view's title or Back
 * button, or the row that opened the view being left). `enabled` is read on mount: false for the first view, which
 * arrives with its dialog/page (that one places focus itself). `present` (useIsPresent): a view that left and is
 * brought back before its exit finished does the same on its return, enabled on mount or not. Returns the ref for the
 * view's root element.
 */
export function useViewFocus<T extends HTMLElement>(enabled: boolean, target: (root: T) => Element | null | undefined, present = true) {
  const ref = useRef<T>(null);
  const [enabledOnMount] = useState(enabled);
  // Set while the view is leaving: its next `present` is a re-entry
  const left = useRef(false);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });
  useEffect(() => {
    if (!present) {
      left.current = true;
      return;
    }
    const reentered = left.current;
    left.current = false;
    const root = ref.current;
    if (!viewFocusWanted(enabledOnMount, reentered) || !root || !focusDropped(document.activeElement, document.body)) return;
    const next = targetRef.current(root);
    if (next instanceof HTMLElement) next.focus({ preventScroll: true });
  }, [enabledOnMount, present]);
  return ref;
}
