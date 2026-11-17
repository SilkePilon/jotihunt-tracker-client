/**
 * Swipe right to go back on a pushed phone page (MobilePage): the pure decisions, so they can be tested without touch
 * events. "‹ Menu" stays the non-drag way back.
 */

/** Movement before the gesture picks an axis: smaller wobbles of a tap or a vertical scroll don't count */
export const SWIPE_LOCK_PX = 10;
/** Dragged this far (or this share of the page width, whichever is smaller) goes back on release */
export const SWIPE_DISTANCE_PX = 96;
export const SWIPE_DISTANCE_SHARE = 0.35;
/** A quick flick goes back from a shorter drag (px/ms) */
export const SWIPE_FLICK_VELOCITY = 0.5;
/** A flick still needs this much distance, so a jittery tap isn't one */
export const SWIPE_FLICK_MIN_PX = 32;
/** Touches starting this close to the left edge are the system's back gesture (Android, iOS): left to it */
export const SWIPE_EDGE_PX = 20;

export type SwipeAxis = 'pending' | 'horizontal' | 'vertical';

/**
 * Which way the finger is going: undecided until it moved {@link SWIPE_LOCK_PX}; horizontal only when clearly more
 * sideways than up/down (a diagonal scroll stays a scroll).
 */
export function swipeAxis(dx: number, dy: number): SwipeAxis {
  if (Math.hypot(dx, dy) < SWIPE_LOCK_PX) return 'pending';
  return Math.abs(dx) > Math.abs(dy) * 1.5 ? 'horizontal' : 'vertical';
}

/** How far the page follows the finger: only rightwards (left is not a gesture here). */
export function swipeOffset(dx: number): number {
  return Math.max(0, dx);
}

/** On release of a horizontal drag: go back (far enough, or a quick rightward flick) or spring back. */
export function swipeGoesBack(dx: number, velocityX: number, width: number): boolean {
  const distance = Math.min(SWIPE_DISTANCE_PX, width * SWIPE_DISTANCE_SHARE);
  if (dx >= distance) return true;
  return dx >= SWIPE_FLICK_MIN_PX && velocityX >= SWIPE_FLICK_VELOCITY;
}

/** Elements a horizontal drag belongs to: typing, sliders, pickers, charts and maps (canvas). */
const OWN_GESTURE_SELECTOR = 'input, textarea, select, [contenteditable="true"], [role="slider"], canvas, .maplibregl-map, [data-no-swipe-back]';

/**
 * The drag starts on something that uses horizontal movement itself (a field, a slider, horizontally scrollable
 * content up to `root`): leave the gesture to it.
 */
export function startsInOwnGesture(target: EventTarget | null, root: Element): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(OWN_GESTURE_SELECTOR)) return true;
  for (let element: Element | null = target; element && element !== root; element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth + 1) {
      const overflowX = getComputedStyle(element).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
  }
  return false;
}
