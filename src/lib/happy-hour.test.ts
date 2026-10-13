import { describe, expect, test } from 'bun:test';
import { formatClock } from './format';
import { happyHourExplanation, happyHourPill, happyHourPillText, happyHourRefreshInterval, happyHourWindow } from './happy-hour';
import type { HappyHourView } from '@/types/Telegram';

const START = '2026-10-17T19:00:00.000Z';
const END = '2026-10-17T20:00:00.000Z';
const at = (iso: string) => Date.parse(iso);
const view = (state: 'upcoming' | 'active'): HappyHourView => ({ state, startsAt: START, endsAt: END, text: 'HAPPY HOUR!' });

describe('happyHourWindow', () => {
  test('nothing for none or while loading', () => {
    expect(happyHourWindow({ state: 'none' }, 0)).toBeUndefined();
    expect(happyHourWindow(undefined, 0)).toBeUndefined();
  });

  test('upcoming until the start, active until the end, then gone (also between polls)', () => {
    expect(happyHourWindow(view('upcoming'), at('2026-10-17T18:48:00.000Z'))?.state).toBe('upcoming');
    expect(happyHourWindow(view('upcoming'), at(START))?.state).toBe('active');
    expect(happyHourWindow(view('active'), at('2026-10-17T19:26:00.000Z'))?.state).toBe('active');
    expect(happyHourWindow(view('active'), at(END))).toBeUndefined();
  });
});

describe('pill text', () => {
  test('active: double points and minutes left', () => {
    const now = at('2026-10-17T19:26:00.000Z');
    const window = happyHourWindow(view('active'), now)!;
    expect(happyHourPill(window, now)).toEqual({ title: 'Happy hour · 2× punten', countdown: 'nog 34 min' });
    expect(happyHourPillText(window, now)).toBe('Happy hour · 2× punten · nog 34 min');
  });

  test('upcoming: start time and minutes until it', () => {
    const now = at('2026-10-17T18:48:00.000Z');
    const window = happyHourWindow(view('upcoming'), now)!;
    expect(happyHourPillText(window, now)).toBe(`Happy hour om ${formatClock(START)} · over 12 min`);
  });

  test('minutes round up', () => {
    const now = at('2026-10-17T18:48:30.000Z');
    expect(happyHourPill(happyHourWindow(view('upcoming'), now)!, now).countdown).toBe('over 12 min');
  });
});

test('happyHourExplanation', () => {
  expect(happyHourExplanation({ startsAt: START, endsAt: END })).toBe(`Hunts tellen dubbel van ${formatClock(START)} tot ${formatClock(END)}. Tegenhunts tellen niet mee.`);
});

describe('happyHourRefreshInterval', () => {
  test('30 s normally, 10 s within 2 minutes of the start or the end', () => {
    expect(happyHourRefreshInterval({ state: 'none' }, 0)).toBe(30_000);
    expect(happyHourRefreshInterval(undefined, 0)).toBe(30_000);
    expect(happyHourRefreshInterval(view('upcoming'), at('2026-10-17T18:40:00.000Z'))).toBe(30_000);
    expect(happyHourRefreshInterval(view('upcoming'), at('2026-10-17T18:58:30.000Z'))).toBe(10_000);
    expect(happyHourRefreshInterval(view('active'), at('2026-10-17T19:30:00.000Z'))).toBe(30_000);
    expect(happyHourRefreshInterval(view('active'), at('2026-10-17T19:59:00.000Z'))).toBe(10_000);
  });
});
