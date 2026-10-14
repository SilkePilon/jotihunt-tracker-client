import { describe, expect, test } from 'bun:test';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import type { Position } from '@/types/Position';
import type { Team } from '@/types/Team';
import {
  accuracyCircles,
  hunterFeatures,
  layerStackMoves,
  markerFeatures,
  predictionAreaCircles,
  PREDICTION_RADIUS_M,
  predictionPinFeatures,
  teamCircles,
  teamPinFeatures,
  trailLines,
} from './map-layers';
import { hintNumbering } from './marker-style';

function team(id: string, area?: string): Team {
  return { _id: id, apiId: 1, name: id, area, location: { type: 'Point', coordinates: [5.9, 52] } } as Team;
}

function position(deviceId: number, accuracy: number): Position {
  return { deviceId, accuracy, longitude: 5.9, latitude: 52 } as Position;
}

function marker(area: string, lng: number): Marker {
  return { area, time: new Date(), type: MarkerType.Hint, location: { type: 'Point', coordinates: [lng, 52] } };
}

const colorFor = (area: string) => (area ? `color-${area}` : 'none');

describe('teamCircles', () => {
  test('one closed polygon per team with id and area colour', () => {
    const fc = teamCircles([team('a', 'Alpha'), team('b')], colorFor);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.map((f) => f.properties)).toEqual([
      { id: 'a', color: 'color-Alpha' },
      { id: 'b', color: 'none' },
    ]);
    const ring = fc.features[0].geometry.coordinates[0];
    expect(fc.features[0].geometry.type).toBe('Polygon');
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  test('radius is in metres', () => {
    const [feature] = teamCircles([team('a')], colorFor, 1000).features;
    const lats = feature.geometry.coordinates[0].map(([, lat]) => lat);
    // 1 km is about 0.009 degrees of latitude
    expect(Math.max(...lats) - 52).toBeCloseTo(0.009, 3);
  });

  test('uses the area colours by default', () => {
    expect(teamCircles([team('a', 'Alpha')]).features[0].properties.color).toBe('#f87171');
  });
});

describe('accuracyCircles', () => {
  test('skips positions without a usable accuracy (device id 0 is kept)', () => {
    const fc = accuracyCircles([position(0, 15), position(2, 0), position(3, Number.NaN)]);
    expect(fc.features.map((f) => f.properties.deviceId)).toEqual([0]);
  });
});

describe('trailLines', () => {
  test('one coloured line per area with at least two markers, in order', () => {
    const fc = trailLines({ Alpha: [marker('Alpha', 5), marker('Alpha', 6)], Bravo: [marker('Bravo', 7)] }, colorFor);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties).toEqual({ area: 'Alpha', color: 'color-Alpha' });
    expect(fc.features[0].geometry.coordinates).toEqual([
      [5, 52],
      [6, 52],
    ]);
  });
});

describe('markerFeatures', () => {
  const now = Date.parse('2026-10-17T12:00:00.000Z');
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString() as unknown as Date;
  const fox = (id: string, type: MarkerType, area: string, minutesAgo = 1): Marker => ({ _id: id, area, time: at(minutesAgo), type, location: { type: 'Point', coordinates: [5.1, 52.2] } });
  const statusOf = (area: string) => ({ alpha: 'green', bravo: 'orange' })[area.toLowerCase()];
  const numbering = { numberOf: (id: string) => (id === 'h1' ? 3 : undefined) };

  test('one point per marker with what the symbol layer, tooltip and click need', () => {
    const fc = markerFeatures([fox('m1', MarkerType.Hunt, 'Alpha')], { statusOf, numbering, nowMs: now });
    expect(fc.features).toEqual([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [5.1, 52.2] }, properties: { id: 'm1', type: MarkerType.Hunt, area: 'Alpha', time: now - 60_000, icon: 'fox|hunt|green|alpha', hint: false } },
    ]);
  });

  test('spots take their area status (unknown = red); unknown types and areas still get a marker', () => {
    const fc = markerFeatures([fox('a', MarkerType.Spot, 'alpha'), fox('b', MarkerType.Spot, 'bravo'), fox('c', MarkerType.Spot, 'charlie'), fox('d', 'other' as MarkerType, 'zulu')], { statusOf, numbering, nowMs: now });
    expect(fc.features.map((f) => f.properties.icon)).toEqual(['fox|spot|green|alpha', 'fox|spot|orange|bravo', 'fox|spot|red|charlie', 'fox|other|red|none']);
  });

  test('spots and hunts of a forbidden area get the locked icon; hints and unknown areas never', () => {
    const isForbidden = (area: string) => area.toLowerCase() !== 'alpha';
    const fc = markerFeatures(
      [fox('a', MarkerType.Spot, 'alpha'), fox('b', MarkerType.Spot, 'Bravo'), fox('c', MarkerType.Hunt, 'charlie'), fox('h1', MarkerType.Hint, 'bravo'), fox('d', 'other' as MarkerType, 'zulu')],
      { statusOf, numbering, nowMs: now, isForbidden },
    );
    expect(fc.features.map((f) => f.properties.icon)).toEqual(['fox|spot|green|alpha', 'fox|spot|orange|bravo|locked', 'fox|hunt|red|charlie|locked', 'hint|bravo|H3', 'fox|other|red|none']);
  });

  test('hints: "H<n>" label, the clock without a number, a dot when old', () => {
    const fc = markerFeatures([fox('h1', MarkerType.Hint, 'alpha'), fox('h2', MarkerType.Hint, 'bravo', 30), fox('h3', MarkerType.Hint, 'bravo', 7 * 60)], { statusOf, numbering, nowMs: now });
    // 11:30 UTC is 13:30 in Amsterdam (summer time), whatever the test machine's zone
    const clock = '13:30';
    expect(fc.features.map((f) => [f.properties.icon, f.properties.hint])).toEqual([
      ['hint|alpha|H3', true],
      [`hint|bravo|${clock}`, true],
      ['hintdot', true],
    ]);
  });

  test('works with the real numbering', () => {
    const fc = markerFeatures([fox('h1', MarkerType.Hint, 'alpha')], { statusOf, numbering: hintNumbering(undefined, { startMs: 0, endMs: 0 }), nowMs: now });
    expect(fc.features[0].properties.icon).toStartWith('hint|alpha|');
  });
});

describe('teamPinFeatures', () => {
  test('one point per team: a group marker in its area colour, with the visited badge', () => {
    const teams = [{ ...team('a', 'Alpha'), apiId: 7, name: 'Groep A' }, { ...team('b'), apiId: 8 }];
    const fc = teamPinFeatures(teams, new Set([7]));
    expect(fc.features).toEqual([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [5.9, 52] }, properties: { id: 'a', icon: 'group|alpha|visited' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [5.9, 52] }, properties: { id: 'b', icon: 'group|none|open' } },
    ]);
  });
});

describe('hunterFeatures', () => {
  const pos = (deviceId: number, speed: number, fixTime: string) => ({ ...position(deviceId, 10), deviceName: `Hunter ${deviceId}`, speed, course: 90, fixTime });
  test('vehicle icon, grey when stale, heading arrow only when moving with a recent fix', () => {
    const fc = hunterFeatures([pos(1, 3, 'recent'), pos(2, 3, 'old'), pos(3, 0, 'recent')], (id) => (id === 1 ? 'car' : 'phone'), (fixTime) => fixTime === 'old');
    expect(fc.features.map((f) => f.properties)).toEqual([
      { id: 1, icon: 'hunter|car|live', course: 90, moving: true },
      { id: 2, icon: 'hunter|phone|stale', course: 90, moving: false },
      { id: 3, icon: 'hunter|phone|live', course: 90, moving: false },
    ]);
    expect(fc.features[0].geometry).toEqual({ type: 'Point', coordinates: [5.9, 52] });
  });
});

describe('predictionPinFeatures', () => {
  test('one pin per prediction, greyed out when stale', () => {
    const fc = predictionPinFeatures([
      { area: 'alpha', lng: 5, lat: 52, color: '#f87171', stale: false, confidence: 'high' },
      { area: 'Hotel', lng: 6, lat: 51, color: '#6d45fd', stale: true, confidence: null },
    ]);
    expect(fc.features).toEqual([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [5, 52] }, properties: { area: 'alpha', icon: 'predict|alpha|live' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [6, 51] }, properties: { area: 'Hotel', icon: 'predict|hotel|stale' } },
    ]);
  });

  test('pins of a forbidden area are locked (stale or not); unknown areas never', () => {
    const fc = predictionPinFeatures(
      [
        { area: 'alpha', lng: 5, lat: 52, color: '#f87171', stale: false, confidence: 'high' },
        { area: 'Bravo', lng: 6, lat: 51, color: '#6d45fd', stale: true, confidence: null },
        { area: 'zulu', lng: 6, lat: 51, color: '#6d45fd', stale: false, confidence: null },
      ],
      (area) => area.toLowerCase() !== 'alpha',
    );
    expect(fc.features.map((f) => f.properties.icon)).toEqual(['predict|alpha|live', 'predict|bravo|stale|locked', 'predict|none|live']);
  });
});

describe('predictionAreaCircles', () => {
  test('a circle around each pin, smaller when the AI is more sure (Android radii)', () => {
    expect(PREDICTION_RADIUS_M).toEqual({ high: 200, medium: 400, low: 700 });
    const fc = predictionAreaCircles([
      { area: 'alpha', lng: 5, lat: 52, color: '#f87171', stale: false, confidence: 'high' },
      { area: 'bravo', lng: 5, lat: 52, color: '#4ade80', stale: true, confidence: 'medium' },
      { area: 'charlie', lng: 5, lat: 52, color: '#60a5fa', stale: false, confidence: null },
    ]);
    expect(fc.features.map((f) => f.properties)).toEqual([{ area: 'alpha' }, { area: 'bravo' }, { area: 'charlie' }]);
    const northM = (i: number) => (Math.max(...fc.features[i].geometry.coordinates[0].map(([, lat]) => lat)) - 52) * 111_320;
    expect(northM(0)).toBeCloseTo(200, -1);
    expect(northM(1)).toBeCloseTo(400, -1);
    expect(northM(2)).toBeCloseTo(700, -1);
  });
});

describe('layerStackMoves', () => {
  const stack = [['home', 'trails'], ['fox'], ['teams'], ['hunters']];
  test('nothing to do when the stack is in order (other layers may sit in between)', () => {
    expect(layerStackMoves(['base', 'trails', 'home', 'fox', 'labels', 'teams', 'hunters', 'ruler'], stack)).toEqual([]);
  });
  test('a layer added later (e.g. toggling the home circle) goes below the groups above it', () => {
    expect(layerStackMoves(['base', 'trails', 'fox', 'teams', 'hunters', 'home'], stack)).toEqual([['home', 'fox']]);
  });
  test('foxes added after the team and hunter pins (icons still loading) end up below them', () => {
    const moves = layerStackMoves(['base', 'teams', 'hunters', 'trails', 'fox'], stack);
    expect(apply(['base', 'teams', 'hunters', 'trails', 'fox'], moves)).toEqual(['base', 'trails', 'fox', 'teams', 'hunters']);
  });
  test('any order ends up stacked', () => {
    const permutations = (list: string[]): string[][] => (list.length <= 1 ? [list] : list.flatMap((id) => permutations(list.filter((other) => other !== id)).map((rest) => [id, ...rest])));
    for (const order of permutations(['home', 'trails', 'fox', 'teams', 'hunters', 'ruler'])) {
      const result = apply(order, layerStackMoves(order, stack));
      const rank = (id: string) => stack.findIndex((group) => group.includes(id));
      const ranks = result.filter((id) => id !== 'ruler').map(rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(result.filter((id) => id !== 'ruler').length).toBe(5);
    }
  });
  test('missing layers are skipped', () => {
    expect(apply(['hunters', 'home'], layerStackMoves(['hunters', 'home'], stack))).toEqual(['home', 'hunters']);
    expect(layerStackMoves([], stack)).toEqual([]);
  });

  /** map.moveLayer(id, beforeId) on a plain list */
  function apply(order: string[], moves: [string, string][]): string[] {
    const result = [...order];
    for (const [id, beforeId] of moves) {
      result.splice(result.indexOf(id), 1);
      result.splice(result.indexOf(beforeId), 0, id);
    }
    return result;
  }
});
