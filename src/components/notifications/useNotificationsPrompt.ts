import { useEffect } from 'react';
import { useEdition } from '@/hooks/edition.hook';
import { useNotificationPrefs } from '@/hooks/notification-prefs.hook';
import { NOTIFICATIONS_PROMPT_VERSION } from '@/lib/notifications';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';

const PROMPT_DELAY_MS = 1500;

/** Open the "Meldingen" dialog once per NOTIFICATIONS_PROMPT_VERSION, when nothing else (e.g. the tour) is in the way. */
export function useNotificationsPrompt(blocked: boolean) {
  const { prefs } = useNotificationPrefs();
  const setOpen = useNotificationsDialogStore((state) => state.setOpen);
  // Not while an archive is shown: saving (and marking it seen) is refused there, so it would come back every load
  const { readOnly } = useEdition();
  const due = !!prefs && prefs.promptedVersion < NOTIFICATIONS_PROMPT_VERSION && !readOnly;

  useEffect(() => {
    if (!due || blocked) return;
    const timeout = setTimeout(() => setOpen(true), PROMPT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [due, blocked, setOpen]);
}
