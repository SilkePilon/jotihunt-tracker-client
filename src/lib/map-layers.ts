import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import type { Position } from '@/types/Position';
import type { Team } from '@/types/Team';
import { createCircle, getColorFromArea } from '@/lib/utils';

/** Symbol layer with the fox markers (hint/hunt/spot); Map.tsx doesn't open its location popup for clicks on it. */
export const FOX_MARKERS_LAYER = 'fox-markers';

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

export interface MarkerFeatureProperties {
  id: string;
  type: MarkerType;
  area: string;
  /** Epoch milliseconds */
  time: number;
  /** Map image id, see {@link markerImageId} */
  icon: string;
}

function collection<G extends Polygon | LineString | Point, P>(features: Feature<G, P>[]): FeatureCollection<G, P> {
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

/** Id of the map image (registered with map.addImage) for a marker type; unknown types get the plain fox. */
export function markerImageId(type: MarkerType): string {
  switch (type) {
    case MarkerType.Hint:
      return 'fox-hint';
    case MarkerType.Hunt:
      return 'fox-hunt';
    case MarkerType.Spot:
      return 'fox-spot';
    default:
      return 'fox';
  }
}

/** One point per marker for the fox symbol layer (one canvas layer instead of an HTML element per marker). */
export function markerFeatures(markers: Marker[]): FeatureCollection<Point, MarkerFeatureProperties> {
  return collection(
    markers.map((marker) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: marker.location.coordinates },
      properties: { id: marker._id!, type: marker.type, area: marker.area, time: new Date(marker.time).getTime(), icon: markerImageId(marker.type) },
    })),
  );
}

/**
 * Which of `candidates` are drawn above `target` (in their current order), i.e. have to be moved below it.
 * @param order All layer ids, bottom to top (map.getLayersOrder())
 */
export function layersToMoveBelow(order: string[], target: string, candidates: string[]): string[] {
  const targetIndex = order.indexOf(target);
  if (targetIndex === -1) return [];
  return order.slice(targetIndex + 1).filter((id) => candidates.includes(id));
}
