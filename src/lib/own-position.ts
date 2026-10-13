import { isActive } from './tracker';
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

/** The own tracker's position, unless missing or stale (same 5 min rule as the hunter markers). Device id 0 is valid. */
export function ownTrackerPosition(positions: Position[] | undefined, deviceId: number | undefined, now: number): LatLng | undefined {
  if (deviceId === undefined) return undefined;
  const own = positions?.find((candidate) => candidate.deviceId === deviceId);
  if (!own || !isActive(own.fixTime, now)) return undefined;
  return { lat: own.latitude, lng: own.longitude };
}
