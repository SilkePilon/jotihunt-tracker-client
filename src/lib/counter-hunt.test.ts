import { describe, expect, test } from 'bun:test';
import { formatClock } from './format';
import {
  counterHuntDirection,
  counterHuntLastText,
  counterHuntRefreshInterval,
  counterHuntState,
  counterHuntSummary,
  counterHuntTitle,
  minutesLeft,
} from './counter-hunt';
import type { CounterHuntView } from '@/types/Telegram';

const START = '2026-10-17T19:14:00.000Z';
const END = '2026-10-17T19:44:00.000Z';
const at = (iso: string) => Date.parse(iso);
const active = (direction: number | null): CounterHuntView => ({ active: true, direction, startedAt: START, endsAt: END });

describe('counterHuntDirection', () => {
  test('finds the 8 directions only', () => {
    expect(counterHuntDirection(45)?.short).toBe('NO');
    expect(counterHuntDirection(270)?.from).toBe('het westen');
    expect(counterHuntDirection(10)).toBeUndefined();
    expect(counterHuntDirection(null)).toBeUndefined();
  });
});

describe('minutesLeft', () => {
  test('rounds up and never goes negative', () => {
    expect(minutesLeft(END, at('2026-10-17T19:20:00.000Z'))).toBe(24);
    expect(minutesLeft(END, at('2026-10-17T19:20:30.000Z'))).toBe(24);
    expect(minutesLeft(END, at('2026-10-17T19:43:59.000Z'))).toBe(1);
    expect(minutesLeft(END, at('2026-10-17T20:00:00.000Z'))).toBe(0);
  });
});

describe('counterHuntState', () => {
  test('undefined while loading', () => {
    expect(counterHuntState(undefined, 0)).toBeUndefined();
  });

  test('active until endsAt', () => {
    expect(counterHuntState(active(45), at('2026-10-17T19:20:00.000Z'))).toEqual({ kind: 'active', direction: 45, startedAt: START, endsAt: END, text: undefined });
  });

  test('an active view whose time ran out between polls is quiet, with it as the last one', () => {
    expect(counterHuntState(active(45), at(END))).toEqual({ kind: 'quiet', last: { direction: 45, startedAt: START } });
  });

  test('quiet keeps the last tegenhunt', () => {
    expect(counterHuntState({ active: false, last: { direction: null, startedAt: START } }, 0)).toEqual({ kind: 'quiet', last: { direction: null, startedAt: START } });
    expect(counterHuntState({ active: false }, 0)).toEqual({ kind: 'quiet', last: undefined });
  });
});

test('counterHuntRefreshInterval: 10 s while active, else 30 s', () => {
  expect(counterHuntRefreshInterval(active(0))).toBe(10_000);
  expect(counterHuntRefreshInterval({ active: false })).toBe(30_000);
  expect(counterHuntRefreshInterval(undefined)).toBe(30_000);
});

test('counterHuntTitle', () => {
  expect(counterHuntTitle(45)).toBe('Tegenhunt uit het noordoosten');
  expect(counterHuntTitle(null)).toBe('Tegenhunt!');
});

test('counterHuntLastText', () => {
  const clock = formatClock(START);
  expect(counterHuntLastText({ direction: 45, startedAt: START })).toBe(`Laatste: ${clock} uit het noordoosten`);
  expect(counterHuntLastText({ direction: null, startedAt: START })).toBe(`Laatste: ${clock}`);
});

describe('counterHuntSummary', () => {
  const now = at('2026-10-17T19:20:00.000Z');

  test('active: direction and minutes in red', () => {
    expect(counterHuntSummary(counterHuntState(active(45), now), true, now)).toEqual({ text: 'NO ↗\uFE0E · nog 24 min', tone: 'danger' });
    expect(counterHuntSummary(counterHuntState(active(null), now), true, now)).toEqual({ text: 'nog 24 min', tone: 'danger' });
  });

  test('quiet: "Geen", or an amber warning when Telegram is not linked', () => {
    expect(counterHuntSummary({ kind: 'quiet' }, true, now)).toEqual({ text: 'Geen' });
    expect(counterHuntSummary({ kind: 'quiet' }, undefined, now)).toEqual({ text: 'Geen' });
    expect(counterHuntSummary({ kind: 'quiet' }, false, now)).toEqual({ text: 'Niet gekoppeld', tone: 'warn' });
  });

  test('an active tegenhunt wins over "not linked"', () => {
    expect(counterHuntSummary(counterHuntState(active(0), now), false, now)?.tone).toBe('danger');
  });

  test('nothing while loading', () => {
    expect(counterHuntSummary(undefined, true, now)).toBeUndefined();
  });
});
