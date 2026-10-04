/** Outcome of a login attempt; the server answers 429 after too many wrong passwords */
export type LoginResult = 'ok' | 'invalid' | 'rate-limited' | 'offline';

/** Outcome of changing the own password */
export type PasswordUpdateResult = 'ok' | 'wrong-password' | 'session-ended' | 'failed';

/**
 * Why a login failed, by the HTTP status (undefined: no response, i.e. a network error or timeout). Server trouble
 * (5xx, e.g. a 502/503 from the proxy) is reported like no connection, not as a wrong password.
 */
export function loginFailure(status: number | undefined): Exclude<LoginResult, 'ok'> {
  if (status === undefined || status >= 500) return 'offline';
  if (status === 429) return 'rate-limited';
  return 'invalid';
}

/**
 * Why changing the password failed: a 400 means the old password is wrong, a 401 that the session itself is gone
 * (e.g. the password was already changed on another device, which revokes this token).
 */
export function passwordUpdateFailure(status: number | undefined): Exclude<PasswordUpdateResult, 'ok'> {
  if (status === 400) return 'wrong-password';
  if (status === 401) return 'session-ended';
  return 'failed';
}
