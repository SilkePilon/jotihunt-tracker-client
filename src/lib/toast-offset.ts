/**
 * Where phone toasts start (top-center). Below the notch and the offline badge (8px under the safe area, up to two
 * lines); while the happy-hour pill is shown, below the pill too, so a toast never covers its countdown.
 */

/** The pill's top below the safe area; App.tsx positions it with top-[calc(env(safe-area-inset-top)+40px)] */
export const HAPPY_HOUR_PILL_TOP = 40;
/** The pill's height: 18px glyph / 13px text line + 2 × 6px padding, rounded up */
export const HAPPY_HOUR_PILL_HEIGHT = 32;
const GAP = 8;
/** Under the offline badge only */
const DEFAULT_TOP = 48;

/** Pixels below the top safe area */
export function phoneToastTop(pillVisible: boolean): number {
  return pillVisible ? HAPPY_HOUR_PILL_TOP + HAPPY_HOUR_PILL_HEIGHT + GAP : DEFAULT_TOP;
}

/** Sonner offset for phones */
export function phoneToastOffset(pillVisible: boolean): { top: string } {
  return { top: `calc(env(safe-area-inset-top) + ${phoneToastTop(pillVisible)}px)` };
}
