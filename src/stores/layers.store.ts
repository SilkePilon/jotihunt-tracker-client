import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface LayersState {
  showTeams: boolean;
  showDevices: boolean;
  showMarkersPart1: boolean;
  showMarkersPart2: boolean;
  showHomeCircle: boolean;
  showGroupCircles: boolean;
  showPredictions: boolean;
  showLife360: boolean;
  showBuildings3d: boolean;
  showMcDonalds: boolean;
  showKfc: boolean;
  showBurgerKing: boolean;
  toggleTeams: () => void;
  toggleDevices: () => void;
  toggleMarkersPart1: () => void;
  toggleMarkersPart2: () => void;
  toggleHomeCircle: () => void;
  toggleGroupCircles: () => void;
  togglePredictions: () => void;
  toggleLife360: () => void;
  toggleBuildings3d: () => void;
  toggleMcDonalds: () => void;
  toggleKfc: () => void;
  toggleBurgerKing: () => void;
}

/**
 * Persisted layer settings, version 0 to 1: the 3D buildings went from off to on by default, and everyone who loaded
 * the site before has `false` stored, so turn them on once. Later toggles are kept.
 */
export function migrateLayers(persisted: unknown, version: number): unknown {
  if (version >= 1) return persisted;
  return { ...(persisted as object | undefined), showBuildings3d: true };
}

const useLayersStore = create<LayersState>()(
  persist(
    (set) => ({
      showTeams: true,
      showDevices: true,
      showMarkersPart1: true,
      showMarkersPart2: true,
      showHomeCircle: true,
      showGroupCircles: false,
      showPredictions: true,
      showLife360: true,
      showBuildings3d: true,
      // Fastfood layers: off until someone wants food (persist's merge gives existing users these defaults)
      showMcDonalds: false,
      showKfc: false,
      showBurgerKing: false,
      toggleTeams: () => {
        set((state) => ({ showTeams: !state.showTeams }));
      },
      toggleDevices: () => {
        set((state) => ({ showDevices: !state.showDevices }));
      },
      toggleMarkersPart1: () => {
        set((state) => ({ showMarkersPart1: !state.showMarkersPart1 }));
      },
      toggleMarkersPart2: () => {
        set((state) => ({ showMarkersPart2: !state.showMarkersPart2 }));
      },
      toggleHomeCircle: () => {
        set((state) => ({ showHomeCircle: !state.showHomeCircle }));
      },
      toggleGroupCircles: () => {
        set((state) => ({ showGroupCircles: !state.showGroupCircles }));
      },
      togglePredictions: () => {
        set((state) => ({ showPredictions: !state.showPredictions }));
      },
      toggleLife360: () => {
        set((state) => ({ showLife360: !state.showLife360 }));
      },
      toggleBuildings3d: () => {
        set((state) => ({ showBuildings3d: !state.showBuildings3d }));
      },
      toggleMcDonalds: () => {
        set((state) => ({ showMcDonalds: !state.showMcDonalds }));
      },
      toggleKfc: () => {
        set((state) => ({ showKfc: !state.showKfc }));
      },
      toggleBurgerKing: () => {
        set((state) => ({ showBurgerKing: !state.showBurgerKing }));
      },
    }),
    {
      name: 'layers-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persisted, version) => migrateLayers(persisted, version) as LayersState,
    },
  ),
);

export default useLayersStore;
