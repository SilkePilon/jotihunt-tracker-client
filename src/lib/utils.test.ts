import { describe, expect, test } from 'bun:test';
import type { Device } from '@/types/Device';
import { filterActiveDevices, randomId } from './utils';

function device(id: number, lastUpdate: Date | null): Device {
  return { id, groupId: 0, calendarId: 0, name: `Toestel ${id}`, uniqueId: `u${id}`, status: 'online', lastUpdate, positionId: 0, disabled: false };
}

describe('filterActiveDevices', () => {
  test('keeps devices seen in the last 5 minutes and skips ones that never sent a position', () => {
    const recent = device(1, new Date(Date.now() - 60_000));
    const old = device(2, new Date(Date.now() - 10 * 60_000));
    const never = device(3, null);
    expect(filterActiveDevices([recent, old, never]).map((d) => d.id)).toEqual([1]);
  });

  test('handles a missing list', () => {
    expect(filterActiveDevices(undefined)).toEqual([]);
  });
});

describe('randomId', () => {
  test('RFC 4122 v4 format and unique', () => {
    const a = randomId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(randomId()).not.toBe(a);
  });
});
