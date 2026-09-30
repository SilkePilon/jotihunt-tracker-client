import { create } from 'zustand';

interface SettingsMenuState {
  /** Whether the settings dropdown (sidebar header cog) is open; controlled so the tour can open it */
  open: boolean;
  setOpen: (open: boolean) => void;
}

const useSettingsMenuStore = create<SettingsMenuState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export default useSettingsMenuStore;
