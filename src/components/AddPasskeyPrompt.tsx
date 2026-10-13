import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { addPasskey, passkeysSupported } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { useAuth } from '@/hooks/auth.hook';
import type { User } from '@/types/User';

const TOAST_ID = 'add-passkey';
const DISMISSED_KEY = 'add-passkey-dismissed';

/** Users without a passkey (signed up or recovered on a browser without one) get one nudge per browser session. */
export default function AddPasskeyPrompt() {
  const user = useAuthUser<User>();
  const authHeader = useAuthHeader();
  const { updateUserState } = useAuth();
  // updateUserState is a new function every render; keep the effect from re-running on it
  const updateUserStateRef = useRef(updateUserState);
  useEffect(() => {
    updateUserStateRef.current = updateUserState;
  });
  const needsPasskey = !!user && (user.passkeyCount ?? 0) === 0;

  useEffect(() => {
    if (!needsPasskey || !authHeader || !passkeysSupported() || sessionStorage.getItem(DISMISSED_KEY)) return;
    toast('Voeg een passkey toe', {
      id: TOAST_ID,
      duration: Infinity,
      description: 'Dan log je voortaan in met je vingerafdruk of gezicht.',
      action: {
        label: 'Toevoegen',
        onClick: async () => {
          try {
            await updateUserStateRef.current(await addPasskey(authHeader));
            toast.success('Passkey toegevoegd');
          } catch (failure) {
            toast.error(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
          }
        },
      },
      onDismiss: () => sessionStorage.setItem(DISMISSED_KEY, '1'),
    });
  }, [needsPasskey, authHeader]);

  return null;
}
