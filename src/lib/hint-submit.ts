import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

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
 * The Hunt/Spot dialog's inline error for a hunt or spot that got no answer and wasn't confirmed ('registered' closes
 * it). The dialog covers the map, so 'unknown' points at its own "Opnieuw controleren" instead of at the map.
 */
export function markerLostResponseMessage(outcome: Exclude<LostResponseOutcome, 'registered'>, type: MarkerType = MarkerType.Hunt): string {
  const noun = type === MarkerType.Spot ? 'spot' : 'hunt';
  return outcome === 'unknown'
    ? `Geen antwoord ontvangen. Misschien is de ${noun} toch geplaatst: controleer het opnieuw voordat je nog eens opslaat.`
    : `Geen antwoord ontvangen en de ${noun} staat niet op de kaart: hij is niet geplaatst. Probeer het opnieuw.`;
}

/** Said instead of a lost-response message when the device was offline at Registreren: nothing went out */
export const OFFLINE_NOT_SENT_MESSAGE = 'Je bent offline — niet verstuurd. Je invoer blijft staan.';

/**
 * Whether the browser knows it has no connection right now (`navigator.onLine` false). Only a "no" is trusted: true
 * can still mean a dead network, which the lost-response check handles. No navigator (tests): online.
 */
export function isKnownOffline(nav: Pick<Navigator, 'onLine'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  return nav?.onLine === false;
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

/** A hint whose Registreren got no answer and wasn't confirmed: what was sent, the form values then, and the outcome. */
export interface UnconfirmedHint {
  sent: Marker;
  values: HintDraftValues;
  outcome: Exclude<LostResponseOutcome, 'registered'>;
}

/**
 * Whether a marker list (a later poll) holds our own unconfirmed hint: its hour then shows taken, but by us, so it is
 * the late success and not "net door iemand anders geregistreerd".
 */
export function holdsUnconfirmedHint(markers: Marker[] | undefined, pending: UnconfirmedHint | null): boolean {
  return !!pending && !!markers && markers.some((marker) => isSameMarker(marker, pending.sent));
}

/**
 * The hint form's main action: with no answer and no fresh list ('unknown') registering again could place it twice, so
 * "Opnieuw controleren" leads while the form still holds those values; once a fresh list says it isn't there ('absent'),
 * or a different hint is typed, Registreren is back.
 */
export function hintPrimaryAction(pending: UnconfirmedHint | null, current: HintDraftValues): 'recheck' | 'register' {
  return pending?.outcome === 'unknown' && sameDraft(current, pending.values) ? 'recheck' : 'register';
}
