import { destination } from '@turf/turf';
import type { Area } from '@/types/Area';
import type { Hunt } from '@/types/Hunt';
import type { HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';
import type { Team } from '@/types/Team';
import { counterHuntDirection, counterHuntTitle } from './counter-hunt';
import { FOX_GROUP_LABEL, foxGroup, huntCooldownMs, lastHuntTimeFor, type FoxGroup } from './fox-status';
import { formatClock, joinParts } from './format';
import type { AppNotification } from './notifications';
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
export { foxGroup, type FoxGroup };

export const GROUP_LABEL = FOX_GROUP_LABEL;
/** Text colour per fox group on the HQ screen. */
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

/** Card colour (same values as CookieBadge's tone). */
export type HqTone = 'ok' | 'warn' | 'danger' | 'neutral';
export type HqCamera = { kind: 'area'; area: string; zoom: number } | { kind: 'home'; direction: number | null };

/** Where an event came from; a queued hunt is not replaced by a status change on the same area. */
export type HqEventKind = 'hunt' | 'fox-status' | 'cooldown' | 'counter-hunt' | 'message';

/** Something shown in the event card; `key` collapses repeats (e.g. a hunt and its status change on one area). */
export interface HqEvent {
  key: string;
  kind: HqEventKind;
  title: string;
  detail: string;
  tone: HqTone;
  /** null = the camera holds still while the card shows */
  camera: HqCamera | null;
}

/** Where the camera flies for an event; null when it holds still (no camera, a fox without a centre, or no home team yet). */
export function eventTarget(event: HqEvent, foxes: HqFox[], homeTeam: Team | undefined): { center: LngLat; zoom: number } | null {
  const camera = event.camera;
  if (camera?.kind === 'area') {
    const center = foxes.find((fox) => fox.key === camera.area)?.center;
    return center ? { center, zoom: camera.zoom } : null;
  }
  if (camera?.kind === 'home' && homeTeam) return { center: homeTarget(homeTeam.location.coordinates as LngLat, camera.direction), zoom: HOME_ZOOM };
  return null;
}

/** How long an event stays on screen: 30 s after the flight, or just 30 s when the camera holds still. */
export function eventHoldMs(flies: boolean): number {
  return flies ? FLY_MS + EVENT_HOLD_MS : EVENT_HOLD_MS;
}

const STATUS_WORD: Record<string, string> = { green: 'Actief', orange: 'Onderweg', red: 'Inactief' };

export function eventFromNotification(notification: AppNotification): HqEvent | null {
  const { type, data, title, body, id } = notification;
  switch (type) {
    case 'fox-status': {
      const area = data.area?.toLowerCase();
      if (!area) return null;
      const status = data.status ?? '';
      const previous = data.previousStatus && STATUS_WORD[data.previousStatus];
      return {
        key: `area:${area}`,
        kind: 'fox-status',
        title: `${capitalizeFirstLetter(area)} is ${STATUS_WORD[status] ?? status}`,
        detail: previous ? `Was ${previous}` : body,
        tone: status === 'green' ? 'ok' : status === 'orange' ? 'warn' : 'neutral',
        camera: { kind: 'area', area, zoom: AREA_ZOOM },
      };
    }
    case 'counter-hunt': {
      const direction = data.direction ?? null;
      // The server's text says "richting oost" where the client says "uit het oosten": show only the client's wording
      const known = counterHuntDirection(direction) !== undefined;
      return {
        key: `counter-hunt:${id}`,
        kind: 'counter-hunt',
        title: known ? counterHuntTitle(direction) : title || 'Tegenhunt!',
        detail: known ? 'Zoek de sticker binnen 500 m van het clubhuis' : body,
        tone: 'danger',
        camera: { kind: 'home', direction },
      };
    }
    case 'broadcast':
    case 'hunt-deadline':
    case 'happy-hour':
      return { key: id, kind: 'message', title, detail: body, tone: 'warn', camera: null };
    default:
      return { key: id, kind: 'message', title, detail: body, tone: 'neutral', camera: null };
  }
}

/** Reports that weren't there at the previous check; none on the first check (no replay after a reload). */
export function newReports(previousIds: ReadonlySet<string> | null, reports: HuntReport[]): HuntReport[] {
  if (!previousIds) return [];
  return reports.filter((report) => !previousIds.has(report._id));
}

export function huntEvent(report: HuntReport): HqEvent {
  const area = report.area.toLowerCase();
  return {
    key: `area:${area}`,
    kind: 'hunt',
    title: `Hunt op ${capitalizeFirstLetter(area)}!`,
    detail: joinParts(report.huntCode ?? 'Code wordt gelezen', `door ${report.reportedByName}`, 'cooldown gestart'),
    tone: 'ok',
    camera: { kind: 'area', area, zoom: HUNT_ZOOM },
  };
}

/** Foxes whose cooldown ran out since the previous check and that can be hunted (not red); none on the first check. */
export function endedCooldowns(previous: ReadonlyMap<string, number> | null, foxes: HqFox[]): HqFox[] {
  if (!previous) return [];
  return foxes.filter((fox) => (previous.get(fox.key) ?? 0) > 0 && fox.cooldownMs === 0 && fox.group !== 'red');
}

export function cooldownEvent(fox: HqFox): HqEvent {
  return {
    key: `area:${fox.key}`,
    kind: 'cooldown',
    title: `${fox.name} is weer te hunten`,
    detail: fox.lastHunt ? `Cooldown voorbij · laatste hunt ${formatClock(fox.lastHunt)}` : 'Cooldown voorbij',
    tone: 'ok',
    camera: { kind: 'area', area: fox.key, zoom: AREA_ZOOM },
  };
}

/** `step` changes on every camera move: the director flies and restarts its timer per step. */
export interface DirectorState {
  current: HqEvent | null;
  queue: HqEvent[];
  tourIndex: number;
  step: number;
}

export const INITIAL_DIRECTOR: DirectorState = { current: null, queue: [], tourIndex: 0, step: 0 };

/**
 * Queue events (FIFO); a repeat of what's on screen is dropped, a repeat of a queued one replaces it (but a status change
 * doesn't replace a queued hunt: the hunt card says more). The first event interrupts the tour.
 */
export function enqueue(state: DirectorState, events: HqEvent[]): DirectorState {
  let queue = state.queue;
  for (const event of events) {
    if (state.current?.key === event.key) continue;
    const index = queue.findIndex((queued) => queued.key === event.key);
    if (index >= 0 && queue[index].kind === 'hunt' && event.kind === 'fox-status') continue;
    queue = index >= 0 ? queue.map((queued, i) => (i === index ? event : queued)) : [...queue, event];
  }
  if (state.current || queue.length === 0) return { ...state, queue };
  const [current, ...rest] = queue;
  return { ...state, current, queue: rest, step: state.step + 1 };
}

/** Timer ran out: next queued event, else back to the tour at its next stop, else the next tour stop. */
export function advance(state: DirectorState): DirectorState {
  if (state.current) {
    const [next, ...rest] = state.queue;
    if (next) return { ...state, current: next, queue: rest, step: state.step + 1 };
    return { ...state, current: null, queue: [], tourIndex: state.tourIndex + 1, step: state.step + 1 };
  }
  return { ...state, tourIndex: state.tourIndex + 1, step: state.step + 1 };
}
