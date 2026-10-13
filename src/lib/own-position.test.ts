import { describe, expect, test } from 'bun:test';
import { distanceMetres, ownTrackerPosition } from './own-position';
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
});
