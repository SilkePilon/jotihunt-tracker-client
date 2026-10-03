/** Outcome of a login attempt; the server answers 429 after too many wrong passwords */
export type LoginResult = 'ok' | 'invalid' | 'rate-limited' | 'offline';

/** Outcome of changing the own password */
export type PasswordUpdateResult = 'ok' | 'wrong-password' | 'failed';

/**
 * Why a login failed, by the HTTP status (undefined: no response, i.e. a network error or timeout). Server trouble
 * (5xx, e.g. a 502/503 from the proxy) is reported like no connection, not as a wrong password.
 */
export function loginFailure(status: number | undefined): Exclude<LoginResult, 'ok'> {
  if (status === undefined || status >= 500) return 'offline';
  if (status === 429) return 'rate-limited';
  return 'invalid';
}

/** Why changing the password failed: only a 400/401 means the old password is wrong. */
export function passwordUpdateFailure(status: number | undefined): Exclude<PasswordUpdateResult, 'ok'> {
  return status === 400 || status === 401 ? 'wrong-password' : 'failed';
}
