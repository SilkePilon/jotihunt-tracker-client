import { create } from 'zustand';
import { type MobilePage, popPage, pushPage, replacePage } from '@/lib/mobile-nav';
import type { SheetSnap } from '@/lib/sheet-snaps';
import useSidebarStore from './sidebar.store';

interface MobileNavState {
  /** Pages above the menu; empty = menu */
  stack: MobilePage[];
  /** 1 = forward (push), -1 = back; drives PANE_SLIDE */
  direction: 1 | -1;
  /** Open a page; the sheet rises to `snap` (default the whole sheet) */
  push: (page: MobilePage, snap?: SheetSnap) => void;
  pop: () => void;
  replace: (page: MobilePage) => void;
  reset: () => void;
}

const useMobileNavStore = create<MobileNavState>()((set) => ({
  stack: [],
  direction: 1,
  push: (page, snap = 'full') => {
    set((state) => ({ stack: pushPage(state.stack, page), direction: 1 }));
    const sidebar = useSidebarStore.getState();
    // The page renders its section, so it must be open
    sidebar.setSectionOpen(page.id, true);
    // A page gets the whole sheet (or e.g. half, to keep a map point in view); going back keeps the height the user chose
    sidebar.setSheetSnap(snap);
  },
  pop: () => set((state) => ({ stack: popPage(state.stack), direction: -1 })),
  replace: (page) => set((state) => ({ stack: replacePage(state.stack, page), direction: 1 })),
  reset: () => set({ stack: [], direction: -1 }),
}));

export default useMobileNavStore;
