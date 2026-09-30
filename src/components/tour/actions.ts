import useSidebarStore, { SheetSnap, SidebarSectionId } from '@/stores/sidebar.store';
import useHintBoardStore from '@/stores/hint-board.store';
import useSettingsMenuStore from '@/stores/settings-menu.store';
import { DEFAULT_VIEW } from '@/lib/map-view';
import type { TourAction } from './types';

/**
 * Everything the tour can do to the UI. Steps only use these, so when the layout changes
 * the fix is here, once. Each action returns an undo when it has something to revert.
 * Actions never change server data.
 */

/** Expand a sidebar section; the undo restores its previous open state. */
export function openSection(id: SidebarSectionId): TourAction {
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

export function openHintBoard(): TourAction {
  return {
    name: 'openHintBoard',
    run: () => {
      useHintBoardStore.getState().openBoard();
      return () => useHintBoardStore.getState().close();
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
