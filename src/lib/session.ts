import { apiErrorStatus } from '@/lib/api-error';

/** The API rejected our token: the login session has expired or was revoked. */
export function isUnauthorized(error: unknown): boolean {
  return apiErrorStatus(error) === 401;
}
