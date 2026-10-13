import useSignIn from 'react-auth-kit/hooks/useSignIn';
import type { SessionResult } from '@/lib/auth-api';

/** Store a fresh session (login, signup, herstel) in react-auth-kit. */
export function useStartSession() {
  const signIn = useSignIn();
  return (result: SessionResult) => signIn({ auth: { token: result.token, type: 'Bearer' }, userState: result.user });
}
