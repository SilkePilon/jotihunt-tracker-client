import { describe, expect, test } from 'bun:test';
import { isBaseMapEvent, isMapUnavailable, MAP_ERROR_GRACE_MS, MAP_OFFLINE_TIMEOUT_MS, startMapLoad } from './map-availability';

describe('isMapUnavailable', () => {
  test('an error counts only after the grace period without tiles', () => {
    const progress = { ...startMapLoad(0), firstErrorAt: 1000 };
    expect(isMapUnavailable(progress, 1000 + MAP_ERROR_GRACE_MS - 1, true)).toBe(false);
    expect(isMapUnavailable(progress, 1000 + MAP_ERROR_GRACE_MS, true)).toBe(true);
  });

  test('cached tiles that render never block the map', () => {
    const progress = { startedAt: 0, firstErrorAt: 0, hasContent: true };
    expect(isMapUnavailable(progress, 60_000, false)).toBe(false);
  });

  test('offline without errors: unavailable after the timeout; online it keeps waiting', () => {
    const progress = startMapLoad(0);
    expect(isMapUnavailable(progress, MAP_OFFLINE_TIMEOUT_MS - 1, false)).toBe(false);
    expect(isMapUnavailable(progress, MAP_OFFLINE_TIMEOUT_MS, false)).toBe(true);
    expect(isMapUnavailable(progress, MAP_OFFLINE_TIMEOUT_MS * 4, true)).toBe(false);
  });
});

describe('isBaseMapEvent', () => {
  const base = new Set(['openmaptiles']);
  test('style-level errors and base sources count, overlays do not', () => {
    expect(isBaseMapEvent(undefined, base)).toBe(true);
    expect(isBaseMapEvent('openmaptiles', base)).toBe(true);
    expect(isBaseMapEvent('hunters', base)).toBe(false);
    expect(isBaseMapEvent('hunters', null)).toBe(true);
  });
});
