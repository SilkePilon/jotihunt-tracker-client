import type { LatLng } from './own-position';
import { formatAgo } from './account';

/** Zoom for "Mijn locatie": close enough to see the streets around you. */
export const LOCATE_ZOOM = 15;

/** Where a locate came from: the own tracker (its hunter marker) or the browser (an own-position dot) */
export type LocateSource = 'tracker' | 'browser';

export interface LocateInput {
  /** The own tracker's fix when under OWN_POSITION_LIVE_MS old */
  live?: LatLng;
  /** The own tracker's fix when under OWN_POSITION_FRESH_MS old: the fallback */
  recent?: LatLng;
  /** Location access was already granted, so asking the browser doesn't prompt */
  granted: boolean;
}

function browserPosition(geolocation: Geolocation | undefined): Promise<LatLng & { accuracy?: number }> {
  if (!geolocation) return Promise.reject(new Error('Deze browser kan je locatie niet bepalen.'));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (fix) => resolve({ lat: fix.coords.latitude, lng: fix.coords.longitude, accuracy: fix.coords.accuracy }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? 'Geen toegang tot je locatie. Sta locatie toe in je browserinstellingen.' : 'Je locatie kon niet worden bepaald. Probeer het opnieuw.')),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

/**
 * Where "Mijn locatie" goes: the own tracker when its fix is live (no prompt, same spot as the own hunter marker);
 * else the browser's position when location access is already granted, with a recent tracker fix as fallback when that
 * fails; without access a recent tracker fix wins over a permission prompt. Nothing at all: the browser asks for
 * permission. Rejects with a Dutch message when nothing works.
 */
export async function locateMe(
  { live, recent, granted }: LocateInput,
  geolocation: Geolocation | undefined = typeof navigator === 'undefined' ? undefined : navigator.geolocation,
): Promise<LatLng & { accuracy?: number; source: LocateSource }> {
  if (live) return { ...live, source: 'tracker' };
  if (recent && !granted) return { ...recent, source: 'tracker' };
  try {
    return { ...(await browserPosition(geolocation)), source: 'browser' };
  } catch (error) {
    if (recent) return { ...recent, source: 'tracker' };
    throw error;
  }
}

/** What follow mode centres on: a live tracker fix, else the browser's position, else a recent tracker fix. */
export function followTarget(live: LatLng | undefined, browser: LatLng | null | undefined, recent: LatLng | undefined): LatLng | undefined {
  return live ?? browser ?? recent;
}

interface PermissionsLike {
  query(descriptor: { name: 'geolocation' }): Promise<{ state: PermissionState }>;
}

/** Whether location access is already granted, without ever prompting (false when the browser can't tell). */
export async function geolocationGranted(
  permissions: PermissionsLike | undefined = typeof navigator === 'undefined' ? undefined : (navigator.permissions as PermissionsLike | undefined),
): Promise<boolean> {
  if (!permissions) return false;
  try {
    return (await permissions.query({ name: 'geolocation' })).state === 'granted';
  } catch {
    return false;
  }
}

/** How long the phone's "Hunt hier" tile stays after a successful "Mijn locatie" once following has ended */
export const HUNT_HERE_GRACE_MS = 30_000;

/** Whether "Hunt hier" shows: while following, or within the grace time after the last successful locate. */
export function huntHereVisible(following: boolean, located: { at: number } | null, now: number): boolean {
  return following || (located !== null && now - located.at < HUNT_HERE_GRACE_MS);
}

/**
 * The browser-location dot's watchPosition options: GPS precision only while the map follows you; in the grace time
 * after following ended (BrowserLocationDot) a cheaper network/Wi-Fi fix is enough for the dot.
 */
export function browserDotWatchOptions(following: boolean): PositionOptions {
  return { enableHighAccuracy: following, maximumAge: 10_000 };
}

/**
 * Where "Hunt hier" marks: the own position now, like following (live tracker, browser, recent tracker), else the spot
 * the last locate found.
 */
export function huntHereFix(live: LatLng | undefined, browser: LatLng | null | undefined, recent: LatLng | undefined, located: LatLng | null): LatLng | undefined {
  return followTarget(live, browser, recent) ?? located ?? undefined;
}

/**
 * The note after "Mijn locatie" landed on an older tracker fix (no live one, no browser fix): "Laatste trackerpositie ·
 * 2 min geleden", so nobody takes it for where they are now; null for a live fix or a browser position.
 */
export function olderTrackerFixNote(source: LocateSource, live: LatLng | undefined, fixTime: Date | string | undefined, now: number): string | null {
  if (source !== 'tracker' || live || fixTime === undefined) return null;
  const time = new Date(fixTime);
  if (Number.isNaN(time.getTime())) return null;
  return `Laatste trackerpositie · ${formatAgo(time.toISOString(), now)}`;
}
