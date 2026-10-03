import useSignOut from 'react-auth-kit/hooks/useSignOut';
import { useNavigate } from 'react-router';
import { useFetcher } from '@/hooks/utils/api.hook';
import { unsubscribePush } from '@/lib/push';

/** Returns a logout function: drops this device's push subscription, signs out and goes to the login page. */
export const useLogout = () => {
  const signOut = useSignOut();
  const navigate = useNavigate();
  const { fetch } = useFetcher();

  return async function logout() {
    await unsubscribePush(fetch);
    signOut();
    navigate('/login');
  };
};
