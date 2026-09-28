import { describe, expect, test } from 'bun:test';
import type { Leaderboard, LeaderboardEntry } from '@/types/Leaderboard';
import { breakdownText, podiumOrder, teamStripText, windowText } from './leaderboard';

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    userId: 'u1',
    name: 'Merida',
    rank: 1,
    score: 19,
    hunts: 2,
    approvedHunts: 1,
    huntPoints: 10,
    hints: 1,
    distanceKm: 14.9,
    topSpeedKmh: 92,
    breakdown: { hunts: 4, huntPoints: 10, hints: 3, distance: 2 },
    ...overrides,
  };
}

function board(overrides: Partial<Leaderboard> = {}): Leaderboard {
  return {
    entries: [],
    totals: { distanceKm: 19.9, hunts: 3, hints: 3, fastest: { name: 'Mulan', speedKmh: 92 } },
    distanceSince: '2026-10-17T08:00:00.000Z',
    distanceWindow: 'hunt',
    distanceAvailable: true,
    updatedAt: '2026-10-17T12:00:00.000Z',
    ...overrides,
  };
}

describe('podiumOrder', () => {
  const [a, b, c, d] = [entry({ userId: 'a' }), entry({ userId: 'b' }), entry({ userId: 'c' }), entry({ userId: 'd' })];

  test('2-1-3 order', () => {
    expect(podiumOrder([a, b, c, d])).toEqual([b, a, c]);
  });

  test('gaps for missing places', () => {
    expect(podiumOrder([a])).toEqual([undefined, a, undefined]);
    expect(podiumOrder([a, b])).toEqual([b, a, undefined]);
    expect(podiumOrder([])).toEqual([undefined, undefined, undefined]);
  });
});

describe('breakdownText', () => {
  test('all parts', () => {
    expect(breakdownText(entry())).toBe('Hunts 2 × 2 = 4 · jotihunt.nl 10 · Hints 1 × 3 = 3 · 14,9 km = 2');
  });

  test('omits parts that are 0', () => {
    const only = entry({ hunts: 0, huntPoints: 0, distanceKm: 0, breakdown: { hunts: 0, huntPoints: 0, hints: 6, distance: 0 }, hints: 2 });
    expect(breakdownText(only)).toBe('Hints 2 × 3 = 6');
  });

  test('keeps kilometres that do not score a point yet', () => {
    const km = entry({ hunts: 0, huntPoints: 0, hints: 0, distanceKm: 3.2, breakdown: { hunts: 0, huntPoints: 0, hints: 0, distance: 0 } });
    expect(breakdownText(km)).toBe('3,2 km = 0');
  });

  test('nothing yet', () => {
    const none = entry({ hunts: 0, huntPoints: 0, hints: 0, distanceKm: 0, breakdown: { hunts: 0, huntPoints: 0, hints: 0, distance: 0 } });
    expect(breakdownText(none)).toBe('Nog geen punten');
  });
});

describe('teamStripText', () => {
  test('all parts', () => {
    expect(teamStripText(board())).toBe('Samen: 19,9 km · 3 hunts · 3 hints · snelste: Mulan 92 km/u');
  });

  test('singular and without km or fastest', () => {
    expect(teamStripText(board({ totals: { distanceKm: 0, hunts: 1, hints: 1, fastest: null } }))).toBe('Samen: 1 hunt · 1 hint');
  });

  test('rounds the top speed', () => {
    expect(teamStripText(board({ totals: { distanceKm: 1234.56, hunts: 0, hints: 2, fastest: { name: 'Elsa', speedKmh: 87.6 } } }))).toBe(
      `Samen: ${(1234.56).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} km · 0 hunts · 2 hints · snelste: Elsa 88 km/u`,
    );
  });
});

describe('windowText', () => {
  test('hunt window', () => {
    const since = new Date('2026-10-17T08:00:00.000Z').toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    expect(windowText(board())).toBe(`Kilometers sinds ${since}`);
  });

  test('today before the hunt', () => {
    expect(windowText(board({ distanceWindow: 'today' }))).toBe('Kilometers van vandaag (de hunt is nog niet begonnen)');
  });

  test('distance unavailable', () => {
    expect(windowText(board({ distanceAvailable: false }))).toBe('Kilometers tijdelijk niet beschikbaar');
    expect(windowText(board({ distanceAvailable: false, distanceWindow: 'today' }))).toBe('Kilometers tijdelijk niet beschikbaar');
  });
});
