import { create } from 'zustand';

interface FollowMeState {
  /** Phones: "Mijn locatie" keeps the map centred on the own position (FollowMe) until the user moves the map */
  following: boolean;
  start: () => void;
  stop: () => void;
}

const useFollowMeStore = create<FollowMeState>()((set) => ({
  following: false,
  start: () => set({ following: true }),
  stop: () => set((state) => (state.following ? { following: false } : state)),
}));

export default useFollowMeStore;
