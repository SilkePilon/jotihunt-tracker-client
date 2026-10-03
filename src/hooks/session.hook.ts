import { useNavigate } from 'react-router';
import useSignOut from 'react-auth-kit/hooks/useSignOut';

/**
 * Handler for a 401 from the API: drop the stored token and go to the login page.
 * Signing out matters: with the cookie still there, AuthOutlet would let the user back in and the 401 loop repeats.
 */
export function useSessionExpired() {
  const navigate = useNavigate();
  const signOut = useSignOut();
  return () => {
    signOut();
    navigate('/login');
  };
}
