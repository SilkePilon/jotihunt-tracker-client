import { ACTIVE_WINDOW_MS } from './tracker';
import type { Device } from '@/types/Device';
import type { Position } from '@/types/Position';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance (haversine) in metres. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * How old a tracker fix may be to count as "where I am now" (locate, own-position dot, distance from me). A phone that
 * walked on for minutes would otherwise send you to where you were; older falls through to the browser's position.
 */
export const OWN_POSITION_FRESH_MS = 60_000;

/**
 * The own tracker's position, unless missing or older than `maxAgeMs` (default: the 5 min rule of the hunter markers,
 * used for greying them). Device id 0 is valid.
 */
export function ownTrackerPosition(positions: Position[] | undefined, deviceId: number | undefined, now: number, maxAgeMs = ACTIVE_WINDOW_MS): LatLng | undefined {
  if (deviceId === undefined) return undefined;
  const own = positions?.find((candidate) => candidate.deviceId === deviceId);
  if (!own?.fixTime) return undefined;
  const time = new Date(own.fixTime).getTime();
  if (!Number.isFinite(time) || now - time > maxAgeMs) return undefined;
  return { lat: own.latitude, lng: own.longitude };
}

/** The Traccar device id of the own tracker (matched on its uniqueId from /tracker/me). Device id 0 is valid. */
export function ownDeviceId(devices: Device[] | undefined, uniqueId: string | undefined): number | undefined {
  if (uniqueId === undefined) return undefined;
  return devices?.find((device) => device.uniqueId === uniqueId)?.id;
}
