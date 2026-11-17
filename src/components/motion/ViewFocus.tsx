import type { ReactNode } from 'react';
import { useIsPresent } from 'motion/react';
import { useViewFocus } from '@/hooks/view-focus.hook';

interface ViewFocusProps {
  /**
   * Read on mount: false for the first view (it arrives with its sheet/dialog and leaves focus alone). A view brought
   * back while it was leaving takes focus on its return either way.
   */
  enabled: boolean;
  /** Where focus goes when this view arrives and the change dropped it (the Back button, or the row that opened the view being left) */
  target: (root: HTMLDivElement) => Element | null | undefined;
  children: ReactNode;
}

/**
 * Inside a pushed view (a direct child of AnimatePresence's child): makes the view inert while it leaves, so focus and
 * taps can't stay in it during its exit, and hands focus to `target` when the view arrives. `display: contents`, so it
 * adds no box to the view's layout.
 */
export default function ViewFocus({ enabled, target, children }: ViewFocusProps) {
  const isPresent = useIsPresent();
  const ref = useViewFocus<HTMLDivElement>(enabled, target, isPresent);
  return (
    <div ref={ref} inert={!isPresent} className="contents">
      {children}
    </div>
  );
}
