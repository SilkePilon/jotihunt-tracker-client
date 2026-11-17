import { describe, expect, test } from 'bun:test';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import type { SyncedHunt } from '@/types/HuntSync';
import { huntMarkerId } from './hunt-marker';

function hunt(id: string, siteKey: string): SyncedHunt {
  return { _id: id, siteKey, area: 'alpha', huntTime: null, status: 'approved', statusText: 'Goedgekeurd', points: 1, location: null, firstSeenAt: '2026-10-17T10:00:00Z', statusChangedAt: null };
}

function marker(id: string, extra: Partial<Marker>): Marker {
  return { _id: id, area: 'alpha', time: new Date('2026-10-17T10:00:00Z'), location: { type: 'Point', coordinates: [5, 52] }, type: MarkerType.Hunt, ...extra };
}

describe('huntMarkerId', () => {
  const hunts = [hunt('h1', 'site-1'), hunt('h2', 'site-2')];
  const markers = [
    marker('m-board', { source: 'jotiboard', externalId: 'site-1' }),
    marker('m1', { source: 'jotihunt', externalId: 'site-1' }),
    marker('m-own', {}),
  ];

  test('the jotihunt marker carrying the hunt siteKey', () => {
    expect(huntMarkerId('h1', hunts, markers)).toBe('m1');
  });

  test('undefined without a marker, an unknown hunt or while loading', () => {
    expect(huntMarkerId('h2', hunts, markers)).toBeUndefined();
    expect(huntMarkerId('h3', hunts, markers)).toBeUndefined();
    expect(huntMarkerId('h1', undefined, markers)).toBeUndefined();
    expect(huntMarkerId('h1', hunts, undefined)).toBeUndefined();
  });
});
