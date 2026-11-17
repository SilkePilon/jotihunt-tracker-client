import { describe, expect, test } from 'bun:test';
import { OWN_POSITION_FRESH_MS, OWN_POSITION_LIVE_MS, distanceMetres, ownDeviceId, ownTrackerPosition } from './own-position';
import type { Device } from '@/types/Device';
import type { Position } from '@/types/Position';

const NOW = Date.parse('2026-10-17T12:00:00Z');

function position(deviceId: number, fixTime: string, latitude = 52.1, longitude = 5.8): Position {
  return {
    id: String(deviceId),
    attributes: { distance: 0, totalDistance: 0, motion: false },
    deviceId,
    latitude,
    longitude,
    speed: 0,
    course: 0,
    accuracy: 5,
    deviceName: `device ${deviceId}`,
    fixTime,
  };
}

describe('distanceMetres', () => {
  test('one degree of latitude is about 111.2 km', () => {
    expect(distanceMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1);
  });

  test('same point is 0', () => {
    expect(distanceMetres({ lat: 52.1, lng: 5.8 }, { lat: 52.1, lng: 5.8 })).toBe(0);
  });
});

describe('ownTrackerPosition', () => {
  test('the fresh position of the own device', () => {
    const positions = [position(1, '2026-10-17T11:59:00Z', 1, 1), position(7, '2026-10-17T11:58:00Z', 52.1, 5.8)];
    expect(ownTrackerPosition(positions, 7, NOW)).toEqual({ lat: 52.1, lng: 5.8 });
  });

  test('device id 0 is valid', () => {
    expect(ownTrackerPosition([position(0, '2026-10-17T11:59:00Z')], 0, NOW)).toEqual({ lat: 52.1, lng: 5.8 });
  });

  test('undefined without a device, without a position, or when stale (> 5 min)', () => {
    expect(ownTrackerPosition([position(7, '2026-10-17T11:59:00Z')], undefined, NOW)).toBeUndefined();
    expect(ownTrackerPosition(undefined, 7, NOW)).toBeUndefined();
    expect(ownTrackerPosition([position(1, '2026-10-17T11:59:00Z')], 7, NOW)).toBeUndefined();
    expect(ownTrackerPosition([position(7, '2026-10-17T11:50:00Z')], 7, NOW)).toBeUndefined();
  });

  test('maxAgeMs narrows freshness: a 3 min old fix is fine for greying but not for "where I am now"', () => {
    const positions = [position(7, '2026-10-17T11:57:00Z')];
    expect(ownTrackerPosition(positions, 7, NOW)).toEqual({ lat: 52.1, lng: 5.8 });
    expect(ownTrackerPosition(positions, 7, NOW, OWN_POSITION_FRESH_MS)).toBeUndefined();
    expect(ownTrackerPosition([position(7, '2026-10-17T11:59:30Z')], 7, NOW, OWN_POSITION_FRESH_MS)).toEqual({ lat: 52.1, lng: 5.8 });
  });

  test('locate and follow only trust a fix under 20 s; a 30 s old one is still fresh for the dot', () => {
    const positions = [position(7, '2026-10-17T11:59:30Z')];
    expect(ownTrackerPosition(positions, 7, NOW, OWN_POSITION_LIVE_MS)).toBeUndefined();
    expect(ownTrackerPosition(positions, 7, NOW, OWN_POSITION_FRESH_MS)).toEqual({ lat: 52.1, lng: 5.8 });
    expect(ownTrackerPosition([position(7, '2026-10-17T11:59:45Z')], 7, NOW, OWN_POSITION_LIVE_MS)).toEqual({ lat: 52.1, lng: 5.8 });
  });

  test('"where I am now" outlasts the slowest app heartbeat (120 s Zuinig) plus the 30 s poll', () => {
    expect(OWN_POSITION_FRESH_MS).toBeGreaterThanOrEqual(120_000 + 30_000);
    expect(ownTrackerPosition([position(7, '2026-10-17T11:57:40Z')], 7, NOW, OWN_POSITION_FRESH_MS)).toEqual({ lat: 52.1, lng: 5.8 });
  });

  test('undefined for a missing or unreadable fix time', () => {
    expect(ownTrackerPosition([position(7, 'not a date')], 7, NOW)).toBeUndefined();
    expect(ownTrackerPosition([position(7, '')], 7, NOW)).toBeUndefined();
  });
});

describe('ownDeviceId', () => {
  const devices = [
    { id: 0, uniqueId: 'abc' },
    { id: 7, uniqueId: 'xyz' },
  ] as Device[];

  test('the device id whose uniqueId matches the own tracker (id 0 is valid)', () => {
    expect(ownDeviceId(devices, 'xyz')).toBe(7);
    expect(ownDeviceId(devices, 'abc')).toBe(0);
  });

  test('undefined when there is no uniqueId, no devices or no match', () => {
    expect(ownDeviceId(devices, undefined)).toBeUndefined();
    expect(ownDeviceId(undefined, 'xyz')).toBeUndefined();
    expect(ownDeviceId(devices, 'nope')).toBeUndefined();
  });
});
