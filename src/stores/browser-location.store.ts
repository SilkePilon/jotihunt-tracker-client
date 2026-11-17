import { create } from 'zustand';
import type { LatLng } from '@/lib/own-position';

interface BrowserLocationState {
  /** "Mijn locatie" was tapped and found the browser's position: keep a dot there (BrowserLocationDot watches it) */
  active: boolean;
  /** The last browser fix, null before the first */
  position: LatLng | null;
  /** Accuracy radius of the last fix in metres, null when unknown */
  accuracy: number | null;
  /** The last fix came in while being watched; false after the page was hidden, until the next fix (the dot fades) */
  fresh: boolean;
  /** Start (or keep) the dot, optionally at a fix already in hand */
  start: (position?: LatLng, accuracy?: number) => void;
  setPosition: (position: LatLng, accuracy?: number) => void;
  /** No fixes for a while (page hidden): keep the dot, marked as old */
  markStale: () => void;
  stop: () => void;
}

/** Phones: the own-position dot from the browser's location, after a "Mijn locatie" tap without a live own tracker. */
const useBrowserLocationStore = create<BrowserLocationState>()((set) => ({
  active: false,
  position: null,
  accuracy: null,
  fresh: false,
  start: (position, accuracy) =>
    set((state) => (position ? { active: true, position, accuracy: accuracy ?? null, fresh: true } : { active: true, position: state.position, accuracy: state.accuracy, fresh: state.fresh })),
  setPosition: (position, accuracy) => set({ position, accuracy: accuracy ?? null, fresh: true }),
  markStale: () => set((state) => (state.fresh ? { fresh: false } : state)),
  stop: () => set({ active: false, position: null, accuracy: null, fresh: false }),
}));

export default useBrowserLocationStore;
