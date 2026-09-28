import { describe, expect, test } from 'bun:test';
import type { Device } from '@/types/Device';
import type { Position } from '@/types/Position';
import type { User } from '@/types/User';
import { googleMapsUrl, hunterRows, vehicleForGroupId, vehicleGroupIdsFromEnv } from './hunters';

const NOW = new Date('2026-10-17T12:00:00Z').getTime();
const groups = vehicleGroupIdsFromEnv({ GROUP_WALKING_ID: '1', GROUP_BIKE_ID: '2', GROUP_CAR_ID: '3', GROUP_MOTORCYCLE_ID: '' });

function device(id: number, lastUpdate: string | null, groupId = 1): Device {
  return { id, groupId, calendarId: 0, name: `Toestel ${id}`, uniqueId: `u${id}`, status: 'online', lastUpdate: lastUpdate as unknown as Date, positionId: id, disabled: false };
}

describe('vehicle groups', () => {
  test('env ids map to vehicles; empty ids are unset', () => {
    expect(groups).toEqual({ walking: 1, bike: 2, car: 3, motorcycle: undefined });
    expect(vehicleForGroupId(3, groups)).toBe('car');
    expect(vehicleForGroupId(0, groups)).toBeUndefined();
    expect(vehicleForGroupId(9, groups)).toBeUndefined();
  });
});

describe('hunterRows', () => {
  const devices = [device(1, '2026-10-17T11:50:00Z', 2), device(2, '2026-10-17T11:58:00Z', 3), device(3, null)];
  const positions = [{ deviceId: 2, latitude: 52, longitude: 5.9, speed: 10, accuracy: 8, attributes: { batteryLevel: 64 } } as unknown as Position];
  const users = [{ _id: 'u', name: 'Merida', tracker: { deviceId: 2, uniqueId: 'jh-x', vehicle: 'car' } } as unknown as User];

  test('newest first, never-reported last, active within 5 minutes', () => {
    const rows = hunterRows(devices, positions, users, groups, NOW);
    expect(rows.map((row) => row.device.id)).toEqual([2, 1, 3]);
    expect(rows.map((row) => row.active)).toEqual([true, false, false]);
  });

  test('joins position stats, linked user and vehicle', () => {
    const [row] = hunterRows(devices, positions, users, groups, NOW);
    expect(row.user?.name).toBe('Merida');
    expect(row.vehicle).toBe('car');
    expect(row.speedKmh).toBeCloseTo(18.52);
    expect(row.batteryPercent).toBe(64);
    expect(row.accuracyM).toBe(8);
  });

  test('handles missing data', () => {
    expect(hunterRows(undefined, undefined, undefined, groups, NOW)).toEqual([]);
    const [row] = hunterRows([device(3, null)], undefined, undefined, groups, NOW);
    expect(row).toMatchObject({ active: false, lastUpdate: undefined, speedKmh: undefined, user: undefined });
  });
});

test('googleMapsUrl', () => {
  expect(googleMapsUrl(52.1234567, 5.9)).toBe('https://www.google.com/maps/search/?api=1&query=52.123457,5.900000');
});
