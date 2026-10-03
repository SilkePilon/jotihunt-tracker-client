import { User } from '@/types/User';
import axios from 'axios';
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { useFetcher } from './utils/api.hook';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { REQUEST_TIMEOUT_MS } from '@/lib/http';
import { loginFailure, passwordUpdateFailure, type LoginResult, type PasswordUpdateResult } from '@/lib/auth-result';
import { markTokenReplaced } from '@/lib/session';

export type { LoginResult, PasswordUpdateResult };

export const useAuth = () => {
  const baseUrl = import.meta.env.API_BASE_URL;

  const signIn = useSignIn();
  const { fetch } = useFetcher();
  const authHeader = useAuthHeader();
  const authUser = useAuthUser<User>();

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
      }, { timeout: REQUEST_TIMEOUT_MS })
      .catch((error) => {
        // Undefined on network errors (no response)
        return error.response;
      });

    // 5xx, timeouts and network errors are 'offline': the password may well be right
    if (response?.status !== 200) return loginFailure(response?.status);

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

  /**
   * Change the own password. The server signs out every session, this one included, and returns a fresh token:
   * sign in with it (the user state no longer requires a password change).
   * @returns 'ok', 'wrong-password' (400/401) or 'failed' (server trouble, rate limit, no connection)
   */
  async function updatePassword(oldPassword: string, newPassword: string): Promise<PasswordUpdateResult> {
    let response;
    try {
      response = await fetch<{ accessToken?: string }>('/auth/update-password', 'POST', {
        oldPassword,
        newPassword,
        confirmPassword: newPassword,
      });
    } catch (error) {
      return passwordUpdateFailure(axios.isAxiosError(error) ? error.response?.status : undefined);
    }
    if (response.status !== 200) return passwordUpdateFailure(response.status);

    const userState = authUser ? { ...authUser, requiresPasswordChange: false } : undefined;
    const token = response.data?.accessToken;
    if (token) {
      // Requests still on their way with the old token get a 401 that must not sign the user out
      markTokenReplaced(authHeader);
      signIn({ auth: { token, type: 'Bearer' }, userState });
    } else if (userState) {
      await updateUserState(userState);
    }
    return 'ok';
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
