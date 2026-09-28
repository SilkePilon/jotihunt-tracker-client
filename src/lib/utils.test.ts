import { describe, expect, test } from 'bun:test';
import type { Device } from '@/types/Device';
import { filterActiveDevices } from './utils';

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
