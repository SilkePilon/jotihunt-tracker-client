import { User } from '@/types/User';
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';

export const useAuth = () => {
  const signIn = useSignIn();
  const authHeader = useAuthHeader();

  /** Replace the stored user (same token), e.g. after the tour or adding a passkey */
  async function updateUserState(user: User) {
    const token = authHeader ? authHeader.split(' ')[1] : '';
    signIn({ auth: { token, type: 'Bearer' }, userState: user });
  }

  return { updateUserState };
};
