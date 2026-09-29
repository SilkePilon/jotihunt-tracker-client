import { create } from 'zustand';
import type { CellKey } from '@/components/hints/HintGrid';

export type HintBoardView = 'overview' | 'detail' | null;

interface HintBoardState {
  /** Which hint dialog is open: the overview grid, the detail of one cell, or none */
  view: HintBoardView;
  /** Cell shown in the detail dialog */
  selected?: CellKey;
  /** Open the overview grid. */
  openBoard: () => void;
  /** Open the detail dialog of one cell (the overview closes). */
  openCell: (key: CellKey) => void;
  /** Go from the detail dialog back to the overview grid. */
  backToOverview: () => void;
  close: () => void;
}

/** Shared by the sidebar mini grid, the settings menu and the /hints redirect, which all open the same board. */
const useHintBoardStore = create<HintBoardState>()((set) => ({
  view: null,
  selected: undefined,
  openBoard: () => set({ view: 'overview', selected: undefined }),
  openCell: (selected) => set({ view: 'detail', selected }),
  backToOverview: () => set({ view: 'overview', selected: undefined }),
  close: () => set({ view: null, selected: undefined }),
}));

export default useHintBoardStore;
