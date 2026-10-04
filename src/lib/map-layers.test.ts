import { describe, expect, test } from 'bun:test';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import type { Position } from '@/types/Position';
import type { Team } from '@/types/Team';
import {
  accuracyCircles,
  hunterFeatures,
  hunterImageId,
  layerStackMoves,
  markerFeatures,
  markerImageId,
  parseHunterImageId,
  parseTeamPinImageId,
  teamCircles,
  teamPinFeatures,
  teamPinImageId,
  trailLines,
} from './map-layers';

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
  test('one point per marker with what the symbol layer, tooltip and click need', () => {
    const time = '2026-10-17T12:00:00.000Z';
    const fc = markerFeatures([{ _id: 'm1', area: 'Alpha', time: time as unknown as Date, type: MarkerType.Hunt, location: { type: 'Point', coordinates: [5.1, 52.2] } }]);
    expect(fc.features).toEqual([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [5.1, 52.2] }, properties: { id: 'm1', type: MarkerType.Hunt, area: 'Alpha', time: Date.parse(time), icon: 'fox-hunt' } },
    ]);
  });
});

describe('markerImageId', () => {
  test('one map image per marker type, the plain fox for unknown types', () => {
    expect(markerImageId(MarkerType.Hint)).toBe('fox-hint');
    expect(markerImageId(MarkerType.Hunt)).toBe('fox-hunt');
    expect(markerImageId(MarkerType.Spot)).toBe('fox-spot');
    expect(markerImageId('other' as MarkerType)).toBe('fox');
  });
});

describe('teamPinFeatures', () => {
  test('one point per team with its area colour, visited state and pin images', () => {
    const teams = [{ ...team('a', 'Alpha'), apiId: 7, name: 'Groep A' }, { ...team('b'), apiId: 8 }];
    const fc = teamPinFeatures(teams, new Set([7]), colorFor);
    expect(fc.features).toEqual([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [5.9, 52] },
        properties: { id: 'a', icon: 'team-pin|color-Alpha|visited', hoverIcon: 'team-pin|color-Alpha|visited|hover' },
      },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [5.9, 52] }, properties: { id: 'b', icon: 'team-pin|none|', hoverIcon: 'team-pin|none||hover' } },
    ]);
  });
});

describe('teamPinImageId', () => {
  test('round-trips colour, visited badge and hover', () => {
    for (const [color, visited, hover] of [
      ['#f87171', true, false],
      ['#ffffff', false, true],
    ] as const) {
      expect(parseTeamPinImageId(teamPinImageId(color, visited, hover))).toEqual({ color, visited, hover });
    }
  });
  test('other images are not team pins', () => {
    expect(parseTeamPinImageId('fox-hunt')).toBeUndefined();
    expect(parseTeamPinImageId('hunter|car|live')).toBeUndefined();
  });
});

describe('hunterFeatures', () => {
  const pos = (deviceId: number, speed: number, fixTime: string) => ({ ...position(deviceId, 10), deviceName: `Hunter ${deviceId}`, speed, course: 90, fixTime });
  test('vehicle icon, grey when stale, heading arrow only when moving with a recent fix', () => {
    const fc = hunterFeatures([pos(1, 3, 'recent'), pos(2, 3, 'old'), pos(3, 0, 'recent')], (id) => (id === 1 ? 'car' : 'phone'), (fixTime) => fixTime === 'old');
    expect(fc.features.map((f) => f.properties)).toEqual([
      { id: 1, icon: 'hunter|car|live', hoverIcon: 'hunter|car|live|hover', course: 90, moving: true },
      { id: 2, icon: 'hunter|phone|stale', hoverIcon: 'hunter|phone|stale|hover', course: 90, moving: false },
      { id: 3, icon: 'hunter|phone|live', hoverIcon: 'hunter|phone|live|hover', course: 90, moving: false },
    ]);
    expect(fc.features[0].geometry).toEqual({ type: 'Point', coordinates: [5.9, 52] });
  });
});

describe('hunterImageId', () => {
  test('round-trips icon, stale and hover', () => {
    expect(parseHunterImageId(hunterImageId('bike', true, true))).toEqual({ icon: 'bike', stale: true, hover: true });
    expect(parseHunterImageId(hunterImageId('phone', false))).toEqual({ icon: 'phone', stale: false, hover: false });
  });
  test('unknown icons and other images are not hunters', () => {
    expect(parseHunterImageId('hunter|boat|live')).toBeUndefined();
    expect(parseHunterImageId('team-pin|#fff|')).toBeUndefined();
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
