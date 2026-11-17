import { useEffect } from 'react';
import { takeLaunchShortcut } from '@/lib/launch-shortcut';
import useMobileNavStore from '@/stores/mobile-nav.store';
import useSidebarStore from '@/stores/sidebar.store';

/**
 * Opens the section a PWA shortcut asked for (`?open=`, captured in main.tsx) once the sidebar is on screen: the phone
 * shell pushes its page over the menu (in place of a page restored from the last session), the laptop opens the section
 * and scrolls it into view.
 */
export function useLaunchShortcut(isMobile: boolean) {
  useEffect(() => {
    const section = takeLaunchShortcut();
    if (!section) return;
    if (isMobile) {
      const nav = useMobileNavStore.getState();
      nav.reset();
      nav.push({ id: section });
      return;
    }
    useSidebarStore.getState().setSectionOpen(section, true);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    requestAnimationFrame(() => document.querySelector(`[data-tour="sidebar.${section}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }));
    // Only the first mount: a later shell switch (rotating a tablet) must not open it again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
