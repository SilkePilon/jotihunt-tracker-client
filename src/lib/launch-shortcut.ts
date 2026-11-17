import type { SidebarSectionId } from '@/stores/sidebar.store';

/**
 * PWA manifest shortcuts (vite.config.ts) open the app at `/?open=<section>`: the phone shell pushes that page, the
 * laptop opens the section. The parameter is read and removed from the URL once, before the app renders, so a reload
 * or a shared link doesn't open it again.
 */
export const LAUNCH_PARAM = 'open';

/** The sections a shortcut may open */
const SHORTCUT_SECTIONS = ['hintEntry', 'foxes'] as const satisfies readonly SidebarSectionId[];
export type ShortcutSection = (typeof SHORTCUT_SECTIONS)[number];

/** The section `?open=` asks for; null without it or for anything that is not a shortcut section. */
export function parseLaunchShortcut(search: string): ShortcutSection | null {
  const value = new URLSearchParams(search).get(LAUNCH_PARAM);
  return (SHORTCUT_SECTIONS as readonly string[]).includes(value ?? '') ? (value as ShortcutSection) : null;
}

/** The URL (path, other parameters and hash) without `?open=`; null when it has none, so nothing needs replacing. */
export function withoutLaunchParam(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has(LAUNCH_PARAM)) return null;
  url.searchParams.delete(LAUNCH_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

let pending: ShortcutSection | null = null;

/** Reads `?open=` at startup (main.tsx) and takes it out of the address bar, keeping the history entry's state. */
export function captureLaunchShortcut(location: Pick<Location, 'href' | 'search'> = window.location, history: Pick<History, 'state' | 'replaceState'> = window.history) {
  pending = parseLaunchShortcut(location.search);
  const cleaned = withoutLaunchParam(location.href);
  if (cleaned !== null) history.replaceState(history.state, '', cleaned);
}

/** The shortcut captured at startup, once (the next call gets null). */
export function takeLaunchShortcut(): ShortcutSection | null {
  const section = pending;
  pending = null;
  return section;
}
