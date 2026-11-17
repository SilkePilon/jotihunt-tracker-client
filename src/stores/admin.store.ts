import { create } from 'zustand';

/** The Beheer window's sections. */
export type AdminDialogId = 'algemeen' | 'ai' | 'users' | 'invites' | 'hunters' | 'broadcast' | 'koppelingen';

interface AdminState {
  /** Which Beheer section is open (the Beheer window shows while this is set), or null */
  dialog: AdminDialogId | null;
  /** Opens a section; switching away from one with unsaved changes asks first (see `guardLeave`) */
  openDialog: (dialog: AdminDialogId) => void;
  /** Closes right away, also with unsaved changes (logout, unmount, "Toon op kaart") */
  close: () => void;
  /** Close from the user (close button, Esc, outside tap, Back): asks first while there are unsaved changes */
  requestClose: () => void;
  /** Algemeen has unsaved changes */
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** A close / section switch waiting on "Wijzigingen weggooien?" */
  pendingLeave: (() => void) | null;
  /** Runs `leave` now, or once the user agreed to throw away the unsaved changes */
  guardLeave: (leave: () => void) => void;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

const useAdminStore = create<AdminState>()((set, get) => ({
  dialog: null,
  openDialog: (dialog) => {
    const current = get().dialog;
    if (current && current !== dialog) get().guardLeave(() => set({ dialog }));
    else set({ dialog });
  },
  close: () => set({ dialog: null, pendingLeave: null }),
  requestClose: () => get().guardLeave(() => set({ dialog: null })),
  dirty: false,
  setDirty: (dirty) => set({ dirty }),
  pendingLeave: null,
  guardLeave: (leave) => {
    if (get().dirty) set({ pendingLeave: leave });
    else leave();
  },
  confirmLeave: () => {
    const leave = get().pendingLeave;
    set({ pendingLeave: null, dirty: false });
    leave?.();
  },
  cancelLeave: () => set({ pendingLeave: null }),
}));

export default useAdminStore;
