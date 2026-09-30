import { useEffect, useState } from 'react';
import type { Rect } from './placement';
import { tourSelector, type TourTargetId } from './targets';

const FIND_TIMEOUT_MS = 1500;
const RESCROLL_INTERVAL_MS = 300;

type Status = 'pending' | 'found' | 'missing' | 'none';

function sameRect(a: Rect | null, b: Rect) {
  return !!a && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Find the element for a tour target and follow its position every frame (sections expand, the sheet slides,
 * the window resizes). Waits up to 1.5s for the element to appear; then reports 'missing'.
 * `enabled` is false until the step's actions have run; `resetKey` restarts the search for a new step.
 */
export function useTargetRect(id: TourTargetId | null, enabled: boolean, resetKey: unknown) {
  const [state, setState] = useState<{ status: Status; rect: Rect | null; key: unknown }>({ status: 'pending', rect: null, key: resetKey });

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when a new step starts
      setState({ status: 'pending', rect: null, key: resetKey });
      return;
    }
    if (id === null) {
      setState({ status: 'none', rect: null, key: resetKey });
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    let element: Element | null = null;
    let everFound = false;
    let lastScrollAt = -Infinity;

    function tick() {
      // React may have replaced the node; a detached one measures as zeros, so look it up again
      if (element && !element.isConnected) element = null;
      if (!element) {
        element = document.querySelector(tourSelector(id!));
        if (element) {
          everFound = true;
          element.scrollIntoView({ block: 'nearest' });
        } else if (!everFound && performance.now() - startedAt > FIND_TIMEOUT_MS) {
          console.warn(`[tour] target not found: ${id}`);
          setState({ status: 'missing', rect: null, key: resetKey });
          return;
        }
      }
      if (element) {
        const { x, y, width, height } = element.getBoundingClientRect();
        const rect = { x, y, width, height };
        // The sheet is still animating (overflow-hidden) when the first scroll runs, so keep nudging the target into view until it fits.
        const outside = y < 0 || y + height > window.innerHeight || x < 0 || x + width > window.innerWidth;
        const fits = height <= window.innerHeight && width <= window.innerWidth;
        const now = performance.now();
        if (outside && fits && now - lastScrollAt >= RESCROLL_INTERVAL_MS) {
          lastScrollAt = now;
          element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        setState((prev) =>
          prev.status === 'found' && prev.key === resetKey && sameRect(prev.rect, rect) ? prev : { status: 'found', rect, key: resetKey },
        );
      }
      frame = requestAnimationFrame(tick);
    }

    setState({ status: 'pending', rect: null, key: resetKey });
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [id, enabled, resetKey]);

  return state;
}
