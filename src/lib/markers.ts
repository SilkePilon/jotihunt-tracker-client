import { MarkerType } from '@/types/MarkerType';
import type { Marker } from '@/types/Marker';
import { formatClock } from '@/lib/format';

/** Up to this age a marker's time also shows its age ("14:00 · 45 min geleden"), after that only the clock time */
const RELATIVE_AGE_MS = 2 * 60 * 60_000;

const amsterdamDay = new Intl.DateTimeFormat('nl-NL', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Amsterdam' });
const shortWeekday = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', timeZone: 'Europe/Amsterdam' });

/** A marker's age to the minute: "zojuist", "45 min geleden", "1 u geleden", "1 u 12 min geleden". */
function ageLabel(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'zojuist';
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} u geleden` : `${hours} u ${rest} min geleden`;
}

/**
 * A marker's time for its popup subtitle: "14:00 · 45 min geleden" under 2 hours old, "10:12" earlier today,
 * "za 10:12" on another day (all in Dutch time). A time in the future (a hint hour still running) is the clock time.
 */
export function markerTimeLabel(time: Date | string, now: number): string {
  const at = new Date(time);
  const age = now - at.getTime();
  if (age >= 0 && age < RELATIVE_AGE_MS) return `${formatClock(at)} · ${ageLabel(age)}`;
  if (amsterdamDay.format(at) === amsterdamDay.format(now)) return formatClock(at);
  return `${shortWeekday.format(at).replace(/\.$/, '')} ${formatClock(at)}`;
}

/** Split between the two marker layers: 23:00 (local time) on the first hunt day. */
export function markerSplitTime(huntStart: Date): Date {
  const split = new Date(huntStart);
  split.setHours(23, 0, 0, 0);
  return split;
}

export interface MarkerFilter {
  /** Show markers before the split (also markers from before the hunt, e.g. tests) */
  part1: boolean;
  /** Show markers from the split onwards */
  part2: boolean;
  /** Undefined (no hunt start configured): no split, every marker is in part 1 */
  split?: Date;
  isVisible: (area: string) => boolean;
}

/** Markers in an enabled part whose area isn't hidden. */
export function filterMarkers(markers: Marker[], { part1, part2, split, isVisible }: MarkerFilter): Marker[] {
  return markers.filter((marker) => {
    const time = new Date(marker.time);
    const inPart = split ? (part1 && time < split) || (part2 && time >= split) : part1;
    return inPart && isVisible(marker.area);
  });
}

/** Markers per area, oldest first (for the trail lines). Doesn't mutate the input. */
export function groupMarkersByArea(markers: Marker[]): Record<string, Marker[]> {
  const groups: Record<string, Marker[]> = {};
  for (const marker of markers) {
    (groups[marker.area] ??= []).push(marker);
  }
  for (const area of Object.keys(groups)) {
    groups[area].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }
  return groups;
}

/** The newest hint or hunt marker of an area (spots don't count), for "Naar laatste hint/hunt"; undefined when it has none. */
export function latestAreaMarker(markers: readonly Marker[] | undefined, area: string): Marker | undefined {
  let latest: Marker | undefined;
  for (const marker of markers ?? []) {
    if (marker.area !== area || !marker._id || (marker.type !== MarkerType.Hint && marker.type !== MarkerType.Hunt)) continue;
    if (!latest || new Date(marker.time).getTime() > new Date(latest.time).getTime()) latest = marker;
  }
  return latest;
}

/**
 * Error toasts of the Hunt/Spot dialog and the hint form stay longer than sonner's default 4 s: the reason (the server's,
 * e.g. too many markers in a row, or what is wrong with the coordinates) needs reading
 */
export const ERROR_TOAST_MS = 8000;

/** The button to {@link latestAreaMarker}: named after what it lands on, so it doesn't promise a hint and open a hunt. */
export function latestMarkerLabel(marker: Pick<Marker, 'type'>): string {
  return marker.type === MarkerType.Hunt ? 'Naar laatste hunt' : 'Naar laatste hint';
}

/** "Hunt" / "Spot" / "Hint": the marker type as a word for toasts ("Hunt geregistreerd"). */
export function markerNoun(type: MarkerType): string {
  return type === MarkerType.Spot ? 'Spot' : type === MarkerType.Hint ? 'Hint' : 'Hunt';
}

/**
 * The verb the Hunt / Spot dialog uses: a Hunt here is our own marking on the map ("Hunt markeren", "Hunt gemarkeerd op
 * de kaart"), a Spot (and a hint) is registered.
 */
export function markerVerb(type: MarkerType): { infinitive: string; past: string; busy: string } {
  return type === MarkerType.Hunt
    ? { infinitive: 'markeren', past: 'gemarkeerd', busy: 'Markeren…' }
    : { infinitive: 'registreren', past: 'geregistreerd', busy: 'Registreren…' };
}

/** The Hunt / Spot dialog's success toast: "Hunt gemarkeerd op de kaart", "Spot geregistreerd" */
export function markerSavedToast(type: MarkerType): string {
  return type === MarkerType.Hunt ? 'Hunt gemarkeerd op de kaart' : `${markerNoun(type)} geregistreerd`;
}

/**
 * The dialog's main button: "Hunt Alpha markeren" / "Hunt markeren", "Spot Alpha registreren" / "Registreren", and
 * "Opnieuw markeren" / "Opnieuw registreren" after a save that didn't go through.
 * @param area The prefilled area's label (the last one sent), when the form still shows it
 */
export function markerSaveLabel(type: MarkerType, { resave, area }: { resave: boolean; area?: string }): string {
  const { infinitive } = markerVerb(type);
  if (resave) return `Opnieuw ${infinitive}`;
  if (area) return `${markerNoun(type)} ${area} ${infinitive}`;
  return type === MarkerType.Hunt ? 'Hunt markeren' : 'Registreren';
}

/**
 * Every day from the hunt start to its end, as dates at the start's time of day. Compared by calendar day, so the last
 * day counts even when the hunt ends earlier in the day than it started (start Sat 09:00, end Sun 08:00).
 */
export function huntDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const current = new Date(start);
  while (new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime() <= last) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/** The delete confirmation's consequence line: which marker goes, for everyone, for good. */
export function markerDeleteDescription(marker: Pick<Marker, 'area' | 'type' | 'time'>, clock: string): string {
  const area = marker.area.charAt(0).toUpperCase() + marker.area.slice(1);
  return `De ${marker.type} van ${area} (${clock}) verdwijnt voor iedereen van de kaart. Dit kan niet ongedaan worden gemaakt.`;
}

/**
 * Why the Hunt/Spot dialog's Registreren is greyed out, in words (the first missing pick), or null when it can be sent.
 * @param areas The valid Deelgebied values
 */
export function markerMissingPick({ area, day, time }: { area: string; day: unknown; time: unknown }, areas: readonly string[]): string | null {
  if (!areas.includes(area)) return 'Kies eerst een deelgebied.';
  // The same check as the form's resolver (validDate), so the line and the greyed-out button agree
  if (!(day instanceof Date) || Number.isNaN(day.getTime())) return 'Kies eerst een dag.';
  if (!(time instanceof Date) || Number.isNaN(time.getTime())) return 'Vul eerst een tijd in.';
  return null;
}
