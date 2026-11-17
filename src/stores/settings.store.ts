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
  soundMuted: boolean;
  /** Laptop single-key shortcuts ("i" Intel, "/" group search; Layout.tsx). Off for speech input and switch users (WCAG 2.1.4). */
  shortcutsEnabled: boolean;
  setMapStyle: (mapStyle: MapStyle) => void;
  setDarkMode: (darkMode?: boolean) => void;
  setSoundMuted: (soundMuted: boolean) => void;
  setShortcutsEnabled: (shortcutsEnabled: boolean) => void;
}

// Bumped when the shape/meaning of persisted fields changes in a
// backwards-incompatible way. v0 -> v1: mapStyle switched from
// `mapbox://styles/...` URLs to stable ids (streets/outdoors/satellite/dark)
// as part of the MapLibre migration. Old persisted URLs are discarded so the
// map falls back to the automatic (light/dark) default instead of breaking.
// v1 -> v2: the 'dark' style was removed (the automatic Material map already has a dark
// mode); a persisted 'dark' falls back to automatic the same way.
const SETTINGS_STORE_VERSION = 2;

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mapStyle: '' as MapStyle,
      darkMode: undefined,
      soundMuted: false,
      shortcutsEnabled: true,
      setMapStyle: (mapStyle: MapStyle) => {
        set({ mapStyle });
      },
      setDarkMode: (darkMode?: boolean) => {
        set({ darkMode });
      },
      setSoundMuted: (soundMuted: boolean) => {
        set({ soundMuted });
      },
      setShortcutsEnabled: (shortcutsEnabled: boolean) => {
        set({ shortcutsEnabled });
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
          soundMuted: state?.soundMuted ?? false,
          shortcutsEnabled: state?.shortcutsEnabled ?? true,
          // '' means "automatic", otherwise it must be a known MapStyle id.
          mapStyle: mapStyle === '' || isMapStyle(mapStyle) ? mapStyle : ('' as MapStyle),
        } as SettingsState;
      },
    },
  ),
);

export default useSettingsStore;
