/**
 * Tracks whether polled data still refreshes, for the "no connection" badge. Module state on purpose: every SWR fetch
 * reports here, and only the badge reads it (on a timer), so a successful poll doesn't re-render anything.
 */

/** Without a successful refresh for this long (and a failure or offline since), the data counts as stale. */
export const STALE_AFTER_MS = 60_000;

export interface ConnectionState {
  lastSuccessAt: number;
  lastErrorAt: number | null;
}

const state: ConnectionState = { lastSuccessAt: Date.now(), lastErrorAt: null };

export function reportFetchSuccess(now = Date.now()) {
  state.lastSuccessAt = now;
}

export function reportFetchError(now = Date.now()) {
  state.lastErrorAt = now;
}

export function connectionState(): Readonly<ConnectionState> {
  return state;
}

/**
 * How old the data is (ms) when it should be flagged as stale, else null. Needs a failure (or being offline, where SWR
 * stops fetching) since the last success: a tab coming back from the background hasn't polled yet, but isn't broken.
 */
export function staleAge({ lastSuccessAt, lastErrorAt }: ConnectionState, online: boolean, now: number, staleAfterMs = STALE_AFTER_MS): number | null {
  const age = now - lastSuccessAt;
  if (age <= staleAfterMs) return null;
  const failedSince = lastErrorAt !== null && lastErrorAt >= lastSuccessAt;
  return failedSince || !online ? age : null;
}

/** "Geen verbinding — gegevens 3 min oud" */
export function staleLabel(ageMs: number): string {
  const minutes = Math.max(1, Math.floor(ageMs / 60_000));
  const age = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} u ${minutes % 60} min`;
  return `Geen verbinding — gegevens ${age} oud`;
}
