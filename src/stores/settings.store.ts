// store settings, such as map style
// map style is defined by an enum
// eventually represented as a url

import { MapStyle } from '@/types/MapStyle';
import { isMapStyle } from '@/lib/map-styles';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  mapStyle: MapStyle;
  darkMode?: boolean;
  setMapStyle: (mapStyle: MapStyle) => void;
  setDarkMode: (darkMode?: boolean) => void;
}

// Bumped when the shape/meaning of persisted fields changes in a
// backwards-incompatible way. v0 -> v1: mapStyle switched from
// `mapbox://styles/...` URLs to stable ids (streets/outdoors/satellite/dark)
// as part of the MapLibre migration. Old persisted URLs are discarded so the
// map falls back to the automatic (light/dark) default instead of breaking.
const SETTINGS_STORE_VERSION = 1;

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mapStyle: '' as MapStyle,
      darkMode: undefined,
      setMapStyle: (mapStyle: MapStyle) => {
        set({ mapStyle });
      },
      setDarkMode: (darkMode?: boolean) => {
        set({ darkMode });
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => localStorage),
      version: SETTINGS_STORE_VERSION,
      migrate: (persistedState) => {
        const state = persistedState as (Omit<Partial<SettingsState>, 'mapStyle'> & { mapStyle?: unknown }) | undefined;
        const mapStyle = state?.mapStyle;
        return {
          ...state,
          // '' means "automatic", otherwise it must be a known MapStyle id.
          mapStyle: mapStyle === '' || isMapStyle(mapStyle) ? mapStyle : ('' as MapStyle),
        } as SettingsState;
      },
    },
  ),
);

export default useSettingsStore;
