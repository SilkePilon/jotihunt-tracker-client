import { create } from 'zustand';
import type { LatLng } from '@/lib/own-position';

/** The own position "Mijn locatie" last found, and when */
export interface LocatedFix extends LatLng {
  at: number;
}

interface FollowMeState {
  /** Phones: "Mijn locatie" keeps the map centred on the own position (FollowMe) until the user moves the map */
  following: boolean;
  start: () => void;
  stop: () => void;
  /** The last successful "Mijn locatie": the phone's "Hunt hier" tile stays a little while after following ends */
  located: LocatedFix | null;
  setLocated: (fix: LocatedFix) => void;
}

const useFollowMeStore = create<FollowMeState>()((set) => ({
  following: false,
  start: () => set({ following: true }),
  stop: () => set((state) => (state.following ? { following: false } : state)),
  located: null,
  setLocated: (located) => set({ located }),
}));

export default useFollowMeStore;
