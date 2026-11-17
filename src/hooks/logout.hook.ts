import useSignOut from 'react-auth-kit/hooks/useSignOut';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { useNavigate } from 'react-router';
import { useFetcher } from '@/hooks/utils/api.hook';
import { unsubscribePush } from '@/lib/push';
import { logoutSession } from '@/lib/auth-api';
import { clearSessionDrafts } from '@/lib/session-drafts';

/**
 * Returns a logout function: drops this device's push subscription, ends the session, forgets the drafts kept on this
 * device (clearSessionDrafts), signs out and goes to the login page.
 */
export const useLogout = () => {
  const signOut = useSignOut();
  const navigate = useNavigate();
  const { fetch } = useFetcher();
  const authHeader = useAuthHeader();

  return async function logout() {
    await unsubscribePush(fetch);
    if (authHeader) await logoutSession(authHeader);
    clearSessionDrafts();
    signOut();
    navigate('/login');
  };
};
