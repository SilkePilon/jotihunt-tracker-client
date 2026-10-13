import { create } from 'zustand';
import { advance, enqueue, INITIAL_DIRECTOR, type DirectorState, type HqEvent } from '@/lib/hq-director';

interface HqDirectorStore extends DirectorState {
  push: (events: HqEvent[]) => void;
  advance: () => void;
  reset: () => void;
}

/** The HQ camera director: what's on screen (event or tour stop) and what's queued. Not persisted. */
const useHqDirectorStore = create<HqDirectorStore>((set) => ({
  ...INITIAL_DIRECTOR,
  push: (events) => {
    if (events.length > 0) set((state) => enqueue(state, events));
  },
  advance: () => set((state) => advance(state)),
  reset: () => set(INITIAL_DIRECTOR),
}));

export default useHqDirectorStore;
