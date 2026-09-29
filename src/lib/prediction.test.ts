import { describe, expect, test } from 'bun:test';
import type { Prediction } from '@/types/Prediction';
import { ageLabel, buildPredictionMap, CONFIDENCE_LEVEL, predictionStatusText, predictionSummary, visitSelection, visitStatusText } from './prediction';

function prediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    area: 'alpha',
    status: 'green',
    paused: false,
    updatedAt: '2026-10-17T12:00:00Z',
    round: 1,
    estimate: false,
    stale: false,
    lastObservation: { time: '2026-10-17T11:00:00Z', lng: 5.48, lat: 52.08, kind: 'hint' },
    pin: { lat: 52.09, lng: 5.5 },
    confidence: 'high',
    visitedTeamApiIds: [],
    why: 'Richting oost.',
    ...overrides,
  };
}

describe('prediction helpers', () => {
  test('ageLabel', () => {
    const t = Date.parse('2026-10-17T12:00:00Z');
    expect(ageLabel('2026-10-17T12:00:00Z', t + 30_000)).toBe('nu');
    expect(ageLabel('2026-10-17T12:00:00Z', t + 4 * 60_000)).toBe('4m');
    expect(ageLabel('2026-10-17T12:00:00Z', t + 125 * 60_000)).toBe('2u');
  });

  test('status text', () => {
    expect(predictionStatusText(prediction())).toBeNull();
    expect(predictionStatusText(prediction({ paused: true, reason: 'Inactief' }))).toBe('Inactief');
    expect(predictionStatusText(prediction({ pin: null, reason: 'Nog geen locatie' }))).toBe('Nog geen locatie');
    expect(predictionStatusText(prediction({ pin: null, stale: true, error: 'Gemini-verzoek mislukt (HTTP 503)' }))).toBe('Gemini-verzoek mislukt (HTTP 503)');
    expect(predictionStatusText(prediction({ pin: null, stale: true }))).toBe('AI-voorspelling mislukt');
    expect(predictionStatusText(prediction({ stale: true, error: 'x' }))).toBeNull();
  });

  test('confidence level is the number of filled bars', () => {
    expect([CONFIDENCE_LEVEL.low, CONFIDENCE_LEVEL.medium, CONFIDENCE_LEVEL.high]).toEqual([1, 2, 3]);
  });

  test('summary counts predictions with a pin', () => {
    expect(predictionSummary([prediction(), prediction({ area: 'b', pin: null })])).toBe('1 actief');
    expect(predictionSummary([prediction({ paused: true })])).toBe('Geen actieve');
  });

  test('visit helpers', () => {
    expect(visitSelection(undefined)).toBe('auto');
    expect(visitSelection({ area: 'a', teamApiId: 1, round: 1, state: 'visited', source: 'manual', visitedAt: null })).toBe('visited');
    expect(visitStatusText(undefined)).toBe('Nog niet bezocht (AI)');
    expect(visitStatusText({ area: 'a', teamApiId: 1, round: 2, state: 'visited', source: 'auto', visitedAt: null })).toBe('Bezocht (AI) · ronde 2');
  });

  test('buildPredictionMap: line last→pin, pin; paused and pinless skipped', () => {
    const map = buildPredictionMap([prediction(), prediction({ area: 'b', paused: true }), prediction({ area: 'c', pin: null })], () => '#f00');
    expect(map.pins).toEqual([{ area: 'alpha', lng: 5.5, lat: 52.09, color: '#f00', stale: false }]);
    expect(buildPredictionMap([prediction({ stale: true })], () => '#f00').pins[0].stale).toBe(true);
    expect(map.lines.features).toHaveLength(1);
    expect(map.lines.features[0].geometry.coordinates).toEqual([
      [5.48, 52.08],
      [5.5, 52.09],
    ]);
  });
});
