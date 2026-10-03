import { describe, expect, test } from 'bun:test';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import type { Position } from '@/types/Position';
import type { Team } from '@/types/Team';
import { accuracyCircles, teamCircles, trailLines } from './map-layers';

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
