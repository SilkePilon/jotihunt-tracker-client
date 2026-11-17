import { describe, expect, test } from 'bun:test';
import { connectionProblem, connectionSnapshot, feedKey, problemLabel, reportFetchError, reportFetchSuccess, reportResume, resetConnection, staleAge, staleLabel, isCriticalFeedKey } from './connection';

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
    expect(connectionProblem({ startedAt: NOW, overall: { lastSuccessAt: NOW, lastErrorAt: null }, feeds: {}, anySuccess: false }, false, NOW)).toEqual({ ageMs: null, feeds: [], offline: true });
  });

  test('a failing /areas poll shows even while /hunts keeps succeeding', () => {
    const problem = connectionProblem(snapshot({ '/areas': { lastSuccessAt: NOW - 90_000, lastErrorAt: NOW - 2000 }, '/hunts': { lastSuccessAt: NOW - 1000, lastErrorAt: null } }), true, NOW);
    expect(problem).toEqual({ ageMs: 90_000, feeds: ['vossen'], offline: true });
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
    expect(problemLabel({ ageMs: 120_000, feeds: ['vossen', 'hunts'], offline: true })).toBe('Vossen en hunts niet bijgewerkt — 2 min oud');
  });

  test('more than two feeds are summarised, so the badge fits a phone', () => {
    expect(problemLabel({ ageMs: 120_000, feeds: ['vossen', 'hunts', 'markers'], offline: false })).toBe('Meerdere gegevens niet bijgewerkt — 2 min oud');
    expect(problemLabel({ ageMs: null, feeds: ['vossen', 'hunts', 'markers', 'hints'], offline: false })).toBe('Meerdere gegevens niet geladen');
  });

  test('HTTP errors while online are not "Geen verbinding"', () => {
    const overall = { lastSuccessAt: NOW - 3 * 60_000, lastErrorAt: NOW - 1000, networkError: false };
    expect(problemLabel(connectionProblem(snapshot({}, true, overall), true, NOW)!)).toBe('Geen actuele gegevens — 3 min oud');
    // The same while the browser is offline, or when requests got no answer
    expect(problemLabel(connectionProblem(snapshot({}, true, overall), false, NOW)!)).toBe('Geen verbinding — gegevens 3 min oud');
    expect(problemLabel(connectionProblem(snapshot({}, true, { ...overall, networkError: true }), true, NOW)!)).toBe('Geen verbinding — gegevens 3 min oud');
    expect(problemLabel({ ageMs: null, feeds: [], offline: false })).toBe('Geen actuele gegevens');
  });
});

describe('reporting', () => {
  test('success on one feed does not hide another failing feed', () => {
    resetConnection(NOW - 200_000);
    reportFetchSuccess('/areas', NOW - 150_000);
    reportFetchError('/areas?x=1', NOW - 2000);
    reportFetchSuccess('/hunts', NOW - 1000);
    expect(connectionProblem(connectionSnapshot(), true, NOW)?.feeds).toEqual(['vossen']);
    reportFetchError('/areas', NOW - 500, false);
    expect(connectionSnapshot().overall.networkError).toBe(false);
    expect(feedKey('/hunts?since=1')).toBe('/hunts');
  });
});

describe('network error flag', () => {
  test('a success clears an earlier "no answer"; a later HTTP error reads "Geen actuele gegevens"', () => {
    resetConnection(NOW - 300_000);
    reportFetchError('/areas', NOW - 250_000, true);
    expect(connectionSnapshot().overall.networkError).toBe(true);
    reportFetchSuccess('/areas', NOW - 200_000);
    expect(connectionSnapshot().overall.networkError).toBe(false);
    reportFetchError('/areas', NOW - 1000, false);
    expect(problemLabel(connectionProblem(connectionSnapshot(), true, NOW)!)).toBe('Geen actuele gegevens — 3 min oud');
  });
});

describe('per-feed tracking of the sidebar feeds', () => {
  test('hints, predictions and bot messages (query left off) are tracked and named', () => {
    resetConnection(NOW - 120_000);
    reportFetchSuccess('/hints/board', NOW - 90_000);
    reportFetchError('/hints/board', NOW - 2000);
    reportFetchSuccess('/predictions', NOW - 90_000);
    reportFetchError('/predictions', NOW - 2000);
    reportFetchSuccess('/telegram/messages?limit=50', NOW - 1000);
    reportFetchSuccess('/areas', NOW - 1000);
    const snapshot = connectionSnapshot();
    expect(Object.keys(snapshot.feeds).sort()).toEqual(['/areas', '/hints/board', '/predictions', '/telegram/messages']);
    const problem = connectionProblem(snapshot, true, NOW);
    expect(problem).toEqual({ ageMs: 90_000, feeds: ['hints', 'voorspellingen'], offline: false });
    expect(problemLabel(problem!)).toBe('Hints en voorspellingen niet bijgewerkt — 1 min oud');
  });
});

describe('back from the background', () => {
  test('old data shows a neutral "Bijwerken…" until the next success', () => {
    resetConnection(NOW - 800_000);
    reportFetchSuccess('/areas', NOW - 720_000);
    // Nothing failed while the tab slept: no problem by the stale rules alone
    expect(connectionProblem(connectionSnapshot(), true, NOW)).toBeNull();
    reportResume(NOW);
    const problem = connectionProblem(connectionSnapshot(), true, NOW);
    expect(problem).toEqual({ ageMs: 720_000, feeds: [], offline: false, refreshing: true });
    expect(problemLabel(problem!)).toBe('Bijwerken… gegevens 12 min oud');
    reportFetchSuccess('/areas', NOW + 500);
    expect(connectionProblem(connectionSnapshot(), true, NOW + 500)).toBeNull();
  });

  test('an error ends it: from there the usual stale rules decide', () => {
    resetConnection(NOW - 800_000);
    reportFetchSuccess('/areas', NOW - 720_000);
    reportResume(NOW);
    reportFetchError('/areas', NOW + 500, true);
    const problem = connectionProblem(connectionSnapshot(), true, NOW + 500);
    expect(problem?.refreshing).toBeUndefined();
    expect(problemLabel(problem!)).toBe('Geen verbinding — gegevens 12 min oud');
  });

  test('recent data or offline: no neutral state', () => {
    resetConnection(NOW - 30_000);
    reportFetchSuccess('/areas', NOW - 30_000);
    reportResume(NOW);
    expect(connectionProblem(connectionSnapshot(), true, NOW)).toBeNull();
    resetConnection(NOW - 800_000);
    reportFetchSuccess('/areas', NOW - 720_000);
    reportResume(NOW);
    expect(connectionProblem(connectionSnapshot(), false, NOW)?.refreshing).toBeUndefined();
  });
});

describe('isCriticalFeedKey', () => {
  test('matches SWR keys of the critical feeds, query or not', () => {
    expect(isCriticalFeedKey(['/markers', 'Bearer x'])).toBe(true);
    expect(isCriticalFeedKey(['/hunts?since=2026', 'Bearer x'])).toBe(true);
  });

  test('other feeds and other key shapes are not', () => {
    expect(isCriticalFeedKey(['/score', 'Bearer x'])).toBe(false);
    expect(isCriticalFeedKey('/markers')).toBe(false);
    expect(isCriticalFeedKey(null)).toBe(false);
  });
});
