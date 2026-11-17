import { create } from 'zustand';
import { isPromptSnoozed, snoozePrompt } from '@/lib/notifications-prompt';

interface NotificationsDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** "Later" was tapped this session: the dialog doesn't open by itself again until the next one */
  snoozed: boolean;
  snooze: () => void;
}

/** The "Meldingen" dialog: opened automatically (see useNotificationsPrompt) and from Settings. */
const useNotificationsDialogStore = create<NotificationsDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  snoozed: isPromptSnoozed(),
  snooze: () => {
    snoozePrompt();
    set({ snoozed: true });
  },
}));

export default useNotificationsDialogStore;
