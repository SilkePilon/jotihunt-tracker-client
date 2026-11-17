import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface HiddenAreasState {
  hiddenAreas: string[];
  /** The edition (year) the hidden areas belong to; undefined until the first edition is known */
  year?: number;
  toggleHidden: (areaName: string) => void;
  /** Another edition is shown: its foxes start visible again (the old picks belonged to last year's hunt) */
  syncEdition: (year: number) => void;
}

const useHiddenAreasStore = create<HiddenAreasState>()(
  persist(
    (set) => ({
      hiddenAreas: [],
      toggleHidden: (areaName: string) => {
        areaName = areaName.toLowerCase();
        set((state) => ({
          hiddenAreas: state.hiddenAreas.includes(areaName) ? state.hiddenAreas.filter((area) => area !== areaName) : [...state.hiddenAreas, areaName],
        }));
      },
      syncEdition: (year) =>
        set((state) => {
          if (state.year === year) return state;
          // A first known year adopts the areas hidden so far (stored before the year was kept); a different one clears them
          return { year, hiddenAreas: state.year === undefined ? state.hiddenAreas : [] };
        }),
    }),
    {
      name: 'hidden-areas-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useHiddenAreasStore;
