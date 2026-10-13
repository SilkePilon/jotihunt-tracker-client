import { isAxiosError } from 'axios';

/** The API rejected our token: the login session has expired or was revoked. */
export function isUnauthorized(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401;
}
