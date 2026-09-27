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
  toggleTeams: () => void;
  toggleDevices: () => void;
  toggleMarkersPart1: () => void;
  toggleMarkersPart2: () => void;
  toggleHomeCircle: () => void;
  toggleGroupCircles: () => void;
  togglePredictions: () => void;
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
    }),
    {
      name: 'layers-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useLayersStore;
