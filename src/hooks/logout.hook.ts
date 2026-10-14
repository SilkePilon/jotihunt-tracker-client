import useSignOut from 'react-auth-kit/hooks/useSignOut';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { useNavigate } from 'react-router';
import { useFetcher } from '@/hooks/utils/api.hook';
import { unsubscribePush } from '@/lib/push';
import { logoutSession } from '@/lib/auth-api';
import useAccountDialogStore from '@/stores/account-dialog.store';

/** Returns a logout function: drops this device's push subscription, ends the session, signs out and goes to the login page. */
export const useLogout = () => {
  const signOut = useSignOut();
  const navigate = useNavigate();
  const { fetch } = useFetcher();
  const authHeader = useAuthHeader();

  return async function logout() {
    await unsubscribePush(fetch);
    if (authHeader) await logoutSession(authHeader);
    signOut();
    // A global store: left open, the Account dialog would pop up again right after the next login
    useAccountDialogStore.getState().setOpen(false);
    navigate('/login');
  };
};
