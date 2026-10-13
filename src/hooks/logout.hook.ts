import useSignOut from 'react-auth-kit/hooks/useSignOut';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { useNavigate } from 'react-router';
import { useFetcher } from '@/hooks/utils/api.hook';
import { unsubscribePush } from '@/lib/push';
import { logoutSession } from '@/lib/auth-api';

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
    navigate('/login');
  };
};
