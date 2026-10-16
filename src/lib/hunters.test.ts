import { describe, expect, test } from 'bun:test';
import type { Device } from '@/types/Device';
import type { Position } from '@/types/Position';
import type { User } from '@/types/User';
import { googleMapsUrl, hunterIcon, hunterMeta, hunterRows, huntersSummary, isLowBattery, vehicleForGroupId, type VehicleGroupIds } from './hunters';

const NOW = new Date('2026-10-17T12:00:00Z').getTime();
const groups: VehicleGroupIds = { walking: 1, bike: 2, car: 3 };

function device(id: number, lastUpdate: string | null, groupId = 1): Device {
  return { id, groupId, calendarId: 0, name: `Toestel ${id}`, uniqueId: `u${id}`, status: 'online', lastUpdate: lastUpdate as unknown as Date, positionId: id, disabled: false };
}

describe('vehicle groups', () => {
  test('group ids map to vehicles; unknown ids are no vehicle', () => {
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

  test('hunterMeta: user (when named differently), vehicle, update, speed only while live; no battery (shown apart); unknowns left out', () => {
    const [live, stale, never] = hunterRows(devices, positions, users, groups, NOW);
    expect(hunterMeta(live, NOW)).toBe('Merida · Auto · 2 min geleden · 19 km/u');
    expect(hunterMeta(stale, NOW)).toBe('Fiets · 10 min geleden');
    expect(hunterMeta(never, NOW)).toBe('Lopend');
    const named = hunterRows([device(2, '2026-10-17T11:58:00Z', 3)], positions, [{ ...users[0], name: 'Toestel 2' }], groups, NOW);
    expect(hunterMeta(named[0], NOW)).toBe('Auto · 2 min geleden · 19 km/u');
  });

  test('huntersSummary counts live and not live', () => {
    expect(huntersSummary(hunterRows(devices, positions, users, groups, NOW))).toBe('1 live · 2 niet live');
    expect(huntersSummary([])).toBe('0 live · 0 niet live');
  });

  test('hunterIcon: the vehicle, else a phone', () => {
    const [live] = hunterRows(devices, positions, users, groups, NOW);
    expect(hunterIcon(live)).toBe('car');
    const [plain] = hunterRows([device(4, null, 99)], undefined, undefined, groups, NOW);
    expect(hunterIcon(plain)).toBe('phone');
  });
});

test('googleMapsUrl', () => {
  expect(googleMapsUrl(52.1234567, 5.9)).toBe('https://www.google.com/maps/search/?api=1&query=52.123457,5.900000');
});

test('isLowBattery: under 20 %', () => {
  expect(isLowBattery(19)).toBe(true);
  expect(isLowBattery(20)).toBe(false);
  expect(isLowBattery(undefined)).toBe(false);
});
