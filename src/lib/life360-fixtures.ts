import type { Life360AdminStatus, Life360Location, Life360Members, Life360State } from '@/types/Life360';

/**
 * Fixture data per server state: used by the unit tests, and in dev builds (only) instead of the server when
 * localStorage[LIFE360_FIXTURE_KEY] holds a state name, so every card state and the map layer can be checked by hand.
 */
export const LIFE360_FIXTURE_KEY = 'jh-life360-fixture';

export interface Life360Fixture {
  status: Life360AdminStatus;
  members: Life360Members;
}

const STATES: readonly Life360State[] = ['unavailable', 'unlinked', 'code', 'circle', 'linked', 'loggedOut', 'paused'];
const EMAIL = 'jotihunt@gmail.com';
/** Long on purpose: the logged-out card must truncate it. */
const LONG_EMAIL = 'jotihunt.scouting.groep@gmail.com';
const CIRCLE = 'Jotihunt 2026';
const NOT_LINKED: Life360Members = { linked: false, stale: false, members: [] };

/** A plain avatar (person on a coloured square) as a data URL; the avatar loader uses data URLs as they are. */
function avatar(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${color}"/><circle cx="48" cy="38" r="18" fill="#fff"/><path d="M14 96c4-22 18-32 34-32s30 10 34 32z" fill="#fff"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Six members around Utrecht: driving, live, old (38 min), no photo, and one not sharing. 4 of 6 live. */
function members(now: number, stale: boolean): Life360Members {
  const location = (lat: number, lon: number, msAgo: number, extra: Partial<Life360Location> = {}): Life360Location => ({
    lat,
    lon,
    accuracyM: 15,
    at: new Date(now - msAgo).toISOString(),
    driving: false,
    speedKmh: null,
    battery: 80,
    charging: false,
    ...extra,
  });
  return {
    linked: true,
    stale,
    members: [
      { id: 'm-jesse', name: 'Jesse S.', initials: 'JS', avatarUrl: avatar('#0ea5e9'), location: location(52.0907, 5.1214, 20_000, { driving: true, speedKmh: 42, battery: 81, accuracyM: 12 }) },
      { id: 'm-mila', name: 'Mila K.', initials: 'MK', avatarUrl: avatar('#22c55e'), location: location(52.0842, 5.1395, 2 * 60_000, { battery: 54, accuracyM: 40 }) },
      { id: 'm-lars', name: 'Lars B.', initials: 'LB', avatarUrl: null, location: location(52.0731, 5.1102, 38 * 60_000, { battery: 12, charging: true, accuracyM: 65 }) },
      { id: 'm-sem', name: 'Sem D.', initials: 'SD', avatarUrl: null, location: location(52.1003, 5.1077, 60_000, { battery: null }) },
      { id: 'm-noor', name: 'Noor J.', initials: 'NJ', avatarUrl: avatar('#8b5cf6'), location: location(52.0968, 5.1503, 5_000) },
      { id: 'm-tess', name: 'Tess V.', initials: 'TV', avatarUrl: null, location: null },
    ],
  };
}

/** The status and members the server would answer in `state`, with times relative to `now`. */
export function life360Fixture(state: Life360State, now: number): Life360Fixture {
  const at = (msFromNow: number) => new Date(now + msFromNow).toISOString();
  switch (state) {
    case 'unavailable':
      return { status: { state }, members: NOT_LINKED };
    case 'unlinked':
      return { status: { state }, members: NOT_LINKED };
    case 'code':
      return { status: { state, email: EMAIL, resendAt: at(42_000) }, members: NOT_LINKED };
    case 'circle':
      return {
        status: {
          state,
          email: EMAIL,
          circles: [
            { id: 'c-jotihunt', name: CIRCLE },
            { id: 'c-familie', name: 'Familie' },
          ],
        },
        members: NOT_LINKED,
      };
    case 'linked':
      return {
        status: { state, email: EMAIL, circleName: CIRCLE, memberCount: 6, liveCount: 4, lastPollAt: at(-12_000), refreshAvailableAt: null },
        members: members(now, false),
      };
    case 'loggedOut':
      return { status: { state, email: LONG_EMAIL, circleName: CIRCLE }, members: members(now, true) };
    case 'paused':
      return { status: { state, email: EMAIL, circleName: CIRCLE, retryAt: at(18 * 60_000), memberCount: 6, liveCount: 4 }, members: members(now, true) };
  }
}

let cached: { state: Life360State; fixture: Life360Fixture } | undefined;

/** Dev builds only: the fixture named in localStorage (built once per name, so its times stay put), else undefined. */
export function life360DevFixture(): Life360Fixture | undefined {
  const name = typeof localStorage === 'undefined' ? null : localStorage.getItem(LIFE360_FIXTURE_KEY);
  const state = STATES.find((candidate) => candidate === name);
  if (!state) return undefined;
  if (cached?.state !== state) cached = { state, fixture: life360Fixture(state, Date.now()) };
  return cached.fixture;
}
