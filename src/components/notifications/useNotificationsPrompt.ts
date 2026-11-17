import { useEffect } from 'react';
import { useEdition } from '@/hooks/edition.hook';
import { useNotificationPrefs } from '@/hooks/notification-prefs.hook';
import { NOTIFICATIONS_PROMPT_VERSION } from '@/lib/notifications';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import usePromptQueueStore, { usePromptTurn } from '@/stores/prompt-queue.store';

/**
 * Open the "Meldingen" dialog once per NOTIFICATIONS_PROMPT_VERSION, when nothing else (e.g. the tour) is in the way.
 * The prompt queue spaces it from the other follow-up prompts (Android app, passkey): one at a time, after a short gap.
 */
export function useNotificationsPrompt(blocked: boolean) {
  const { prefs } = useNotificationPrefs();
  // Not while an archive is shown: saving (and marking it seen) is refused there, so it would come back every load
  const { readOnly } = useEdition();
  const due = !!prefs && prefs.promptedVersion < NOTIFICATIONS_PROMPT_VERSION && !readOnly;
  const turn = usePromptTurn('notifications', due && !blocked);

  useEffect(() => {
    if (turn) useNotificationsDialogStore.getState().setOpen(true);
  }, [turn]);

  // Closing the dialog (however it was opened) ends this prompt's turn
  useEffect(
    () =>
      useNotificationsDialogStore.subscribe((state, prev) => {
        if (prev.open && !state.open) usePromptQueueStore.getState().done('notifications');
      }),
    [],
  );
}
