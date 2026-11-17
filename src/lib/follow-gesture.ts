/**
 * Which camera events end "Mijn locatie" following (FollowMe.tsx). MapLibre only sets `originalEvent` on moves a user
 * started, never on our own easeTo/flyTo, so those never count.
 *
 * - dragstart / rotatestart / pitchstart: a drag or twist (touch, mouse, or Shift+arrows on the keyboard).
 * - movestart: only when the arrow keys pan the focused map. Every gesture fires a movestart, so a pinch, wheel,
 *   double-tap or the +/- keys (zooming, which keeps following like the ± tiles) must not count here.
 */
export const FOLLOW_GESTURE_EVENTS = ['dragstart', 'rotatestart', 'pitchstart', 'movestart'] as const;
export type FollowGestureEvent = (typeof FOLLOW_GESTURE_EVENTS)[number];

const PAN_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** The parts of a DOM event that decide it (duck-typed: works for Touch/Mouse/Wheel/KeyboardEvent alike) */
interface OriginalEvent {
  type?: string;
  key?: string;
  shiftKey?: boolean;
}

export function endsFollowing(type: FollowGestureEvent, originalEvent: unknown): boolean {
  if (!originalEvent || typeof originalEvent !== 'object') return false;
  if (type !== 'movestart') return true;
  const event = originalEvent as OriginalEvent;
  // Shift+arrows rotate/tilt (their rotatestart/pitchstart already counts); plain arrows pan
  return event.type === 'keydown' && !!event.key && PAN_KEYS.has(event.key) && !event.shiftKey;
}
