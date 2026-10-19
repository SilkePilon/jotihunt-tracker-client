import { describe, expect, test } from 'bun:test';
import { fastfoodStatus, restaurantAddress, shownBrands } from './fastfood';

// Saturday 17 Oct 2026, 23:40 Dutch time
const NOW = Date.parse('2026-10-17T23:40:00+02:00');
const iv = (start: string, end: string) => ({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });

describe('fastfoodStatus', () => {
  test('open with more than 30 minutes left', () => {
    expect(fastfoodStatus([iv('2026-10-17T08:30:00+02:00', '2026-10-18T01:30:00+02:00')], NOW)).toEqual({
      state: 'open',
      title: 'Open tot 01:30',
      meta: 'nog 1 u 50 min',
      short: 'open tot 01:30',
    });
  });
  test('whole hours leave the minutes out', () => {
    expect(fastfoodStatus([iv('2026-10-17T08:30:00+02:00', '2026-10-18T01:40:00+02:00')], NOW).meta).toBe('nog 2 u');
  });
  test('closing within 30 minutes', () => {
    expect(fastfoodStatus([iv('2026-10-17T10:00:00+02:00', '2026-10-18T00:00:00+02:00')], NOW)).toEqual({
      state: 'closing',
      title: 'Sluit om 00:00',
      meta: 'nog 20 min',
      short: 'sluit om 00:00',
    });
  });
  test('exactly 30 minutes left is closing', () => {
    expect(fastfoodStatus([iv('2026-10-17T10:00:00+02:00', '2026-10-18T00:10:00+02:00')], NOW).state).toBe('closing');
  });
  test('closed, opening tomorrow', () => {
    expect(fastfoodStatus([iv('2026-10-18T09:00:00+02:00', '2026-10-18T22:00:00+02:00')], NOW)).toEqual({
      state: 'closed',
      title: 'Dicht',
      meta: 'opent morgen 09:00',
      short: 'dicht',
    });
  });
  test('closed, opening later today', () => {
    const morning = Date.parse('2026-10-17T07:00:00+02:00');
    expect(fastfoodStatus([iv('2026-10-17T08:30:00+02:00', '2026-10-17T22:00:00+02:00')], morning).meta).toBe('opent vandaag 08:30');
  });
  test('closed, opening on a later weekday', () => {
    expect(fastfoodStatus([iv('2026-10-19T10:00:00+02:00', '2026-10-19T22:00:00+02:00')], NOW).meta).toBe('opent maandag 10:00');
  });
  test('closed the whole window', () => {
    expect(fastfoodStatus([], NOW)).toEqual({ state: 'closed', title: 'Dicht', meta: 'opent niet in de komende week', short: 'dicht' });
  });
  test('past intervals are skipped', () => {
    expect(fastfoodStatus([iv('2026-10-17T08:00:00+02:00', '2026-10-17T22:00:00+02:00'), iv('2026-10-18T09:00:00+02:00', '2026-10-18T22:00:00+02:00')], NOW).meta).toBe('opent morgen 09:00');
  });
  test('an interval running to the end of the window is day and night', () => {
    expect(fastfoodStatus([iv('2026-10-17T23:40:00+02:00', '2026-10-25T23:40:00+01:00')], NOW)).toEqual({
      state: 'open',
      title: 'Dag en nacht open',
      meta: 'de hele week',
      short: 'dag en nacht open',
    });
  });
  test('unknown hours', () => {
    expect(fastfoodStatus(undefined, NOW)).toEqual({ state: 'unknown', title: 'Openingstijden onbekend', meta: 'niet bekend in OpenStreetMap' });
  });
});

describe('shownBrands', () => {
  test('in fixed order, only the switched-on ones', () => {
    expect(shownBrands({ showMcDonalds: true, showKfc: false, showBurgerKing: true })).toEqual(['mcdonalds', 'burgerking']);
    expect(shownBrands({ showMcDonalds: false, showKfc: false, showBurgerKing: false })).toEqual([]);
  });
});

describe('restaurantAddress', () => {
  test('street + number, then postcode + city', () => {
    const base = { osmId: 'node/1', brand: 'kfc' as const, location: { type: 'Point' as const, coordinates: [5, 52] as [number, number] }, updatedAt: '' };
    expect(restaurantAddress({ ...base, street: 'Rijnstraat', houseNumber: '36', postcode: '6811EW', city: 'Arnhem' })).toEqual({ line1: 'Rijnstraat 36', line2: '6811 EW Arnhem' });
    expect(restaurantAddress({ ...base, city: 'Arnhem' })).toEqual({ line1: undefined, line2: 'Arnhem' });
  });
});
