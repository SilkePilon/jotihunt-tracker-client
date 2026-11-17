import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { EASE_OUT } from '@/lib/motion';

/**
 * Fades for the map's floating popups and hover tooltips. They live in MapLibre's own DOM (a Popup or Marker element
 * with the position in its inline transform), so motion's exit animations can't reach them: they fade in with WAAPI
 * on the individual `scale` property (which composes with that transform), and on unmount a non-interactive copy is
 * left in place that fades away and drops itself, however the parent removed them (close, another marker, data gone).
 */

/** Popup enter/exit and tooltip enter (ms) */
export const POPUP_FADE_MS = 150;
/** The last tooltip lingers this long while it fades after the pointer left (ms) */
export const TOOLTIP_LINGER_MS = 120;

export interface FadeOptions {
  duration: number;
  /** Scale from/to 95% around the bottom centre (the anchor) as well */
  zoom?: boolean;
}

/** Keyframes for a fade in or out; reduced motion keeps only the opacity. */
export function fadeKeyframes(direction: 'in' | 'out', zoom: boolean, reduced: boolean): Keyframe[] {
  const shown: Keyframe = { opacity: 1 };
  const hidden: Keyframe = { opacity: 0 };
  if (zoom && !reduced) {
    Object.assign(shown, { scale: '1', transformOrigin: '50% 100%' });
    Object.assign(hidden, { scale: '0.95', transformOrigin: '50% 100%' });
  }
  return direction === 'in' ? [hidden, shown] : [shown, hidden];
}

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animate(element: HTMLElement, direction: 'in' | 'out', { duration, zoom = false }: FadeOptions): Animation | undefined {
  if (typeof element.animate !== 'function') return undefined;
  return element.animate(fadeKeyframes(direction, zoom, reducedMotion()), {
    duration,
    easing: `cubic-bezier(${EASE_OUT.join(',')})`,
    fill: direction === 'out' ? 'forwards' : 'none',
  });
}

/** Put `ghost` (a copy of the leaving element) non-interactive in `parent`; it fades out and removes itself. */
function leaveGhost(ghost: HTMLElement, parent: Element, options: FadeOptions) {
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.style.pointerEvents = 'none';
  // Not a second dialog, nor a second element with the (reused) title id
  for (const node of [ghost, ...ghost.querySelectorAll('[role], [id]')]) {
    node.removeAttribute('role');
    node.removeAttribute('id');
  }
  parent.appendChild(ghost);
  const remove = () => ghost.remove();
  const animation = animate(ghost, 'out', options);
  if (animation) animation.finished.then(remove, remove);
  else remove();
}

/**
 * Fade the MapLibre element around `content` (found with `selector`) in once it is on the map, and leave a fading
 * copy behind when the component unmounts. Mount the hook in the component that renders the Popup/Marker, so its
 * effects run after the Popup/Marker put its element on the map.
 * @param fallbackParent Where the copy goes when MapLibre already detached the element (a popup's closeOnClick)
 */
export function useMapElementFade(
  content: RefObject<HTMLElement | null>,
  selector: string,
  enter: FadeOptions,
  exit: FadeOptions,
  fallbackParent: () => Element | undefined,
) {
  useEffect(() => {
    const element = content.current?.closest<HTMLElement>(selector);
    if (element) animate(element, 'in', enter);
    // Only on mount: later renders (a live position) must not fade again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const node = content.current;
    return () => {
      // Runs before React removes the content, so the copy still has it
      const element = node?.closest<HTMLElement>(selector);
      if (!node || !element) return;
      const ghost = element.cloneNode(true) as HTMLElement;
      const parent = element.parentElement ?? fallbackParent();
      // StrictMode's simulated unmount keeps the content in the DOM; a real unmount has detached it by now
      queueMicrotask(() => {
        if (node.isConnected || !parent?.isConnected) return;
        leaveGhost(ghost, parent, exit);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
