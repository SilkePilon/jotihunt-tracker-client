import { create } from 'zustand';
import type { LatLng } from '@/lib/own-position';

interface BrowserLocationState {
  /** "Mijn locatie" was tapped and found the browser's position: keep a dot there (BrowserLocationDot watches it) */
  active: boolean;
  /** The last browser fix, null before the first */
  position: LatLng | null;
  /** Start (or keep) the dot, optionally at a fix already in hand */
  start: (position?: LatLng) => void;
  setPosition: (position: LatLng) => void;
  stop: () => void;
}

/** Phones: the own-position dot from the browser's location, after a "Mijn locatie" tap without a live own tracker. */
const useBrowserLocationStore = create<BrowserLocationState>()((set) => ({
  active: false,
  position: null,
  start: (position) => set((state) => ({ active: true, position: position ?? state.position })),
  setPosition: (position) => set({ position }),
  stop: () => set({ active: false, position: null }),
}));

export default useBrowserLocationStore;
