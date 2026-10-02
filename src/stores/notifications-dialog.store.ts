import { create } from 'zustand';

interface NotificationsDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** The "Meldingen" dialog: opened automatically once (see useNotificationsPrompt) and from Settings. */
const useNotificationsDialogStore = create<NotificationsDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export default useNotificationsDialogStore;
