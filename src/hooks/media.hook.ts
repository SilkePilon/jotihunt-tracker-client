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
