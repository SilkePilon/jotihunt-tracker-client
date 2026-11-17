import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { addPasskey, passkeysSupported } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { readSessionFlag, writeSessionFlag } from '@/lib/session-flag';
import { useAuth } from '@/hooks/auth.hook';
import usePromptQueueStore, { usePromptTurn } from '@/stores/prompt-queue.store';
import type { User } from '@/types/User';

const TOAST_ID = 'add-passkey';
const DISMISSED_KEY = 'add-passkey-dismissed';

/**
 * Users without a passkey (signed up or recovered on a browser without one) get one nudge per browser session, on its
 * turn in the prompt queue (after the tour and the other follow-up prompts, one at a time).
 */
export default function AddPasskeyPrompt() {
  const user = useAuthUser<User>();
  const authHeader = useAuthHeader();
  const { updateUserState } = useAuth();
  // updateUserState is a new function every render; keep the effect from re-running on it
  const updateUserStateRef = useRef(updateUserState);
  // The toast's action reads the current header, so a changed header doesn't take the toast down and back up
  const authHeaderRef = useRef(authHeader);
  useEffect(() => {
    updateUserStateRef.current = updateUserState;
    authHeaderRef.current = authHeader;
  });
  const needsPasskey = !!user && (user.passkeyCount ?? 0) === 0;
  const due = needsPasskey && !!authHeader && passkeysSupported() && !readSessionFlag(DISMISSED_KEY);
  const turn = usePromptTurn('passkey', due);
  const show = turn && due;

  useEffect(() => {
    if (!show) return;
    // Set once the toast goes away because the prompt no longer applies (logout, a passkey added elsewhere), not by the user
    let withdrawn = false;
    const finished = () => usePromptQueueStore.getState().done('passkey');
    toast('Voeg een passkey toe', {
      id: TOAST_ID,
      duration: Infinity,
      description: 'Dan log je voortaan in met je vingerafdruk of gezicht.',
      action: {
        label: 'Toevoegen',
        onClick: async () => {
          // The action closes the toast without onDismiss
          finished();
          try {
            await updateUserStateRef.current(await addPasskey(authHeaderRef.current ?? ''));
            toast.success('Passkey toegevoegd');
          } catch (failure) {
            toast.error(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
          }
        },
      },
      onDismiss: () => {
        if (!withdrawn) writeSessionFlag(DISMISSED_KEY);
        finished();
      },
    });
    // No longer due or unmounted (logout): take the toast away and free the turn, without counting it as "later"
    return () => {
      withdrawn = true;
      toast.dismiss(TOAST_ID);
      finished();
    };
  }, [show]);

  return null;
}
