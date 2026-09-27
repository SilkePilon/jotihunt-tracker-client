import { describe, expect, test } from 'bun:test';
import type { GroupVisit, Prediction, PredictionCandidate } from '@/types/Prediction';
import {
  accuracyLabel,
  buildPredictionGeoJson,
  candidateLabel,
  predictionStatusText,
  predictionSummary,
  visitSelection,
  visitStatusText,
} from './prediction';

// Local times, so the expected labels don't depend on the machine's time zone
const eta = new Date(2026, 9, 17, 14, 20).toISOString();
const square = { type: 'Polygon' as const, coordinates: [[[5, 52], [5.1, 52], [5.1, 52.1], [5, 52]]] };

function candidate(overrides: Partial<PredictionCandidate> = {}): PredictionCandidate {
  return { teamApiId: 1, name: 'Scouting Test', lng: 5.5, lat: 52.1, probability: 0.62, travelMinutes: 14, eta, via: 'walk', overdue: false, ...overrides };
}

function prediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    area: 'alpha',
    status: 'green',
    mode: 'walking',
    estimate: false,
    transitUnavailable: false,
    lastObservation: { time: eta, lng: 5.4, lat: 52.0, kind: 'hint' },
    zone: { core: square, outer: square, islands: [] },
    candidates: [candidate()],
    accuracy: { top1Hits: 3, top3Hits: 7, evaluations: 9 },
    updatedAt: eta,
    paused: false,
    round: 1,
    ...overrides,
  };
}

function visit(overrides: Partial<GroupVisit> = {}): GroupVisit {
  return { area: 'alpha', teamApiId: 1, round: 1, state: 'visited', source: 'auto', visitedAt: null, ...overrides };
}

describe('candidateLabel', () => {
  test('probability and ETA', () => expect(candidateLabel(candidate())).toBe('62% · ~14:20'));
  test('transit prefix', () => expect(candidateLabel(candidate({ via: 'transit' }))).toBe('🚆 62% · ~14:20'));
  test('overdue', () => expect(candidateLabel(candidate({ overdue: true }))).toBe('62% · had er al kunnen zijn'));
});

describe('accuracyLabel', () => {
  test('top-3 hits of evaluations', () => expect(accuracyLabel({ top1Hits: 3, top3Hits: 7, evaluations: 9 })).toBe('top-3 7/9'));
  test('no evaluations yet', () => expect(accuracyLabel({ top1Hits: 0, top3Hits: 0, evaluations: 0 })).toBe('top-3 –'));
});

describe('predictionStatusText', () => {
  test('paused shows the reason', () => {
    expect(predictionStatusText(prediction({ paused: true, reason: 'Inactief, voorspelling gepauzeerd', candidates: [] }))).toBe('Inactief, voorspelling gepauzeerd');
  });
  test('reason without pause', () => {
    expect(predictionStatusText(prediction({ reason: 'Nog geen waarnemingen', candidates: [] }))).toBe('Nog geen waarnemingen');
  });
  test('no candidates left', () => {
    expect(predictionStatusText(prediction({ candidates: [] }))).toBe('Geen kandidaten meer in deze ronde');
  });
  test('active prediction has no status text', () => expect(predictionStatusText(prediction())).toBeNull());
});

describe('predictionSummary', () => {
  test('counts active predictions', () => {
    expect(predictionSummary(undefined)).toBeUndefined();
    expect(predictionSummary([prediction(), prediction({ area: 'bravo', paused: true, candidates: [] })])).toBe('1 actief');
    expect(predictionSummary([])).toBe('Geen actieve');
  });
});

describe('visit helpers', () => {
  test('no visit doc → automatic, not visited', () => {
    expect(visitSelection(undefined)).toBe('auto');
    expect(visitStatusText(undefined)).toBe('Nog niet bezocht (automatisch)');
  });

  test('manual override', () => {
    const manual = visit({ state: 'not_visited', source: 'manual' });
    expect(visitSelection(manual)).toBe('not_visited');
    expect(visitStatusText(manual)).toBe('Niet bezocht (handmatig) · ronde 1');
  });

  test('automatic visit with time', () => {
    const auto = visit({ round: 2, visitedAt: new Date(2026, 9, 17, 14, 5).toISOString() });
    expect(visitSelection(auto)).toBe('auto');
    expect(visitStatusText(auto)).toBe('Bezocht (automatisch, 14:05) · ronde 2');
  });
});

describe('buildPredictionGeoJson', () => {
  test('zones, lines and labels for active predictions only', () => {
    const data = buildPredictionGeoJson(
      [
        prediction({ estimate: true, zone: { core: square, outer: square, islands: [square] }, candidates: [candidate(), candidate({ teamApiId: 2, lng: 5.6, probability: 0.2 })] }),
        prediction({ area: 'bravo', paused: true, candidates: [] }),
      ],
      () => '#abcdef',
    );
    expect(data.zones.features.map((feature) => feature.properties)).toEqual([
      { area: 'alpha', color: '#abcdef', kind: 'outer', estimate: true },
      { area: 'alpha', color: '#abcdef', kind: 'core', estimate: true },
      { area: 'alpha', color: '#abcdef', kind: 'island', estimate: true },
    ]);
    expect(data.lines.features).toHaveLength(2);
    expect(data.lines.features[0].geometry.coordinates).toEqual([
      [5.4, 52.0],
      [5.5, 52.1],
    ]);
    expect(data.lines.features[1].properties.probability).toBe(0.2);
    expect(data.labels[0].key).toBe('alpha-1');
    expect(data.labels[0].text).toBe('62% · ~14:20');
    expect(data.labels[0].lng).toBeCloseTo(5.45, 6);
    expect(data.labels[0].lat).toBeCloseTo(52.05, 6);
  });

  test('no lines without a last observation', () => {
    const data = buildPredictionGeoJson([prediction({ lastObservation: null })], () => '#000');
    expect(data.lines.features).toEqual([]);
    expect(data.labels).toEqual([]);
  });
});
