import { describe, expect, test } from 'bun:test';
import { apiAssetUrl, DEFAULT_CONFIG, fromLocalInput, huntWindow, toLocalInput, vehicleGroupIds } from './app-config';

describe('app config helpers', () => {
  test('branding paths go to the API, other urls stay', () => {
    expect(apiAssetUrl('/branding/logo?v=1', 'https://x.dev/api')).toBe('https://x.dev/api/branding/logo?v=1');
    expect(apiAssetUrl('/logo.svg', 'https://x.dev/api')).toBe('/logo.svg');
    expect(apiAssetUrl('https://cdn/x.png', 'https://x.dev/api')).toBe('https://cdn/x.png');
  });

  test('datetime-local round trip in local time', () => {
    const iso = '2026-10-17T07:00:00.000Z';
    const local = toLocalInput(iso);
    expect(local).toMatch(/^2026-10-17T\d\d:00$/);
    expect(fromLocalInput(local)).toBe(iso);
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
  });

  test('hunt window and vehicle groups', () => {
    const config = { ...DEFAULT_CONFIG, huntStart: '2026-10-17T07:00:00.000Z', vehicleGroups: { walking: 1, bike: null, car: 3, motorcycle: null } };
    expect(huntWindow(config).start?.toISOString()).toBe('2026-10-17T07:00:00.000Z');
    expect(huntWindow(config).end).toBeNull();
    expect(vehicleGroupIds(config)).toEqual({ walking: 1, car: 3 });
  });
});
