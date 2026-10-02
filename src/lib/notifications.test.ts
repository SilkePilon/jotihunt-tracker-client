import { describe, expect, test } from 'bun:test';
import { mergeFeed, shouldAlert, soundKey, toastKind, type AppNotification } from './notifications';

const n = (overrides: Partial<AppNotification>): AppNotification => ({ id: '1', type: 'hint', title: 't', body: '', urgent: false, data: {}, createdAt: '2026-10-17T20:00:00Z', ...overrides });

describe('shouldAlert', () => {
  test('respects disabled types, broadcast always alerts', () => {
    expect(shouldAlert('hint', ['hint'])).toBe(false);
    expect(shouldAlert('hint', [])).toBe(true);
    expect(shouldAlert('broadcast', ['broadcast'])).toBe(true);
  });
});

describe('soundKey / toastKind', () => {
  test('green fox is urgent', () => {
    expect(soundKey(n({ type: 'fox-status', data: { status: 'green' } }))).toBe('fox-green');
    expect(soundKey(n({ type: 'fox-status', data: { status: 'red' } }))).toBe('fox-status');
    expect(soundKey(n({ type: 'hunt-deadline' }))).toBe('deadline');
    expect(toastKind(n({ type: 'fox-status', data: { status: 'green' } }))).toBe('success');
    expect(toastKind(n({ type: 'broadcast' }))).toBe('warning');
    expect(toastKind(n({ type: 'article' }))).toBe('info');
  });
});

describe('mergeFeed', () => {
  test('drops already seen ids and keeps the seen set bounded', () => {
    const seen = new Set(['1']);
    const fresh = mergeFeed(seen, [n({ id: '1' }), n({ id: '2' })]);
    expect(fresh.map((item) => item.id)).toEqual(['2']);
    expect(seen.has('2')).toBe(true);
  });
});
