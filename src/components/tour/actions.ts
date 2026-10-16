import useSidebarStore, { SheetSnap, SidebarSectionId } from '@/stores/sidebar.store';
import useSettingsMenuStore from '@/stores/settings-menu.store';
import useMobileNavStore from '@/stores/mobile-nav.store';
import { DEFAULT_VIEW } from '@/lib/map-view';
import { tourSelector } from './targets';
import type { TourAction } from './types';

/**
 * Everything the tour can do to the UI. Steps only use these, so when the layout changes
 * the fix is here, once. Each action returns an undo when it has something to revert.
 * Actions never change server data.
 */

/** Expand a sidebar section; the undo restores its previous open state. */
function openSection(id: SidebarSectionId): TourAction {
  return {
    name: `openSection(${id})`,
    run: () => {
      const store = useSidebarStore.getState();
      const wasOpen = store.openSections[id];
      store.setSectionOpen(id, true);
      return () => useSidebarStore.getState().setSectionOpen(id, wasOpen);
    },
  };
}

/**
 * Show a sidebar section: on desktop expand it, on the phone push its page (sheet goes full). The undo collapses
 * it again / pops the page.
 */
export function showSection(id: SidebarSectionId): TourAction {
  return {
    name: `showSection(${id})`,
    run: (ctx) => {
      if (!ctx.isMobile) return openSection(id).run(ctx);
      useMobileNavStore.getState().push({ id });
      return () => useMobileNavStore.getState().pop();
    },
  };
}

/** Phones: back to the menu (no-op on desktop). */
export function resetToMenu(): TourAction {
  return {
    name: 'resetToMenu',
    run: (ctx) => {
      if (ctx.isMobile) useMobileNavStore.getState().reset();
    },
  };
}

/**
 * Move the phone bottom sheet (no-op on desktop). No undo, so consecutive steps don't make it bounce;
 * the overlay restores the sheet when the tour ends.
 */
export function sheetSnap(snap: SheetSnap): TourAction {
  return {
    name: `sheetSnap(${snap})`,
    run: (ctx) => {
      if (ctx.isMobile) useSidebarStore.getState().setSheetSnap(snap);
    },
  };
}

/**
 * Scroll the sidebar back to the top, so the header (with the settings button) is on screen again after earlier
 * steps scrolled down to the lower sections. On the phone that is the sheet body (the menu starts with the header).
 */
export function scrollSidebarToTop(): TourAction {
  return {
    name: 'scrollSidebarToTop',
    run: () => {
      const sheetBody = document.querySelector('[data-sheet-body]');
      if (sheetBody) sheetBody.scrollTo({ top: 0 });
      else document.querySelector(tourSelector('sidebar.root'))?.parentElement?.scrollTo({ top: 0 });
    },
  };
}

export function openSettings(): TourAction {
  return {
    name: 'openSettings',
    run: () => {
      useSettingsMenuStore.getState().setOpen(true);
      return () => useSettingsMenuStore.getState().setOpen(false);
    },
  };
}

/** Fly the map to the whole play area. */
export function flyToOverview(): TourAction {
  return {
    name: 'flyToOverview',
    run: (ctx) => {
      ctx.mapRef.current?.flyTo({ center: [DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude], zoom: DEFAULT_VIEW.zoom, duration: 1500 });
    },
  };
}
