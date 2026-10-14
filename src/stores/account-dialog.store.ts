import { create } from 'zustand';

interface AccountDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** The "Account" dialog (passkeys and logged-in devices), opened from the gear menu. */
const useAccountDialogStore = create<AccountDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export default useAccountDialogStore;
