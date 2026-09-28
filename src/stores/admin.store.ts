import { create } from 'zustand';

export type AdminTab = 'hunters' | 'users';

interface AdminState {
  open: boolean;
  tab: AdminTab;
  openAdmin: (tab?: AdminTab) => void;
  setTab: (tab: AdminTab) => void;
  close: () => void;
}

/** The "Beheer" dialog (admins only), opened from the settings menu or the old /users link. */
const useAdminStore = create<AdminState>()((set) => ({
  open: false,
  tab: 'hunters',
  openAdmin: (tab = 'hunters') => set({ open: true, tab }),
  setTab: (tab) => set({ tab }),
  close: () => set({ open: false }),
}));

export default useAdminStore;
