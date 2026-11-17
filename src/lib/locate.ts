import type { LatLng } from './own-position';

/** Zoom for "Mijn locatie": close enough to see the streets around you. */
export const LOCATE_ZOOM = 15;

/**
 * Where "Mijn locatie" goes: the own tracker when it is fresh (no prompt, same spot as the own hunter marker), else
 * the browser's position (asks for permission the first time). Rejects with a Dutch message when neither works.
 */
export function locateMe(
  tracker: LatLng | undefined,
  geolocation: Geolocation | undefined = typeof navigator === 'undefined' ? undefined : navigator.geolocation,
): Promise<LatLng & { accuracy?: number }> {
  if (tracker) return Promise.resolve(tracker);
  if (!geolocation) return Promise.reject(new Error('Deze browser kan je locatie niet bepalen.'));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (fix) => resolve({ lat: fix.coords.latitude, lng: fix.coords.longitude, accuracy: fix.coords.accuracy }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? 'Geen toegang tot je locatie. Sta locatie toe in je browserinstellingen.' : 'Je locatie kon niet worden bepaald. Probeer het opnieuw.')),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}
