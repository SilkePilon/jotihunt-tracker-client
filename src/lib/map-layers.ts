import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import type { Position } from '@/types/Position';
import type { Team } from '@/types/Team';
import { createCircle, getColorFromArea } from '@/lib/utils';
import { areaKey, type AreaOrNone, foxStatus, hintIconKey, markerIconId, type FoxKind, type HintNumbering, type HunterIcon } from '@/lib/marker-style';
import { formatClock } from '@/lib/format';
import type { MapPin } from '@/lib/prediction';
import type { Confidence } from '@/types/Prediction';
import type { SyncedHunt } from '@/types/HuntSync';
import { BUILDINGS_LAYER } from '@/lib/buildings';
import { HINT_GUESS_AREA_FILL_LAYER, HINT_GUESS_AREA_LINE_LAYER, HINT_GUESS_REACH_LAYER } from '@/lib/hint-guess';
import { REACH_CONE_LAYER, REACH_FILL_LAYER, REACH_LINE_LAYER } from '@/lib/reach';
import { fastfoodStatus, type Brand } from '@/lib/fastfood';
import type { FastfoodRestaurant } from '@/types/Fastfood';
import type { NightAreaKind } from '@/types/Trail';

export type { HunterIcon } from '@/lib/marker-style';

/** Symbol layer with the fox markers (hint/hunt/spot); Map.tsx doesn't open its location popup for clicks on it. */
export const FOX_MARKERS_LAYER = 'fox-markers';

/** Symbol layer with the group pins; clicks on it open the team popup. */
export const TEAM_PINS_LAYER = 'team-pins';
/** Symbol layer with the fastfood tiles (McDonald's, KFC, Burger King); clicks open the restaurant popup. */
export const FASTFOOD_LAYER = 'fastfood';
/** The hovered restaurant, 10% larger. */
export const FASTFOOD_HOVER_LAYER = 'fastfood-hover';
/** Symbol layer with the hunters' vehicle icons; clicks on it open the device popup. */
export const HUNTERS_LAYER = 'hunters';
/** Heading arrows next to moving hunters (clicking one is clicking the hunter, like the former HTML marker). */
export const HUNTER_ARROWS_LAYER = 'hunter-arrows';
/** Invisible wide line over the routed trail legs; clicks open the leg popup. */
export const TRAILS_HIT_LAYER = 'marker-trails-hit';
/** Routed trail layers (style A), bottom to top: white casing, walk (solid), car (dotted), straight fallback, hit. */
export const ROUTED_TRAIL_LAYERS = ['marker-trails-casing', 'marker-trails-walk', 'marker-trails-car', 'marker-trails-fallback', TRAILS_HIT_LAYER] as const;
/** The car badge, on its own source: its own stack group keeps it above all the trail lines. */
export const TRAIL_BADGE_LAYER = 'marker-trails-badge';
/** Own night areas (Beheer → Routes): fill, outline, name label; shown while the Routes card is open or while drawing. */
export const NIGHT_AREA_LAYERS = ['night-areas-fill', 'night-areas-line', 'night-areas-label'] as const;
/** The area being drawn: fill, dashed outline, corner dots. */
export const NIGHT_DRAW_LAYERS = ['night-draw-fill', 'night-draw-line', 'night-draw-vertices'] as const;
/** Night area fill per kind: red for closed at night, green for open (saved areas and the one being drawn) */
export const NIGHT_FILL: Record<NightAreaKind, string> = { closed: 'rgba(186,26,26,0.18)', open: 'rgba(27,109,47,0.18)' };
export const NIGHT_LINE: Record<NightAreaKind, string> = { closed: '#ba1a1a', open: '#1b6d2f' };

/** Symbol layer with the AI prediction pins (not clickable). */
export const PREDICTION_PINS_LAYER = 'prediction-pins';
/** Symbol layer with the Life360 members (avatar cookies); clicks open the member popup. */
export const LIFE360_LAYER = 'life360-members';
/** The hovered Life360 member, 10% larger. */
export const LIFE360_HOVER_LAYER = 'life360-members-hover';
/** Accuracy circles of the Life360 members. */
export const LIFE360_ACCURACY_LAYER = 'life360-accuracy-fill';

/** Accuracy circles of the synced hunts (fill + thin outline), under every marker. */
export const HUNT_ACCURACY_FILL_LAYER = 'hunt-accuracy-fill';
export const HUNT_ACCURACY_LINE_LAYER = 'hunt-accuracy-line';
/** The dashed outline of estimated hunt locations (guessed from our trackers) */
export const HUNT_ACCURACY_ESTIMATE_LINE_LAYER = 'hunt-accuracy-line-estimated';

/** One circle per synced hunt with a location and a positive accuracy (metres). */
export function huntAccuracyCircles(hunts: SyncedHunt[] | undefined): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  for (const hunt of hunts ?? []) {
    const location = hunt.location;
    if (!location || location.accuracy === null || !(location.accuracy > 0)) continue;
    const circle = createCircle(location.lng, location.lat, location.accuracy);
    features.push({ ...circle, properties: { id: hunt._id, area: hunt.area.toLowerCase(), estimated: location.estimated } });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * The app's map layers from bottom to top. Within the first group the order is free; every later group is drawn above
 * all groups before it. The markers stack like the Android app's: groups, foxes (and hints), prediction pins, hunters.
 */
export const MAP_LAYER_STACK: string[][] = [
  // 3D buildings under every app layer (below the style labels through beforeId; on raster styles this keeps them under the markers)
  [BUILDINGS_LAYER],
  ['device-accuracy-fill', LIFE360_ACCURACY_LAYER, HUNT_ACCURACY_FILL_LAYER, HUNT_ACCURACY_LINE_LAYER, HUNT_ACCURACY_ESTIMATE_LINE_LAYER, 'prediction-areas-fill', 'prediction-areas-line', REACH_FILL_LAYER, REACH_CONE_LAYER, REACH_LINE_LAYER, 'prediction-pin-lines', 'circle-layer-home', 'team-circles-fill', 'marker-trails-line', ...ROUTED_TRAIL_LAYERS],
  [TRAIL_BADGE_LAYER],
  // Above the trails, below the markers: the night areas, the one being drawn on top
  [...NIGHT_AREA_LAYERS, ...NIGHT_DRAW_LAYERS],
  // A partly solved hint's reach circle and candidate area (lib/hint-guess.ts); the candidate dots are HTML markers
  [HINT_GUESS_REACH_LAYER, HINT_GUESS_AREA_FILL_LAYER, HINT_GUESS_AREA_LINE_LAYER],
  [FASTFOOD_LAYER],
  [FASTFOOD_HOVER_LAYER],
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
        ? hintIconKey(area, time, numbering.numberOf(marker._id ?? '', marker.area, time), nowMs, formatClock(time))
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

/** One tile per restaurant of a shown brand; grey when closed now (unknown hours stay in colour). */
export function fastfoodFeatures(restaurants: FastfoodRestaurant[], brands: Brand[], nowMs: number): FeatureCollection<Point, { id: string; icon: string }> {
  return collection(
    restaurants
      .filter((restaurant) => brands.includes(restaurant.brand))
      .map((restaurant) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: restaurant.location.coordinates },
        properties: {
          id: restaurant.osmId,
          icon: markerIconId({ kind: 'fastfood', brand: restaurant.brand, closed: fastfoodStatus(restaurant.intervals, nowMs).state === 'closed' }),
        },
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
