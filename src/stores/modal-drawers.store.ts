import { create } from 'zustand';

interface ModalDrawersState {
  /** How many ResponsiveDialog drawers (phone) are open right now */
  openCount: number;
  /** The sidebar sheet is mounting; drawers wait with sliding in until it's done, so they end up on top of it */
  sheetMounting: boolean;
  opened: () => void;
  closed: () => void;
  setSheetMounting: (mounting: boolean) => void;
}

/**
 * Keeps the phone's sidebar sheet below the ResponsiveDialog drawers.
 *
 * vaul doesn't pass `modal={false}` on to Radix, so the always-open sheet is a modal Radix layer too, and Radix stacks
 * layers in mount order. A sheet mounting while a drawer is open (e.g. /users opens Beheer, then navigates to the map)
 * lands on top: the drawer gets `pointer-events: none` and `aria-hidden`, and nothing in it can be tapped. So the sheet
 * waits until no drawer is open, and a drawer opening while the sheet is mounting waits for the sheet.
 */
const useModalDrawersStore = create<ModalDrawersState>()((set) => ({
  openCount: 0,
  sheetMounting: false,
  opened: () => set((state) => ({ openCount: state.openCount + 1 })),
  closed: () => set((state) => ({ openCount: Math.max(0, state.openCount - 1) })),
  setSheetMounting: (sheetMounting) => set({ sheetMounting }),
}));

export default useModalDrawersStore;
