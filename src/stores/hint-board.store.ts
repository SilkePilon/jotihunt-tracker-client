import { create } from 'zustand';
import type { CellKey } from '@/components/hints/HintGrid';

interface HintBoardState {
  open: boolean;
  /** Cell shown in the answer panel */
  selected?: CellKey;
  /** Open the hint board, optionally with a cell preselected (e.g. from the sidebar mini grid). */
  openBoard: (selected?: CellKey) => void;
  setSelected: (selected?: CellKey) => void;
  close: () => void;
}

/** Shared by the sidebar mini grid, the settings menu and the /hints redirect, which all open the same board. */
const useHintBoardStore = create<HintBoardState>()((set) => ({
  open: false,
  selected: undefined,
  openBoard: (selected) => set({ open: true, selected }),
  setSelected: (selected) => set({ selected }),
  close: () => set({ open: false, selected: undefined }),
}));

export default useHintBoardStore;
