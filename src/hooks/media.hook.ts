import { useSyncExternalStore } from 'react';

/**
 * Phones get the mobile shell (bottom sheet, docked popups): below Tailwind's md breakpoint, and also a phone held
 * sideways, which is wider than md but too low for the desktop layout (a touch screen under 500px high).
 */
export const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)';

function subscribe(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

/**
 * Whether the app shows the mobile shell (see {@link MOBILE_QUERY}).
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches);
}

/** A mouse or trackpad as the main pointer: a laptop, also in a narrow split-screen window that gets the mobile shell */
export const FINE_POINTER_QUERY = '(pointer: fine)';

function subscribeFinePointer(callback: () => void) {
  const media = window.matchMedia(FINE_POINTER_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

/** Whether the main pointer is fine (mouse, trackpad); see {@link FINE_POINTER_QUERY}. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribeFinePointer, () => window.matchMedia(FINE_POINTER_QUERY).matches);
}

/**
 * Whether the Intel window (and its header button) is offered: always outside the mobile shell, and inside it with a
 * fine pointer (a laptop window narrowed to phone width for split screen keeps it; phones use the Hints page).
 */
export function intelAvailable(mobile: boolean, finePointer: boolean): boolean {
  return !mobile || finePointer;
}

/** {@link intelAvailable} for this window, kept current */
export function useIntelAvailable(): boolean {
  return intelAvailable(useIsMobile(), useFinePointer());
}

/**
 * A phone held sideways (inside the mobile shell): the sheet becomes a left column instead of spanning the width.
 * Orientation and the layout viewport's height, not the visible height, so an open keyboard never switches it.
 * Mirrored by the `landscape-phone:` CSS variant (index.css).
 */
export const LANDSCAPE_PHONE_QUERY = '(orientation: landscape) and (max-height: 500px)';

function subscribeLandscape(callback: () => void) {
  const media = window.matchMedia(LANDSCAPE_PHONE_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

/** Whether the mobile shell is on a phone held sideways (see {@link LANDSCAPE_PHONE_QUERY}). */
export function useLandscapePhone(): boolean {
  const mobile = useIsMobile();
  const landscape = useSyncExternalStore(subscribeLandscape, () => window.matchMedia(LANDSCAPE_PHONE_QUERY).matches);
  return mobile && landscape;
}

/** The `data-shell` value on <html> for the CSS `shell-mobile:` variant (index.css). */
export function shellAttribute(mobile: boolean): 'mobile' | 'desktop' {
  return mobile ? 'mobile' : 'desktop';
}

/**
 * Keep `data-shell` on <html> in step with {@link useIsMobile}, so CSS can follow the shell instead of the width alone:
 * a landscape phone is wider than md (where `md:` classes switch to desktop positions) but uses the mobile shell. Call
 * once before the first render.
 */
export function syncShellAttribute(root: HTMLElement = document.documentElement): () => void {
  const media = window.matchMedia(MOBILE_QUERY);
  const apply = () => root.setAttribute('data-shell', shellAttribute(media.matches));
  apply();
  media.addEventListener('change', apply);
  return () => media.removeEventListener('change', apply);
}
