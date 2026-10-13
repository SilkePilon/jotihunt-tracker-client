import { destination } from '@turf/turf';
import type { Area } from '@/types/Area';
import type { Hunt } from '@/types/Hunt';
import type { HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';
import type { Team } from '@/types/Team';
import { huntCooldownMs, lastHuntTimeFor } from './fox-status';
import { capitalizeFirstLetter } from './utils';

/** Camera flight duration (MapLibre flyTo/fitBounds). */
export const FLY_MS = 8000;
/** Time on a tour stop after the flight. */
export const TOUR_DWELL_MS = 20_000;
/** Time an event stays on screen after the flight. */
export const EVENT_HOLD_MS = 30_000;
/** A few km around the fox: town and roads visible, not street level. */
export const AREA_ZOOM = 11.6;
export const HUNT_ZOOM = 12.4;
export const HOME_ZOOM = 12.2;
/** Middle of the 500 m wind sector (see HomeCircle). */
const SECTOR_CENTRE_M = 250;

export type LngLat = [number, number];
export type FoxGroup = 'green' | 'orange' | 'red' | 'cooldown';

export const GROUP_LABEL: Record<FoxGroup, string> = { green: 'Actief', orange: 'Onderweg', red: 'Inactief', cooldown: 'Cooldown' };
/** Same colours as the sidebar's fox groups (FoxPills). */
export const GROUP_TEXT_CLASS: Record<FoxGroup, string> = {
  green: 'text-green-700 dark:text-green-400',
  orange: 'text-orange-700 dark:text-orange-300',
  red: 'text-red-700 dark:text-red-300',
  cooldown: 'text-blue-700 dark:text-blue-300',
};

/** One area's fox on the HQ screen. `key` is the lowercase area name. */
export interface HqFox {
  key: string;
  name: string;
  group: FoxGroup;
  cooldownMs: number;
  lastHunt: Date | string | undefined;
  center: LngLat | null;
}

export type TourStop = { kind: 'overview' } | { kind: 'area'; area: string; name: string; group: 'green' | 'orange'; center: LngLat };

/** Like the sidebar: a fox in its hunt cooldown is listed under cooldown; an unknown status counts as inactive. */
export function foxGroup(status: string, cooldownMs: number): FoxGroup {
  if (cooldownMs > 0) return 'cooldown';
  return status === 'green' || status === 'orange' ? status : 'red';
}

/** Where the camera looks for an area: the AI pin, else the last hint/hunt/spot, else the middle of the area's groups. */
export function focusPoint(areaKey: string, predictions: Prediction[] | undefined, teams: Team[] | undefined): LngLat | null {
  const prediction = predictions?.find((item) => item.area.toLowerCase() === areaKey);
  if (prediction?.pin) return [prediction.pin.lng, prediction.pin.lat];
  if (prediction?.lastObservation) return [prediction.lastObservation.lng, prediction.lastObservation.lat];
  const points = (teams ?? []).filter((team) => team.area?.toLowerCase() === areaKey && team.location?.coordinates?.length === 2).map((team) => team.location.coordinates);
  if (points.length === 0) return null;
  return [points.reduce((sum, [lng]) => sum + lng, 0) / points.length, points.reduce((sum, [, lat]) => sum + lat, 0) / points.length];
}

export function buildFoxes({ areas, hunts, reports, predictions, teams, now }: { areas?: Area[]; hunts?: Hunt[]; reports?: HuntReport[]; predictions?: Prediction[]; teams?: Team[]; now: number }): HqFox[] {
  return (areas ?? []).map((area) => {
    const key = area.name.toLowerCase();
    const lastHunt = lastHuntTimeFor(hunts, area.name, reports);
    const cooldownMs = huntCooldownMs(lastHunt, now);
    return { key, name: capitalizeFirstLetter(area.name), group: foxGroup(area.status, cooldownMs), cooldownMs, lastHunt, center: focusPoint(key, predictions, teams) };
  });
}

/** South-west and north-east corner around all groups: the game area overview. */
export function teamsBounds(teams: Team[] | undefined): [LngLat, LngLat] | null {
  const points = (teams ?? []).map((team) => team.location?.coordinates).filter((point): point is number[] => point?.length === 2);
  if (points.length === 0) return null;
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** The idle tour: the overview, then every active or on-the-way fox with a known location, in area order. */
export function tourStops(foxes: HqFox[]): TourStop[] {
  const stops: TourStop[] = [{ kind: 'overview' }];
  for (const fox of foxes) {
    if ((fox.group === 'green' || fox.group === 'orange') && fox.center) stops.push({ kind: 'area', area: fox.key, name: fox.name, group: fox.group, center: fox.center });
  }
  return stops;
}

/** Tegenhunt camera target: the middle of the wind sector around our clubhouse, or the clubhouse without a direction. */
export function homeTarget(home: LngLat, direction: number | null): LngLat {
  if (direction === null) return home;
  return destination(home, SECTOR_CENTRE_M, direction, { units: 'meters' }).geometry.coordinates as LngLat;
}
