import { describe, expect, test } from 'bun:test';
import { browserDotWatchOptions, followTarget, geolocationGranted, HUNT_HERE_GRACE_MS, huntHereFix, huntHereVisible, locateMe, olderTrackerFixNote } from './locate';

function fakeGeolocation(result: { lat: number; lng: number; accuracy?: number } | { code: number }): Geolocation {
  return {
    getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => {
      if ('lat' in result) success({ coords: { latitude: result.lat, longitude: result.lng, accuracy: result.accuracy } } as GeolocationPosition);
      else failure?.({ code: result.code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError);
    },
  } as Geolocation;
}

const TRACKER = { lat: 52, lng: 5 };
const BROWSER = { lat: 51.9, lng: 6.1 };

describe('locateMe', () => {
  test('a live tracker fix wins without asking the browser', async () => {
    expect(await locateMe({ live: TRACKER, recent: TRACKER, granted: true }, fakeGeolocation({ code: 1 }))).toEqual({ ...TRACKER, source: 'tracker' });
  });

  test('an older tracker fix gives way to an already-granted browser position', async () => {
    expect(await locateMe({ recent: TRACKER, granted: true }, fakeGeolocation({ ...BROWSER, accuracy: 12 }))).toEqual({ ...BROWSER, accuracy: 12, source: 'browser' });
  });

  test('without access an older tracker fix beats a permission prompt', async () => {
    let asked = false;
    const geolocation = { getCurrentPosition: () => void (asked = true) } as unknown as Geolocation;
    expect(await locateMe({ recent: TRACKER, granted: false }, geolocation)).toEqual({ ...TRACKER, source: 'tracker' });
    expect(asked).toBe(false);
  });

  test('a failing browser falls back to the older tracker fix', async () => {
    expect(await locateMe({ recent: TRACKER, granted: true }, fakeGeolocation({ code: 3 }))).toEqual({ ...TRACKER, source: 'tracker' });
  });

  test('no tracker at all: the browser, prompting if needed', async () => {
    expect(await locateMe({ granted: false }, fakeGeolocation(BROWSER))).toEqual({ ...BROWSER, source: 'browser' });
  });

  test('denied or unavailable: a Dutch message', async () => {
    expect(locateMe({ granted: false }, fakeGeolocation({ code: 1 }))).rejects.toThrow('Geen toegang tot je locatie');
    expect(locateMe({ granted: true }, fakeGeolocation({ code: 3 }))).rejects.toThrow('kon niet worden bepaald');
    expect(locateMe({ granted: false }, undefined)).rejects.toThrow('kan je locatie niet bepalen');
  });
});

describe('followTarget', () => {
  const recent = { lat: 1, lng: 1 };
  test('live tracker, then browser, then recent tracker', () => {
    expect(followTarget(TRACKER, BROWSER, recent)).toEqual(TRACKER);
    expect(followTarget(undefined, BROWSER, recent)).toEqual(BROWSER);
    expect(followTarget(undefined, null, recent)).toEqual(recent);
    expect(followTarget(undefined, undefined, undefined)).toBeUndefined();
  });
});

describe('geolocationGranted', () => {
  const permissions = (state: PermissionState) => ({ query: () => Promise.resolve({ state }) });
  test('only a granted permission counts', async () => {
    expect(await geolocationGranted(permissions('granted'))).toBe(true);
    expect(await geolocationGranted(permissions('prompt'))).toBe(false);
    expect(await geolocationGranted(permissions('denied'))).toBe(false);
  });

  test('no Permissions API or a failing query: not granted', async () => {
    expect(await geolocationGranted(undefined)).toBe(false);
    expect(await geolocationGranted({ query: () => Promise.reject(new TypeError('unsupported')) })).toBe(false);
  });
});

describe('Hunt hier', () => {
  const located = { lat: 52, lng: 5, at: 1_000 };
  test('shows while following, and for a while after a locate', () => {
    expect(huntHereVisible(true, null, 0)).toBe(true);
    expect(huntHereVisible(false, null, 0)).toBe(false);
    expect(huntHereVisible(false, located, 1_000 + HUNT_HERE_GRACE_MS - 1)).toBe(true);
    expect(huntHereVisible(false, located, 1_000 + HUNT_HERE_GRACE_MS)).toBe(false);
  });

  test('marks at the own position now, else where the locate found you', () => {
    const live = { lat: 1, lng: 1 };
    const browser = { lat: 2, lng: 2 };
    const recent = { lat: 3, lng: 3 };
    expect(huntHereFix(live, browser, recent, located)).toBe(live);
    expect(huntHereFix(undefined, browser, recent, located)).toBe(browser);
    expect(huntHereFix(undefined, null, recent, located)).toBe(recent);
    expect(huntHereFix(undefined, null, undefined, located)).toBe(located);
    expect(huntHereFix(undefined, null, undefined, null)).toBeUndefined();
  });
});

describe('olderTrackerFixNote', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  test('names the age of an older tracker fix', () => {
    expect(olderTrackerFixNote('tracker', undefined, new Date(now - 2 * 60_000), now)).toBe('Laatste trackerpositie · 2 min geleden');
    expect(olderTrackerFixNote('tracker', undefined, '2026-10-18T11:59:30Z', now)).toBe('Laatste trackerpositie · zojuist');
  });

  test('nothing for a live fix, a browser position or no time', () => {
    expect(olderTrackerFixNote('tracker', { lat: 1, lng: 1 }, new Date(now - 60_000), now)).toBeNull();
    expect(olderTrackerFixNote('browser', undefined, new Date(now - 60_000), now)).toBeNull();
    expect(olderTrackerFixNote('tracker', undefined, undefined, now)).toBeNull();
    expect(olderTrackerFixNote('tracker', undefined, 'nope', now)).toBeNull();
  });
});

describe('browserDotWatchOptions', () => {
  test('high accuracy only while following', () => {
    expect(browserDotWatchOptions(true).enableHighAccuracy).toBe(true);
    expect(browserDotWatchOptions(false).enableHighAccuracy).toBe(false);
    expect(browserDotWatchOptions(false).maximumAge).toBe(10_000);
  });
});
