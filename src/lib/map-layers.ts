import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson';
import type { Marker } from '@/types/Marker';
import type { Position } from '@/types/Position';
import type { Team } from '@/types/Team';
import { createCircle, getColorFromArea } from '@/lib/utils';

/** Radius of the circle drawn around each group (metres). */
export const TEAM_CIRCLE_RADIUS_M = 500;

export interface TeamCircleProperties {
  id: string;
  color: string;
}

export interface AccuracyCircleProperties {
  deviceId: number;
}

export interface TrailProperties {
  area: string;
  color: string;
}

function collection<G extends Polygon | LineString, P>(features: Feature<G, P>[]): FeatureCollection<G, P> {
  return { type: 'FeatureCollection', features };
}

function circle<P>(lng: number, lat: number, radius: number, properties: P): Feature<Polygon, P> {
  return { ...createCircle(lng, lat, radius), properties } as Feature<Polygon, P>;
}

/** One circle per team, coloured by area (for a data-driven `['get', 'color']` fill). */
export function teamCircles(teams: Team[], colorFor: (area: string) => string = getColorFromArea, radius = TEAM_CIRCLE_RADIUS_M): FeatureCollection<Polygon, TeamCircleProperties> {
  return collection(teams.map((team) => circle(team.location.coordinates[0], team.location.coordinates[1], radius, { id: team._id, color: colorFor(team.area || '') })));
}

/** GPS accuracy circle per device position; positions without a usable accuracy draw nothing. */
export function accuracyCircles(positions: Position[]): FeatureCollection<Polygon, AccuracyCircleProperties> {
  return collection(
    positions.filter((position) => Number.isFinite(position.accuracy) && position.accuracy > 0).map((position) => circle(position.longitude, position.latitude, position.accuracy, { deviceId: position.deviceId })),
  );
}

/** One line per area through its (time-sorted) markers; areas with a single marker have no line. */
export function trailLines(groups: Record<string, Marker[]>, colorFor: (area: string) => string = getColorFromArea): FeatureCollection<LineString, TrailProperties> {
  return collection(
    Object.entries(groups)
      .filter(([, markers]) => markers.length >= 2)
      .map(([area, markers]) => ({
        type: 'Feature',
        properties: { area, color: colorFor(area) },
        geometry: { type: 'LineString', coordinates: markers.map((marker) => marker.location.coordinates) },
      })),
  );
}
