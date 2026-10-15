import { create } from 'zustand';
import { type MobilePage, popPage, pushPage, replacePage } from '@/lib/mobile-nav';
import useSidebarStore from './sidebar.store';

interface MobileNavState {
  /** Pages above the menu; empty = menu */
  stack: MobilePage[];
  /** 1 = forward (push), -1 = back; drives PANE_SLIDE */
  direction: 1 | -1;
  push: (page: MobilePage) => void;
  pop: () => void;
  replace: (page: MobilePage) => void;
  reset: () => void;
}

const useMobileNavStore = create<MobileNavState>()((set) => ({
  stack: [],
  direction: 1,
  push: (page) => {
    set((state) => ({ stack: pushPage(state.stack, page), direction: 1 }));
    const sidebar = useSidebarStore.getState();
    // The page renders its section, so it must be open
    sidebar.setSectionOpen(page.id, true);
    // A page gets the whole sheet; going back keeps the height the user chose
    sidebar.setSheetSnap('full');
  },
  pop: () => set((state) => ({ stack: popPage(state.stack), direction: -1 })),
  replace: (page) => set((state) => ({ stack: replacePage(state.stack, page), direction: 1 })),
  reset: () => set({ stack: [], direction: -1 }),
}));

export default useMobileNavStore;
