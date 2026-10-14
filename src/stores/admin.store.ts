import { create } from 'zustand';

/** The Beheer window's sections. */
export type AdminDialogId = 'algemeen' | 'users' | 'invites' | 'hunters' | 'broadcast' | 'koppelingen';

interface AdminState {
  /** Which Beheer section is open (the Beheer window shows while this is set), or null */
  dialog: AdminDialogId | null;
  openDialog: (dialog: AdminDialogId) => void;
  close: () => void;
}

const useAdminStore = create<AdminState>()((set) => ({
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));

export default useAdminStore;
