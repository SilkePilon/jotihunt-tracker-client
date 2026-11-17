/**
 * Tracks whether polled data still refreshes, for the "no connection" badge. Module state on purpose: every SWR fetch
 * reports here, and only the badge reads it (on a timer), so a successful poll doesn't re-render anything.
 *
 * Besides one overall record, the critical feeds (foxes, hunts, markers, positions, hints, predictions, bot messages)
 * are tracked on their own: one successful poll elsewhere (e.g. /hunts) must not hide that /areas keeps failing.
 */

/** Without a successful refresh for this long (and a failure or offline since), the data counts as stale. */
export const STALE_AFTER_MS = 60_000;
/** A critical feed that never loaded is flagged after failing for this long (SWR's first retries come within seconds). */
export const NEVER_LOADED_GRACE_MS = 10_000;

export interface ConnectionState {
  lastSuccessAt: number;
  lastErrorAt: number | null;
  /** The last failure got no answer at all (offline, server unreachable, timeout) rather than an HTTP error */
  networkError?: boolean;
}

/** One feed's record; `lastSuccessAt` null until its first successful fetch. */
export interface FeedState {
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
}

/** The feeds whose staleness the badge reports on their own, with the word the badge uses for them. */
export const CRITICAL_FEEDS: Record<string, string> = {
  '/areas': 'vossen',
  '/hunts': 'hunts',
  '/markers': 'markers',
  '/tracker/positions': 'posities',
  '/hints/board': 'hints',
  '/predictions': 'voorspellingen',
  '/telegram/messages': 'berichten',
};

export interface ConnectionSnapshot {
  /** When this page started tracking (a cold start counts from here) */
  startedAt: number;
  overall: ConnectionState;
  /** Per feed path (query left off) */
  feeds: Record<string, FeedState>;
  /** The page came back to the front with old data (see reportResume); null once a fetch succeeded or failed since */
  resumedAt?: number | null;
}

function freshState(now = Date.now()): ConnectionSnapshot {
  return { startedAt: now, overall: { lastSuccessAt: now, lastErrorAt: null, networkError: false }, feeds: {}, resumedAt: null };
}

let state: ConnectionSnapshot = freshState();
/** Whether any fetch has succeeded on this page yet (the overall lastSuccessAt starts at page load) */
let anySuccess = false;

/** The path part of an SWR url ("/hunts?since=…" → "/hunts"). */
export function feedKey(url: string): string {
  const query = url.indexOf('?');
  return query === -1 ? url : url.slice(0, query);
}

/**
 * SWR key filter for the critical feeds (keys are `[url, authHeader]`): the connection coming back refetches these at
 * once, so the stale notice clears without waiting for each poll (and SWR's reconnect dedupe).
 */
export function isCriticalFeedKey(key: unknown): boolean {
  return Array.isArray(key) && typeof key[0] === 'string' && feedKey(key[0]) in CRITICAL_FEEDS;
}

function feed(url: string | undefined): FeedState | null {
  if (url === undefined) return null;
  const key = feedKey(url);
  if (!(key in CRITICAL_FEEDS)) return null;
  return (state.feeds[key] ??= { lastSuccessAt: null, lastErrorAt: null });
}

export function reportFetchSuccess(url?: string, now = Date.now()) {
  state.overall.lastSuccessAt = now;
  // An answer came, so an earlier "no answer" no longer describes the connection
  state.overall.networkError = false;
  state.resumedAt = null;
  anySuccess = true;
  const record = feed(url);
  if (record) record.lastSuccessAt = now;
}

/** `network`: no answer came (see isNetworkError); false for an HTTP error, so the badge doesn't say "Geen verbinding" */
export function reportFetchError(url?: string, now = Date.now(), network = true) {
  state.overall.lastErrorAt = now;
  state.overall.networkError = network;
  // From here the usual stale rules say whether it's a real problem
  state.resumedAt = null;
  const record = feed(url);
  if (record) record.lastErrorAt = now;
}

export function connectionState(): Readonly<ConnectionState> {
  return state.overall;
}

export function connectionSnapshot(): Readonly<ConnectionSnapshot> & { anySuccess: boolean } {
  return { ...state, anySuccess };
}

/**
 * The page came back to the front (visibilitychange / pageshow). With data older than {@link STALE_AFTER_MS} the badge
 * says it is catching up ("Bijwerken… gegevens 12 min oud", neutral) until the next fetch succeeds or fails: a phone
 * unlocked after a while shows old positions for a moment, and that shouldn't look current (or like an error).
 */
export function reportResume(now = Date.now(), staleAfterMs = STALE_AFTER_MS) {
  if (now - state.overall.lastSuccessAt > staleAfterMs) state.resumedAt = now;
}

/** Tests only: start over as a fresh page load. */
export function resetConnection(now = Date.now()) {
  state = freshState(now);
  anySuccess = false;
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

/** What the badge should say: data `ageMs` old (null: nothing loaded yet), for every feed or only `feeds` (badge words). */
export interface ConnectionProblem {
  ageMs: number | null;
  /** Empty: the connection as a whole; else only these critical feeds are behind */
  feeds: string[];
  /** No connection (the browser is offline or requests get no answer), rather than the server answering with errors */
  offline: boolean;
  /** Not a failure: back from the background with old data, the first refresh is on its way (neutral badge) */
  refreshing?: boolean;
}

/**
 * The problem to show, if any:
 * - offline before anything loaded (cold offline start): at once, no age;
 * - a critical feed that failed and never loaded, for {@link NEVER_LOADED_GRACE_MS} since the start: no age;
 * - all data stale ({@link staleAge} over the overall record);
 * - back from the background with old data and no answer yet ({@link reportResume}): `refreshing`, neutral;
 * - else, critical feeds that are stale on their own while others still refresh: named, with the oldest age.
 */
export function connectionProblem(snapshot: ConnectionSnapshot & { anySuccess: boolean }, online: boolean, now: number, staleAfterMs = STALE_AFTER_MS): ConnectionProblem | null {
  if (!online && !snapshot.anySuccess) return { ageMs: null, feeds: [], offline: true };
  const offline = !online || snapshot.overall.networkError !== false;
  const overall = staleAge(snapshot.overall, online, now, staleAfterMs);
  if (overall !== null) return { ageMs: overall, feeds: [], offline };
  if (snapshot.resumedAt != null && online) return { ageMs: now - snapshot.overall.lastSuccessAt, feeds: [], offline: false, refreshing: true };

  const neverLoaded: string[] = [];
  const stale: { name: string; age: number }[] = [];
  for (const [key, record] of Object.entries(snapshot.feeds)) {
    const name = CRITICAL_FEEDS[key];
    if (!name) continue;
    if (record.lastSuccessAt === null) {
      if (record.lastErrorAt !== null && now - snapshot.startedAt >= NEVER_LOADED_GRACE_MS) neverLoaded.push(name);
      continue;
    }
    const age = staleAge({ lastSuccessAt: record.lastSuccessAt, lastErrorAt: record.lastErrorAt }, online, now, staleAfterMs);
    if (age !== null) stale.push({ name, age });
  }
  if (neverLoaded.length > 0 && !snapshot.anySuccess) return { ageMs: null, feeds: [], offline };
  if (neverLoaded.length > 0) return { ageMs: null, feeds: neverLoaded, offline };
  if (stale.length > 0) return { ageMs: Math.max(...stale.map((entry) => entry.age)), feeds: stale.map((entry) => entry.name), offline };
  return null;
}

function ageText(ageMs: number): string {
  const minutes = Math.max(1, Math.floor(ageMs / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} u ${minutes % 60} min`;
}

/** "Geen verbinding — gegevens 3 min oud"; reachable but failing: "Geen actuele gegevens — 3 min oud" */
export function staleLabel(ageMs: number, offline = true): string {
  return offline ? `Geen verbinding — gegevens ${ageText(ageMs)} oud` : `Geen actuele gegevens — ${ageText(ageMs)} oud`;
}

/** More feeds than this are summarised ("Meerdere gegevens …"), so the badge fits a phone */
const MAX_NAMED_FEEDS = 2;

/**
 * The badge text for a {@link ConnectionProblem}: "Geen verbinding" (offline) or "Geen actuele gegevens" (the server
 * answers with errors), "… 3 min oud", "Vossen niet bijgewerkt — 3 min oud", "Meerdere gegevens niet geladen".
 */
export function problemLabel({ ageMs, feeds, offline, refreshing }: ConnectionProblem): string {
  if (refreshing && ageMs !== null) return `Bijwerken… gegevens ${ageText(ageMs)} oud`;
  if (feeds.length === 0) return ageMs === null ? (offline ? 'Geen verbinding' : 'Geen actuele gegevens') : staleLabel(ageMs, offline);
  const names = feeds.length > MAX_NAMED_FEEDS ? 'meerdere gegevens' : feeds.length === 1 ? feeds[0] : `${feeds[0]} en ${feeds[1]}`;
  const subject = names.charAt(0).toUpperCase() + names.slice(1);
  return ageMs === null ? `${subject} niet geladen` : `${subject} niet bijgewerkt — ${ageText(ageMs)} oud`;
}
