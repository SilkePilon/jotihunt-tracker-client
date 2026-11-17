import type { Marker } from '@/types/Marker';

/**
 * What a fresh marker list says about a marker whose save got no answer (offline, timeout): the server may still
 * have saved it.
 * - 'registered': the marker is there (same type, area, time and spot), so it did go through
 * - 'absent': the fresh list doesn't have it
 * - 'unknown': no fresh list came either (still no connection), so it can't be told
 */
export type LostResponseOutcome = 'registered' | 'absent' | 'unknown';

/** Coordinates count as the same spot within this many degrees (~1 cm), for float round-trips through the server. */
const SAME_SPOT_DEGREES = 1e-7;

const timeOf = (time: Date | string | undefined) => (time === undefined ? NaN : new Date(time).getTime());

/** Whether `candidate` is the marker that was sent: same type (hint, hunt, spot), area, time and spot. */
export function isSameMarker(candidate: Marker, sent: Marker): boolean {
  if (candidate.type !== sent.type || candidate.area !== sent.area) return false;
  const at = timeOf(candidate.time);
  if (Number.isNaN(at) || at !== timeOf(sent.time)) return false;
  const [lng, lat] = candidate.location?.coordinates ?? [];
  const [sentLng, sentLat] = sent.location.coordinates;
  return Math.abs(lng - sentLng) <= SAME_SPOT_DEGREES && Math.abs(lat - sentLat) <= SAME_SPOT_DEGREES;
}

/**
 * Check a marker whose save got no answer against a freshly fetched marker list.
 * @param fresh The list fetched after the failure; undefined when that fetch failed too
 * @param sent The marker that was sent
 */
export function lostResponseOutcome(fresh: Marker[] | undefined, sent: Marker): LostResponseOutcome {
  if (!fresh) return 'unknown';
  return fresh.some((marker) => isSameMarker(marker, sent)) ? 'registered' : 'absent';
}

/** The inline error under Registreren for a hint that got no answer and wasn't confirmed ('registered' shows a toast). */
export function lostResponseMessage(outcome: Exclude<LostResponseOutcome, 'registered'>): string {
  return outcome === 'unknown'
    ? 'Geen antwoord ontvangen. Controleer eerst of de hint op de kaart staat voordat je opnieuw registreert; je invoer blijft staan.'
    : 'Geen antwoord ontvangen en de hint staat niet op de kaart: hij is niet geregistreerd. Je invoer blijft staan, probeer het opnieuw.';
}

/**
 * The Hunt/Spot dialog's inline error for a marker that got no answer and wasn't confirmed ('registered' closes it).
 * The dialog covers the map, so 'unknown' points at its own "Opnieuw controleren" instead of at the map.
 */
export function markerLostResponseMessage(outcome: Exclude<LostResponseOutcome, 'registered'>): string {
  return outcome === 'unknown'
    ? 'Geen antwoord ontvangen. Misschien is de marker toch geplaatst: controleer het opnieuw voordat je nog eens opslaat.'
    : 'Geen antwoord ontvangen en de marker staat niet op de kaart: hij is niet geplaatst. Probeer het opnieuw.';
}

/** The hint form's fields */
export interface HintDraftValues {
  area: string;
  time: string;
  x: string;
  y: string;
}

/** Whether the form still holds the values that were sent (else a next hint or a correction was typed meanwhile). */
export const sameDraft = (a: HintDraftValues, b: HintDraftValues) => a.area === b.area && a.time === b.time && a.x === b.x && a.y === b.y;
