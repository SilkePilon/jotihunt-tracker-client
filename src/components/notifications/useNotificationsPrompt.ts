import { useEffect } from 'react';
import { useEdition } from '@/hooks/edition.hook';
import { useNotificationPrefs } from '@/hooks/notification-prefs.hook';
import { notificationsPromptDue, readDevicePromptedVersion } from '@/lib/notifications-prompt';
import { currentDevicePush } from '@/lib/push';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import usePromptQueueStore, { usePromptTurn } from '@/stores/prompt-queue.store';

/**
 * Open the "Meldingen" dialog once per NOTIFICATIONS_PROMPT_VERSION, and once on each device where push is still off
 * (see notificationsPromptDue), when nothing else (e.g. the tour) is in the way. "Later" waits for the next session.
 * The prompt queue spaces it from the other follow-up prompts (Android app, passkey): one at a time, after a short gap.
 */
export function useNotificationsPrompt(blocked: boolean) {
  const { prefs } = useNotificationPrefs();
  const snoozed = useNotificationsDialogStore((state) => state.snoozed);
  // Not while an archive is shown: saving (and marking it seen) is refused there, so it would come back every load
  const { readOnly } = useEdition();
  const due =
    !!prefs &&
    !readOnly &&
    notificationsPromptDue({ serverVersion: prefs.promptedVersion, deviceVersion: readDevicePromptedVersion(), snoozed, push: currentDevicePush() });
  const turn = usePromptTurn('notifications', due && !blocked);

  // Unmounted while on screen (logout, a 401): close the dialog too, so it doesn't reopen in the next session. The turn
  // itself is released by usePromptTurn.
  useEffect(() => {
    if (!turn) return;
    useNotificationsDialogStore.getState().setOpen(true);
    return () => useNotificationsDialogStore.getState().setOpen(false);
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
