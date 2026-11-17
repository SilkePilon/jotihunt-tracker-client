import { create } from 'zustand';

/**
 * Whether the main map is turned or tilted (lib/map-view.ts isRotated), kept by MapRotationTracker inside the map, so
 * the reset-north tile can show on desktop (control corner) and on phones (the dock above the sheet).
 */
const useMapRotationStore = create<{ rotated: boolean; setRotated: (rotated: boolean) => void }>()((set, get) => ({
  rotated: false,
  setRotated: (rotated) => {
    if (get().rotated !== rotated) set({ rotated });
  },
}));

export default useMapRotationStore;
