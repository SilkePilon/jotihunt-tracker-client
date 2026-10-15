import { describe, expect, test } from 'bun:test';
import { NOTIFICATION_OPTIONS, setAllTypes, toggleType, isSilent, isRecent, mergeFeed, pickPrimary, pickSound, shouldAlert, soundKey, toastKind, type AppNotification } from './notifications';

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

describe('pickSound / pickPrimary', () => {
  const orange = n({ id: 'a', type: 'fox-status', data: { status: 'orange' } });
  const green = n({ id: 'b', type: 'fox-status', data: { status: 'green' } });
  const broadcast = n({ id: 'c', type: 'broadcast' });
  const deadline = n({ id: 'd', type: 'hunt-deadline' });
  const hint = n({ id: 'e', type: 'hint' });
  const article = n({ id: 'f', type: 'article' });

  test('counter-hunt has its own sound, below green and above broadcast', () => {
    const counterHunt = n({ id: 'g', type: 'counter-hunt', data: { direction: 45 } });
    expect(soundKey(counterHunt)).toBe('counter-hunt');
    expect(pickSound([broadcast, counterHunt])).toBe('counter-hunt');
    expect(pickSound([counterHunt, green])).toBe('fox-green');
  });
  test('empty gives null', () => {
    expect(pickSound([])).toBeNull();
    expect(pickPrimary([])).toBeNull();
  });
  test('priority is green > broadcast > deadline > fox-status > hint > article', () => {
    expect(pickSound([orange, green])).toBe('fox-green');
    expect(pickSound([green, broadcast])).toBe('fox-green');
    expect(pickSound([orange, broadcast])).toBe('broadcast');
    expect(pickSound([broadcast, deadline])).toBe('broadcast');
    expect(pickSound([orange, deadline])).toBe('deadline');
    expect(pickSound([hint, orange])).toBe('fox-status');
    expect(pickSound([article, hint])).toBe('hint');
    expect(pickSound([article])).toBe('article');
  });
  test('primary is the notification itself, first wins a tie', () => {
    expect(pickPrimary([orange, green, broadcast])).toBe(green);
    expect(pickPrimary([hint, n({ id: 'g', type: 'hint' })])).toBe(hint);
  });
});

describe('isRecent', () => {
  const serverTime = '2026-10-17T20:10:00Z';
  test('within the max age', () => {
    expect(isRecent(n({ createdAt: '2026-10-17T20:09:30Z' }), serverTime, 60_000)).toBe(true);
    expect(isRecent(n({ createdAt: '2026-10-17T20:09:00Z' }), serverTime, 60_000)).toBe(true);
  });
  test('older than the max age', () => {
    expect(isRecent(n({ createdAt: '2026-10-17T20:08:59Z' }), serverTime, 60_000)).toBe(false);
  });
  test('slightly ahead of the server clock still counts', () => {
    expect(isRecent(n({ createdAt: '2026-10-17T20:10:01Z' }), serverTime, 60_000)).toBe(true);
  });
});

describe('happy hour', () => {
  test('own sound key, below broadcast and above the deadline', () => {
    const happyHour = n({ id: 'h', type: 'happy-hour', urgent: true });
    expect(soundKey(happyHour)).toBe('happy-hour');
    expect(toastKind(happyHour)).toBe('warning');
    expect(pickSound([n({ id: 'd', type: 'hunt-deadline' }), happyHour])).toBe('happy-hour');
    expect(pickSound([happyHour, n({ id: 'c', type: 'broadcast' })])).toBe('broadcast');
  });

  test('the non-urgent "voorbij" notification is silent', () => {
    const ended = n({ id: 'e', type: 'happy-hour', urgent: false });
    expect(isSilent(ended)).toBe(true);
    expect(isSilent(n({ type: 'hint', urgent: false }))).toBe(false);
    expect(pickSound([ended])).toBeNull();
    expect(pickSound([ended, n({ id: 'i', type: 'hint' })])).toBe('hint');
  });
});

describe('notification option toggles', () => {
  test('every option has a short text', () => {
    for (const option of NOTIFICATION_OPTIONS) expect(option.short.length).toBeGreaterThan(0);
  });

  test('toggleType adds and removes one type without duplicates', () => {
    expect(toggleType([], 'hint', false)).toEqual(['hint']);
    expect(toggleType(['hint'], 'hint', false)).toEqual(['hint']);
    expect(toggleType(['hint', 'article'], 'hint', true)).toEqual(['article']);
  });

  test('setAllTypes turns everything on or off', () => {
    expect(setAllTypes(true)).toEqual([]);
    expect(setAllTypes(false)).toEqual(NOTIFICATION_OPTIONS.map((option) => option.type));
  });
});
