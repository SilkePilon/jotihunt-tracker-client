import { describe, expect, test } from 'bun:test';
import { CONTINUITY_MAX_AGE_MS, freshRecord, parseSavedPage, parseSavedView, restoredSnap } from './continuity';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const VIEW = { longitude: 5.9, latitude: 52.2, zoom: 13.5, bearing: -20, pitch: 45 };
const record = (value: object, ts: number) => JSON.stringify({ ...value, ts });

describe('freshRecord', () => {
  test('a record saved within 2 h counts, an older one does not', () => {
    expect(freshRecord(record({}, NOW - 60_000), NOW)).toBeDefined();
    expect(freshRecord(record({}, NOW - CONTINUITY_MAX_AGE_MS), NOW)).toBeDefined();
    expect(freshRecord(record({}, NOW - CONTINUITY_MAX_AGE_MS - 1), NOW)).toBeUndefined();
  });

  test('a timestamp from the future is ignored (beyond a minute of clock drift)', () => {
    expect(freshRecord(record({}, NOW + 30_000), NOW)).toBeDefined();
    expect(freshRecord(record({}, NOW + 10 * 60_000), NOW)).toBeUndefined();
  });

  test('missing, unreadable or timestamp-less storage is no record', () => {
    expect(freshRecord(null, NOW)).toBeUndefined();
    expect(freshRecord('', NOW)).toBeUndefined();
    expect(freshRecord('{not json', NOW)).toBeUndefined();
    expect(freshRecord('42', NOW)).toBeUndefined();
    expect(freshRecord(JSON.stringify({ ts: 'yesterday' }), NOW)).toBeUndefined();
    expect(freshRecord(JSON.stringify({}), NOW)).toBeUndefined();
  });
});

describe('parseSavedView', () => {
  test('a fresh view comes back without its timestamp', () => {
    expect(parseSavedView(record(VIEW, NOW - 5 * 60_000), NOW)).toEqual(VIEW);
  });

  test('a stale view is dropped: the map starts at the play area again', () => {
    expect(parseSavedView(record(VIEW, NOW - 3 * 60 * 60 * 1000), NOW)).toBeUndefined();
  });

  test('a view with missing or impossible numbers is dropped', () => {
    expect(parseSavedView(record({ ...VIEW, zoom: undefined }, NOW), NOW)).toBeUndefined();
    expect(parseSavedView(record({ ...VIEW, latitude: 'x' }, NOW), NOW)).toBeUndefined();
    expect(parseSavedView(record({ ...VIEW, latitude: 120 }, NOW), NOW)).toBeUndefined();
    expect(parseSavedView(record({ ...VIEW, pitch: 120 }, NOW), NOW)).toBeUndefined();
  });
});

describe('parseSavedPage', () => {
  test('a fresh page with a known id comes back with its snap', () => {
    expect(parseSavedPage(record({ id: 'hunts', snap: 'half' }, NOW - 60_000), NOW)).toEqual({ id: 'hunts', snap: 'half' });
  });

  test('an unknown snap falls back to the whole sheet', () => {
    expect(parseSavedPage(record({ id: 'foxes', snap: 'huge' }, NOW), NOW)).toEqual({ id: 'foxes', snap: 'full' });
  });

  test('an unknown page id or a stale record restores nothing', () => {
    expect(parseSavedPage(record({ id: 'beheer', snap: 'full' }, NOW), NOW)).toBeUndefined();
    expect(parseSavedPage(record({ id: 'foxes', snap: 'full' }, NOW - CONTINUITY_MAX_AGE_MS - 1), NOW)).toBeUndefined();
  });
});

describe('restoredSnap', () => {
  test('a full page comes back at half, so the map shows first', () => {
    expect(restoredSnap('full')).toBe('half');
    expect(restoredSnap('half')).toBe('half');
    expect(restoredSnap('peek')).toBe('peek');
  });
});
