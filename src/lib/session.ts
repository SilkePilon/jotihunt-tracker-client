import { AxiosHeaders, isAxiosError } from 'axios';

/** Authorization headers replaced by a fresh token (after a password change); the server rejects them now */
const replacedAuthHeaders = new Set<string>();

/**
 * The old token was swapped for a fresh one (changing the password revokes it). Requests still in flight with it
 * get a 401 that must not end the new session; SWR retries them with the fresh token.
 */
export function markTokenReplaced(authHeader: string | null | undefined) {
  if (authHeader) replacedAuthHeaders.add(authHeader);
}

/** The API rejected our token: the login session has expired. */
export function isUnauthorized(error: unknown): boolean {
  if (!isAxiosError(error) || error.response?.status !== 401) return false;
  const sentWith = AxiosHeaders.from(error.config?.headers ?? {}).get('Authorization');
  return !(typeof sentWith === 'string' && replacedAuthHeaders.has(sentWith));
}
