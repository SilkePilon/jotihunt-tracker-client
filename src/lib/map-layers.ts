import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import type { Position } from '@/types/Position';
import type { Team } from '@/types/Team';
import type { Vehicle } from '@/types/Tracker';
import { createCircle, getColorFromArea } from '@/lib/utils';

/** Symbol layer with the fox markers (hint/hunt/spot); Map.tsx doesn't open its location popup for clicks on it. */
export const FOX_MARKERS_LAYER = 'fox-markers';

/** Symbol layer with the group pins; clicks on it open the team popup. */
export const TEAM_PINS_LAYER = 'team-pins';
/** Symbol layer with the hunters' vehicle icons; clicks on it open the device popup. */
export const HUNTERS_LAYER = 'hunters';
/** Heading arrows next to moving hunters (clicking one is clicking the hunter, like the former HTML marker). */
export const HUNTER_ARROWS_LAYER = 'hunter-arrows';

/**
 * The app's map layers from bottom to top. Within the first group the order is free; every later group is drawn above
 * all groups before it (the HTML markers stacked: foxes, then groups, then hunters, all above the canvas layers).
 */
export const MAP_LAYER_STACK: string[][] = [
  ['device-accuracy-fill', 'prediction-pin-lines', 'circle-layer-home', 'team-circles-fill', 'marker-trails-line'],
  [FOX_MARKERS_LAYER],
  ['fox-markers-hover'],
  [TEAM_PINS_LAYER],
  ['team-pins-hover'],
  [HUNTER_ARROWS_LAYER],
  [HUNTERS_LAYER],
  ['hunters-hover'],
];

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

export interface TeamPinProperties {
  id: string;
  /** Map image ids, see {@link teamPinImageId} */
  icon: string;
  hoverIcon: string;
}

/** Hunter icon: the vehicle of the device's Traccar group, a phone when the group isn't a vehicle. */
export type HunterIcon = Vehicle | 'phone';
const HUNTER_ICONS: readonly string[] = ['walking', 'bike', 'car', 'motorcycle', 'phone'] satisfies HunterIcon[];

export interface HunterProperties {
  /** Traccar device id */
  id: number;
  /** Map image ids, see {@link hunterImageId} */
  icon: string;
  hoverIcon: string;
  /** Heading in degrees */
  course: number;
  /** Moving with a recent fix: show the heading arrow */
  moving: boolean;
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
 * Map image id of a group pin: the pin in the area colour, with the green "visited" badge, brightened when hovered.
 * The images are drawn on demand (styleimagemissing), so the id carries everything needed to draw it.
 */
export function teamPinImageId(color: string, visited: boolean, hover = false): string {
  return `team-pin|${color}|${visited ? 'visited' : ''}${hover ? '|hover' : ''}`;
}

export function parseTeamPinImageId(id: string): { color: string; visited: boolean; hover: boolean } | undefined {
  const [prefix, color, visited, hover] = id.split('|');
  if (prefix !== 'team-pin' || !color) return undefined;
  return { color, visited: visited === 'visited', hover: hover === 'hover' };
}

/** One point per group for the team pin layer (one canvas layer instead of an HTML marker per group). */
export function teamPinFeatures(teams: Team[], visitedApiIds: Set<number>, colorFor: (area: string) => string = getColorFromArea): FeatureCollection<Point, TeamPinProperties> {
  return collection(
    teams.map((team) => {
      const color = colorFor(team.area || '');
      const visited = visitedApiIds.has(team.apiId);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [team.location.coordinates[0], team.location.coordinates[1]] },
        properties: { id: team._id, icon: teamPinImageId(color, visited), hoverIcon: teamPinImageId(color, visited, true) },
      };
    }),
  );
}

/** Map image id of a hunter icon: greyed out when stale, brightened when hovered. */
export function hunterImageId(icon: HunterIcon, stale: boolean, hover = false): string {
  return `hunter|${icon}|${stale ? 'stale' : 'live'}${hover ? '|hover' : ''}`;
}

export function parseHunterImageId(id: string): { icon: HunterIcon; stale: boolean; hover: boolean } | undefined {
  const [prefix, icon, state, hover] = id.split('|');
  if (prefix !== 'hunter' || !HUNTER_ICONS.includes(icon)) return undefined;
  return { icon: icon as HunterIcon, stale: state === 'stale', hover: hover === 'hover' };
}

/** One point per tracker position for the hunter layers. */
export function hunterFeatures(positions: Position[], iconFor: (deviceId: number) => HunterIcon, isStale: (fixTime: string) => boolean): FeatureCollection<Point, HunterProperties> {
  return collection(
    positions.map((position) => {
      const stale = isStale(position.fixTime);
      const icon = iconFor(position.deviceId);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [position.longitude, position.latitude] },
        properties: { id: position.deviceId, icon: hunterImageId(icon, stale), hoverIcon: hunterImageId(icon, stale, true), course: position.course, moving: position.speed > 0 && !stale },
      };
    }),
  );
}

/**
 * The map.moveLayer(id, beforeId) calls that put the layers in `order` into the stacking of `stack` (bottom to top
 * groups, see {@link MAP_LAYER_STACK}); layers that aren't on the map are skipped, other layers are left alone.
 * @param order All layer ids, bottom to top (map.getLayersOrder())
 */
export function layerStackMoves(order: string[], stack: string[][]): [string, string][] {
  const current = [...order];
  const moves: [string, string][] = [];
  // Bottom up: whatever of the groups below `group` is drawn above the lowest layer of `group` and the groups above it
  // goes directly below that layer. Earlier steps already put the lower groups below it, so they stay in order.
  for (let group = 1; group < stack.length; group++) {
    const indexes = stack.slice(group).flat().map((id) => current.indexOf(id)).filter((index) => index !== -1);
    if (!indexes.length) break;
    const target = current[Math.min(...indexes)];
    const below = new Set(stack.slice(0, group).flat());
    for (const id of current.slice(current.indexOf(target) + 1).filter((layer) => below.has(layer))) {
      current.splice(current.indexOf(id), 1);
      current.splice(current.indexOf(target), 0, id);
      moves.push([id, target]);
    }
  }
  return moves;
}
