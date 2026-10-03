import { User } from '@/types/User';
import axios from 'axios';
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import { useFetcher } from './utils/api.hook';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';

/** Outcome of a login attempt; the server answers 429 after too many wrong passwords */
export type LoginResult = 'ok' | 'invalid' | 'rate-limited' | 'offline';

export const useAuth = () => {
  const baseUrl = import.meta.env.API_BASE_URL;

  const signIn = useSignIn();
  const { fetch } = useFetcher();
  const authHeader = useAuthHeader();

  /**
   * Tries to login with the given credentials.
   * Also signs in the user with the returned token.
   * @param email The email address to login with
   * @param password The password to login with
   * @returns 'ok' when signed in, otherwise why it failed
   */
  async function login(email: string, password: string): Promise<LoginResult> {
    const response = await axios
      .post(`${baseUrl}/auth/login`, {
        email,
        password,
      })
      .catch((error) => {
        // Undefined on network errors (no response)
        return error.response;
      });

    if (!response) return 'offline';
    if (response.status === 429) return 'rate-limited';
    if (response.status !== 200) return 'invalid';

    const token = response.data.accessToken;

    if (!token) {
      return 'invalid';
    }

    const userState = response.data.user as User;

    const signinResult = signIn({
      auth: {
        token,
        type: 'Bearer',
      },
      userState: userState,
    });

    return signinResult ? 'ok' : 'invalid';
  }

  async function updatePassword(oldPassword: string, newPassword: string) {
    try {
      const response = await fetch('/auth/update-password', 'POST', {
        oldPassword,
        newPassword,
        confirmPassword: newPassword,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async function updateUserState(user: User) {
    const token = authHeader ? authHeader.split(' ')[1] : '';
    signIn({
      auth: {
        token,
        type: 'Bearer',
      },
      userState: user,
    });
  }

  return {
    login,
    updatePassword,
    updateUserState,
  };
};
