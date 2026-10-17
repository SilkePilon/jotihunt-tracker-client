import { describe, expect, test } from 'bun:test';
import type { ScoreStatus } from '@/types/Score';
import { formatDelta, formatPenalty, normalizeScore, SCORE_NOT_CONFIGURED, scoreBarSegments, scoreDelta, scoreFailing, scoreFailingLine, scoreLegend, scoreLine, scoreSummary } from './score';

const NOW = Date.parse('2026-10-17T21:45:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const score = (overrides: Partial<ScoreStatus> = {}): ScoreStatus => ({
  configured: true,
  lastSuccessAt: ago(60_000),
  lastError: null,
  total: 145,
  parts: { hunts: 70, counterHunts: 20, assignments: 40, photoAssignments: 25, hints: null, penalty: 10 },
  previousTotal: 135,
  changedAt: ago(60_000),
  ...overrides,
});

describe('normalizeScore', () => {
  test('keeps a full answer', () => {
    expect(normalizeScore(score())).toEqual(score());
  });

  test('fills in missing fields', () => {
    expect(normalizeScore({ configured: true, total: 12 })).toEqual({
      ...SCORE_NOT_CONFIGURED,
      configured: true,
      total: 12,
    });
  });

  test('drops malformed values', () => {
    const result = normalizeScore({ configured: 'yes', total: '145', parts: { hunts: 'x', hints: 5 }, changedAt: 12 });
    expect(result.configured).toBe(false);
    expect(result.total).toBeNull();
    expect(result.parts.hunts).toBe(0);
    expect(result.parts.hints).toBe(5);
    expect(result.changedAt).toBeNull();
  });

  test('anything but an object is not configured', () => {
    expect(normalizeScore(null)).toEqual(SCORE_NOT_CONFIGURED);
    expect(normalizeScore([])).toEqual(SCORE_NOT_CONFIGURED);
    expect(normalizeScore('<html>')).toEqual(SCORE_NOT_CONFIGURED);
  });
});

describe('scoreDelta', () => {
  test('shows the change within 10 minutes', () => {
    expect(scoreDelta(score(), NOW)).toBe(10);
    expect(scoreDelta(score({ changedAt: ago(10 * 60_000) }), NOW)).toBe(10);
  });

  test('gone after 10 minutes', () => {
    expect(scoreDelta(score({ changedAt: ago(10 * 60_000 + 1) }), NOW)).toBeNull();
  });

  test('needs a previous total and a real change', () => {
    expect(scoreDelta(score({ previousTotal: null }), NOW)).toBeNull();
    expect(scoreDelta(score({ previousTotal: 145 }), NOW)).toBeNull();
    expect(scoreDelta(score({ changedAt: null }), NOW)).toBeNull();
    expect(scoreDelta(score({ changedAt: 'nope' }), NOW)).toBeNull();
    expect(scoreDelta(score({ total: null }), NOW)).toBeNull();
  });

  test('a drop is negative', () => {
    expect(scoreDelta(score({ previousTotal: 150 }), NOW)).toBe(-5);
  });

  test('formats with a sign', () => {
    expect(formatDelta(10)).toBe('+10');
    expect(formatDelta(-5)).toBe('−5');
  });
});

describe('scoreBarSegments', () => {
  test('hunts, tegenhunts, opdrachten, foto, hints in order with shares of the positive points', () => {
    const segments = scoreBarSegments(score().parts);
    expect(segments.map((segment) => segment.key)).toEqual(['hunts', 'counterHunts', 'assignments', 'photoAssignments', 'hints']);
    expect(segments[0].share).toBeCloseTo(70 / 155);
    expect(segments.reduce((sum, segment) => sum + segment.share, 0)).toBeCloseTo(1);
  });

  test('unknown hints and zero parts take no room', () => {
    const segments = scoreBarSegments({ hunts: 10, counterHunts: 0, assignments: 0, photoAssignments: 0, hints: null, penalty: 5 });
    expect(segments.filter((segment) => segment.share > 0).map((segment) => segment.key)).toEqual(['hunts']);
    expect(segments.find((segment) => segment.key === 'hints')?.share).toBe(0);
  });

  test('known hints count', () => {
    const segments = scoreBarSegments({ ...score().parts, hints: 45 });
    expect(segments.find((segment) => segment.key === 'hints')?.share).toBeCloseTo(45 / 200);
  });

  test('no points: every share is 0', () => {
    expect(scoreBarSegments(SCORE_NOT_CONFIGURED.parts).every((segment) => segment.share === 0)).toBe(true);
  });
});

describe('scoreLegend', () => {
  test('two columns row by row: Hunts, Opdrachten, Tegenhunts, Foto, Hints, Straf', () => {
    expect(scoreLegend(score().parts).map((entry) => entry.label)).toEqual(['Hunts', 'Opdrachten', 'Tegenhunts', 'Foto', 'Hints', 'Straf']);
  });

  test('unknown hints are muted, a penalty is red', () => {
    const legend = scoreLegend(score().parts);
    expect(legend.find((entry) => entry.key === 'hints')).toMatchObject({ value: null, tone: 'muted' });
    expect(legend.find((entry) => entry.key === 'penalty')).toMatchObject({ value: 10, tone: 'penalty' });
  });

  test('no penalty is plain', () => {
    expect(scoreLegend({ ...score().parts, penalty: 0 }).find((entry) => entry.key === 'penalty')?.tone).toBe('default');
  });

  test('penalty text', () => {
    expect(formatPenalty(10)).toBe('−10');
    expect(formatPenalty(0)).toBe('0');
  });
});

describe('lines', () => {
  test('voorlopig with the age of the last read', () => {
    expect(scoreLine(score(), NOW)).toBe('voorlopig · 1 min geleden');
    expect(scoreLine(score({ lastSuccessAt: null }), NOW)).toBe('voorlopig');
  });

  test('failing', () => {
    expect(scoreFailing(score())).toBe(false);
    const failing = score({ lastError: 'jotihunt.nl reageert niet', lastSuccessAt: ago(6 * 60_000) });
    expect(scoreFailing(failing)).toBe(true);
    expect(scoreFailingLine(failing, NOW)).toBe('laatst gelukt 6 min geleden');
    expect(scoreFailingLine(score({ lastSuccessAt: null }), NOW)).toBe('nog niet gelukt');
  });

  test('summary', () => {
    expect(scoreSummary(score())).toBe('145 pnt');
    expect(scoreSummary(score({ total: null }))).toBeUndefined();
    expect(scoreSummary(undefined)).toBeUndefined();
  });
});
