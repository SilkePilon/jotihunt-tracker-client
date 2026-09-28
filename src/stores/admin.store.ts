import { create } from 'zustand';

export type AdminDialogId = 'hunters' | 'users';

interface AdminState {
  /** Which admin dialog is open (Settings → Admin tools), or null */
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
