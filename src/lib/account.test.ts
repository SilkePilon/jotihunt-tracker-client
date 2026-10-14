import { describe, expect, test } from 'bun:test';
import { deviceMeta, formatAgo, formatDay, orderSessions, passkeyMeta, sessionMeta, type AccountSession } from './account';

const now = Date.parse('2026-10-17T12:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatAgo', () => {
  test('zojuist, minutes, hours, gisteren, days', () => {
    expect(formatAgo(ago(30_000), now)).toBe('zojuist');
    expect(formatAgo(ago(5 * MIN), now)).toBe('5 min geleden');
    expect(formatAgo(ago(3 * HOUR), now)).toBe('3 uur geleden');
    expect(formatAgo(ago(30 * HOUR), now)).toBe('gisteren');
    expect(formatAgo(ago(5 * DAY), now)).toBe('5 dagen geleden');
    expect(formatAgo(new Date(now + MIN).toISOString(), now)).toBe('zojuist');
  });
});

describe('formatDay', () => {
  test('day and short month in Dutch, no trailing dot', () => {
    expect(formatDay('2026-10-03T10:00:00Z')).toBe('3 okt');
    expect(formatDay('2026-05-21T10:00:00Z')).toBe('21 mei');
  });
});

describe('meta lines', () => {
  test('passkey: created, last used or never used', () => {
    expect(passkeyMeta({ id: 'a', name: 'x', createdAt: '2026-10-03T10:00:00Z', lastUsedAt: ago(30_000) }, now)).toBe('Gemaakt 3 okt · laatst gebruikt zojuist');
    expect(passkeyMeta({ id: 'a', name: 'x', createdAt: '2026-10-03T10:00:00Z', lastUsedAt: null }, now)).toBe('Gemaakt 3 okt · nog niet gebruikt');
  });

  test('session: this device first, else last used; how it logged in', () => {
    const base = { id: 's', label: 'Firefox op Linux', createdAt: ago(DAY), lastUsedAt: ago(5 * MIN) };
    expect(sessionMeta({ ...base, via: 'passkey', current: true }, now)).toBe('Dit apparaat · met passkey');
    expect(sessionMeta({ ...base, via: 'qr', current: false }, now)).toBe('5 min geleden · met QR-code');
    expect(sessionMeta({ ...base, via: 'invite', current: false }, now)).toBe('5 min geleden · via invite');
    expect(sessionMeta({ ...base, via: 'herstel', current: false }, now)).toBe('5 min geleden · via herstel-link');
    expect(sessionMeta({ ...base, via: 'cli', current: false }, now)).toBe('5 min geleden · via herstel-link');
  });

  test('device: Android app and when last seen', () => {
    expect(deviceMeta({ id: 'd', name: 'Pixel', createdAt: ago(DAY), lastSeenAt: ago(3 * HOUR) }, now)).toBe('Android-app · 3 uur geleden');
    expect(deviceMeta({ id: 'd', name: 'Pixel', createdAt: ago(DAY), lastSeenAt: null }, now)).toBe('Android-app · nog niet gezien');
  });
});

describe('orderSessions', () => {
  test('current first, then most recently used', () => {
    const make = (id: string, minutesAgo: number, current = false): AccountSession => ({ id, label: id, via: 'passkey', createdAt: ago(DAY), lastUsedAt: ago(minutesAgo * MIN), current });
    expect(orderSessions([make('old', 50), make('me', 90, true), make('new', 1)]).map((s) => s.id)).toEqual(['me', 'new', 'old']);
  });
});
