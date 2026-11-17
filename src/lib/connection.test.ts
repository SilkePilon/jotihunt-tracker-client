import { describe, expect, test } from 'bun:test';
import { connectionProblem, connectionSnapshot, feedKey, problemLabel, reportFetchError, reportFetchSuccess, resetConnection, staleAge, staleLabel } from './connection';

const NOW = 1_000_000_000;

describe('staleAge', () => {
  test('recent data is never stale', () => {
    expect(staleAge({ lastSuccessAt: NOW - 30_000, lastErrorAt: NOW - 1000 }, false, NOW)).toBeNull();
  });

  test('old data is stale after a failure since the last success', () => {
    expect(staleAge({ lastSuccessAt: NOW - 90_000, lastErrorAt: NOW - 5000 }, true, NOW)).toBe(90_000);
  });

  test('old data is stale while offline, even without a failed fetch', () => {
    expect(staleAge({ lastSuccessAt: NOW - 90_000, lastErrorAt: null }, false, NOW)).toBe(90_000);
  });

  test('old data without a failure (tab back from the background, not polled yet) is not flagged', () => {
    expect(staleAge({ lastSuccessAt: NOW - 600_000, lastErrorAt: null }, true, NOW)).toBeNull();
    expect(staleAge({ lastSuccessAt: NOW - 600_000, lastErrorAt: NOW - 700_000 }, true, NOW)).toBeNull();
  });
});

describe('staleLabel', () => {
  test('minutes, then hours', () => {
    expect(staleLabel(61_000)).toBe('Geen verbinding — gegevens 1 min oud');
    expect(staleLabel(3 * 60_000 + 5000)).toBe('Geen verbinding — gegevens 3 min oud');
    expect(staleLabel(125 * 60_000)).toBe('Geen verbinding — gegevens 2 u 5 min oud');
  });
});

describe('connectionProblem', () => {
  const START = NOW - 120_000;
  const snapshot = (feeds: Record<string, { lastSuccessAt: number | null; lastErrorAt: number | null }>, anySuccess = true, overall = { lastSuccessAt: NOW - 1000, lastErrorAt: null as number | null }) => ({
    startedAt: START,
    overall,
    feeds,
    anySuccess,
  });

  test('offline before anything loaded: at once, without an age', () => {
    expect(connectionProblem({ startedAt: NOW, overall: { lastSuccessAt: NOW, lastErrorAt: null }, feeds: {}, anySuccess: false }, false, NOW)).toEqual({ ageMs: null, feeds: [] });
  });

  test('a failing /areas poll shows even while /hunts keeps succeeding', () => {
    const problem = connectionProblem(snapshot({ '/areas': { lastSuccessAt: NOW - 90_000, lastErrorAt: NOW - 2000 }, '/hunts': { lastSuccessAt: NOW - 1000, lastErrorAt: null } }), true, NOW);
    expect(problem).toEqual({ ageMs: 90_000, feeds: ['vossen'] });
    expect(problemLabel(problem!)).toBe('Vossen niet bijgewerkt — 1 min oud');
  });

  test('a critical feed that never loaded is flagged after the grace period', () => {
    const feeds = { '/areas': { lastSuccessAt: null, lastErrorAt: NOW - 1000 } };
    expect(connectionProblem({ ...snapshot(feeds), startedAt: NOW - 5000 }, true, NOW)).toBeNull();
    expect(problemLabel(connectionProblem(snapshot(feeds), true, NOW)!)).toBe('Vossen niet geladen');
    // Nothing loaded at all: the connection as a whole
    expect(problemLabel(connectionProblem(snapshot(feeds, false), true, NOW)!)).toBe('Geen verbinding');
  });

  test('everything stale: the overall label', () => {
    const problem = connectionProblem(snapshot({}, true, { lastSuccessAt: NOW - 3 * 60_000, lastErrorAt: NOW - 1000 }), true, NOW);
    expect(problemLabel(problem!)).toBe('Geen verbinding — gegevens 3 min oud');
  });

  test('healthy feeds: no problem', () => {
    expect(connectionProblem(snapshot({ '/areas': { lastSuccessAt: NOW - 1000, lastErrorAt: NOW - 30_000 } }), true, NOW)).toBeNull();
  });

  test('several stale feeds are named together', () => {
    expect(problemLabel({ ageMs: 120_000, feeds: ['vossen', 'hunts'] })).toBe('Vossen en hunts niet bijgewerkt — 2 min oud');
  });
});

describe('reporting', () => {
  test('success on one feed does not hide another failing feed', () => {
    resetConnection(NOW - 200_000);
    reportFetchSuccess('/areas', NOW - 150_000);
    reportFetchError('/areas?x=1', NOW - 2000);
    reportFetchSuccess('/hunts', NOW - 1000);
    expect(connectionProblem(connectionSnapshot(), true, NOW)?.feeds).toEqual(['vossen']);
    expect(feedKey('/hunts?since=1')).toBe('/hunts');
  });
});
