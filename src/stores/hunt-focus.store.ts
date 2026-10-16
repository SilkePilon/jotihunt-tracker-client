import { create } from 'zustand';

export interface HuntFocus {
  /** Changes on every click, so clicking the same log line again replays the pulse */
  id: number;
  lng: number;
  lat: number;
  color: string;
}

interface HuntFocusStore {
  focus: HuntFocus | null;
  show: (focus: Omit<HuntFocus, 'id'>) => void;
  clear: (id: number) => void;
}

let nextId = 1;

/** The hunt a sync log line flew the map to: the map pulses a ring there for a moment. Not persisted. */
const useHuntFocusStore = create<HuntFocusStore>((set) => ({
  focus: null,
  show: (focus) => set({ focus: { ...focus, id: nextId++ } }),
  clear: (id) => set((state) => (state.focus?.id === id ? { focus: null } : state)),
}));

export default useHuntFocusStore;
