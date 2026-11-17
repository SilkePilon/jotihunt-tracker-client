/**
 * Everything that stacks at the top centre of the map, laid out from measured heights so nothing overlaps: on phones the
 * offline badge (fixed under the safe area, one or two lines), the happy-hour pill below it, an admin's night-area
 * drawing toolbar below those status messages, and the toasts below all of them (8px gaps). Desktop keeps toasts at
 * the bottom right and the badge clear of the pill; only the drawing toolbar moves below the pill there.
 */

/** Measured heights in px; 0 when not shown. */
export interface TopStackHeights {
  /** The offline / stale-data badge */
  badge: number;
  /** The happy-hour pill */
  pill: number;
  /** The night-area drawing toolbar */
  toolbar: number;
}

export type TopStackItem = keyof TopStackHeights;

const GAP = 8;
/** Phones, below the top safe area: the badge's top (StaleDataBadge) */
export const BADGE_TOP = 8;
/** Phones: the pill's highest top, under the badge row and the corner buttons */
export const PILL_MIN_TOP = 40;
/** Phones: the drawing toolbar's highest top */
export const TOOLBAR_MIN_TOP = 12;
/** Phones: where toasts start with nothing above them (under a one-line badge) */
export const TOAST_MIN_TOP = 48;
/** Desktop: the pill's top (under the search / coordinates row) and the drawing toolbar's highest top */
export const DESKTOP_PILL_TOP = 52;
export const DESKTOP_TOOLBAR_MIN_TOP = 56;

export interface PhoneTopStack {
  pillTop: number;
  toolbarTop: number;
  toastTop: number;
}

/** Phones: each item's top in px below the top safe area. */
export function phoneTopStack({ badge, pill, toolbar }: TopStackHeights): PhoneTopStack {
  // The first free row below what is shown so far
  let next = badge ? BADGE_TOP + badge + GAP : 0;
  const pillTop = Math.max(PILL_MIN_TOP, next);
  if (pill) next = pillTop + pill + GAP;
  const toolbarTop = Math.max(TOOLBAR_MIN_TOP, next);
  if (toolbar) next = toolbarTop + toolbar + GAP;
  return { pillTop, toolbarTop, toastTop: Math.max(TOAST_MIN_TOP, next) };
}

/** Desktop: the drawing toolbar's top in px, below the pill while that is shown. */
export function desktopToolbarTop(pill: number): number {
  return pill ? Math.max(DESKTOP_TOOLBAR_MIN_TOP, DESKTOP_PILL_TOP + pill + GAP) : DESKTOP_TOOLBAR_MIN_TOP;
}

/** A top in px below the safe area, as CSS */
export function belowSafeArea(px: number): string {
  return `calc(env(safe-area-inset-top) + ${px}px)`;
}

/** Sonner offset for phones */
export function phoneToastOffset(heights: TopStackHeights): { top: string } {
  return { top: belowSafeArea(phoneTopStack(heights).toastTop) };
}
