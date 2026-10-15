import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import type { Position } from '@/types/Position';
import type { Team } from '@/types/Team';
import { createCircle, getColorFromArea } from '@/lib/utils';
import { areaKey, type AreaOrNone, formatHintClock, foxStatus, hintIconKey, markerIconId, type FoxKind, type HintNumbering, type HunterIcon } from '@/lib/marker-style';
import type { MapPin } from '@/lib/prediction';
import type { Confidence } from '@/types/Prediction';
import { BUILDINGS_LAYER } from '@/lib/buildings';

export type { HunterIcon } from '@/lib/marker-style';

/** Symbol layer with the fox markers (hint/hunt/spot); Map.tsx doesn't open its location popup for clicks on it. */
export const FOX_MARKERS_LAYER = 'fox-markers';

/** Symbol layer with the group pins; clicks on it open the team popup. */
export const TEAM_PINS_LAYER = 'team-pins';
/** Symbol layer with the hunters' vehicle icons; clicks on it open the device popup. */
export const HUNTERS_LAYER = 'hunters';
/** Heading arrows next to moving hunters (clicking one is clicking the hunter, like the former HTML marker). */
export const HUNTER_ARROWS_LAYER = 'hunter-arrows';
/** Symbol layer with the AI prediction pins (not clickable). */
export const PREDICTION_PINS_LAYER = 'prediction-pins';
/** Symbol layer with the Life360 members (avatar cookies); clicks open the member popup. */
export const LIFE360_LAYER = 'life360-members';
/** The hovered Life360 member, 10% larger. */
export const LIFE360_HOVER_LAYER = 'life360-members-hover';
/** Accuracy circles of the Life360 members. */
export const LIFE360_ACCURACY_LAYER = 'life360-accuracy-fill';

/**
 * The app's map layers from bottom to top. Within the first group the order is free; every later group is drawn above
 * all groups before it. The markers stack like the Android app's: groups, foxes (and hints), prediction pins, hunters.
 */
export const MAP_LAYER_STACK: string[][] = [
  // 3D buildings under every app layer (below the style labels through beforeId; on raster styles this keeps them under the markers)
  [BUILDINGS_LAYER],
  ['device-accuracy-fill', LIFE360_ACCURACY_LAYER, 'prediction-areas-fill', 'prediction-areas-line', 'prediction-pin-lines', 'circle-layer-home', 'team-circles-fill', 'marker-trails-line'],
  [TEAM_PINS_LAYER],
  ['team-pins-hover'],
  [FOX_MARKERS_LAYER],
  ['fox-markers-hover'],
  [PREDICTION_PINS_LAYER],
  [HUNTER_ARROWS_LAYER],
  [HUNTERS_LAYER, LIFE360_LAYER],
  ['hunters-hover', LIFE360_HOVER_LAYER],
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
  /** Theme-less marker image id, see {@link markerIconId} */
  icon: string;
  /** Hint labels hang above their point (anchor bottom-left), the other markers are centred on it */
  hint: boolean;
}

export interface TeamPinProperties {
  id: string;
  /** Theme-less marker image id, see {@link markerIconId} */
  icon: string;
}

export interface PredictionPinProperties {
  area: string;
  /** Theme-less marker image id, see {@link markerIconId} */
  icon: string;
}

export interface HunterProperties {
  /** Traccar device id */
  id: number;
  /** Theme-less marker image id, see {@link markerIconId} */
  icon: string;
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

function foxKind(type: MarkerType): FoxKind {
  return type === MarkerType.Spot ? 'spot' : type === MarkerType.Hunt ? 'hunt' : 'other';
}

export interface MarkerFeatureContext {
  /** Area name → status from /areas (spots take their area's status colour) */
  statusOf: (area: string) => string | undefined;
  /** Hint numbers from the hint board ("A · H3" labels) */
  numbering: HintNumbering;
  nowMs: number;
  /** Areas we may not hunt (rule 5.1) get the locked icon; default nothing */
  isForbidden?: (area: string) => boolean;
}

/**
 * One point per marker for the fox symbol layer (one canvas layer instead of an HTML element per marker): spots in
 * their area's status colour, hunts, and hints as an "A · H3" label (the clock without a number; a dot when old).
 * Spots and hunts of an area we may not hunt are locked (grey, lock badge).
 */
export function markerFeatures(markers: Marker[], { statusOf, numbering, nowMs, isForbidden = () => false }: MarkerFeatureContext): FeatureCollection<Point, MarkerFeatureProperties> {
  return collection(
    markers.map((marker) => {
      const time = new Date(marker.time).getTime();
      const area: AreaOrNone = areaKey(marker.area) ?? 'none';
      const hint = marker.type === MarkerType.Hint;
      const key = hint
        ? hintIconKey(area, time, numbering.numberOf(marker._id ?? '', marker.area, time), nowMs, formatHintClock(time))
        : { kind: 'fox' as const, type: foxKind(marker.type), status: foxStatus(statusOf(marker.area)), area, locked: area !== 'none' && isForbidden(marker.area) };
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: marker.location.coordinates },
        properties: { id: marker._id!, type: marker.type, area: marker.area, time, icon: markerIconId(key), hint },
      };
    }),
  );
}

/** One point per group for the group layer: a circle in the area colour, with a check badge once visited. */
export function teamPinFeatures(teams: Team[], visitedApiIds: Set<number>): FeatureCollection<Point, TeamPinProperties> {
  return collection(
    teams.map((team) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [team.location.coordinates[0], team.location.coordinates[1]] },
      properties: { id: team._id, icon: markerIconId({ kind: 'group', area: areaKey(team.area) ?? 'none', visited: visitedApiIds.has(team.apiId) }) },
    })),
  );
}

/** One point per tracker position for the hunter layers. */
export function hunterFeatures(positions: Position[], iconFor: (deviceId: number) => HunterIcon, isStale: (fixTime: string) => boolean): FeatureCollection<Point, HunterProperties> {
  return collection(
    positions.map((position) => {
      const stale = isStale(position.fixTime);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [position.longitude, position.latitude] },
        properties: { id: position.deviceId, icon: markerIconId({ kind: 'hunter', icon: iconFor(position.deviceId), stale }), course: position.course, moving: position.speed > 0 && !stale },
      };
    }),
  );
}

/** Radius of the prediction area circle per confidence (Android `buildOverlay`); unknown counts as low. */
export const PREDICTION_RADIUS_M: Record<Confidence, number> = { high: 200, medium: 400, low: 700 };

/** The area where the fox probably is: a circle around each pin, smaller when the AI is more sure. */
export function predictionAreaCircles(pins: MapPin[]): FeatureCollection<Polygon, { area: string }> {
  return collection(pins.map((pin) => circle(pin.lng, pin.lat, PREDICTION_RADIUS_M[pin.confidence ?? 'low'], { area: pin.area })));
}

/** One point per AI prediction pin (greyed out when stale; grey with a lock when we may not hunt the area). */
export function predictionPinFeatures(pins: MapPin[], isForbidden: (area: string) => boolean = () => false): FeatureCollection<Point, PredictionPinProperties> {
  return collection(
    pins.map((pin) => {
      const area = areaKey(pin.area) ?? 'none';
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
        properties: { area: pin.area, icon: markerIconId({ kind: 'prediction', area, stale: pin.stale, locked: area !== 'none' && isForbidden(pin.area) }) },
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
