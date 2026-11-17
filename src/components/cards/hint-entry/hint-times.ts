import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import { distanceMetres } from '@/lib/own-position';
import { formatDistance } from '@/lib/tracker';
import { areaOptions } from '@/lib/utils';

/** One hour a hint can be registered for */
export interface HintHour {
  /** ISO timestamp of the hour, the form value */
  value: string;
  /** "HH:00" */
  label: string;
  /** Local calendar day, "YYYY-MM-DD" */
  day: string;
  /** A hint for this area and hour is already registered */
  taken: boolean;
}

/** The hours of one calendar day, for the day switch in the time picker */
export interface HintDay {
  key: string;
  /** Full Dutch weekday, e.g. "Zaterdag" */
  label: string;
  hours: HintHour[];
}

const HOUR_MS = 3_600_000;
const WEEKDAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const SHORT_WEEKDAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of a date as "YYYY-MM-DD" */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const hourKey = (date: Date) => `${dayKey(date)}T${pad(date.getHours())}`;

/**
 * Every hour from the hunt start up to now (or the hunt end, whichever is first), marking the hours that already have
 * a hint for the area. Without the markers (still loading, or the first load failed) it isn't known which hours are
 * taken: null, so nothing counts as free.
 */
export function buildHintHours(start: Date, end: Date, now: Date, markers: Marker[] | undefined, area: string): HintHour[] | null {
  if (!markers) return null;
  const last = now < end ? now : end;
  const taken = new Set(
    markers
      .filter((marker) => marker.type === MarkerType.Hint && marker.area === area)
      .map((marker) => hourKey(new Date(marker.time))),
  );
  const hours: HintHour[] = [];
  // Fixed 1-hour steps assume no DST change during the hunt (October hunt ends before the last Sunday of October).
  for (let time = new Date(start); time < last; time = new Date(time.getTime() + HOUR_MS)) {
    hours.push({ value: time.toISOString(), label: `${pad(time.getHours())}:00`, day: dayKey(time), taken: taken.has(hourKey(time)) });
  }
  return hours;
}

/** Group hours per calendar day, in order */
export function groupByDay(hours: HintHour[]): HintDay[] {
  const days: HintDay[] = [];
  for (const hour of hours) {
    const current = days.at(-1);
    if (current?.key === hour.day) current.hours.push(hour);
    else days.push({ key: hour.day, label: WEEKDAYS[new Date(hour.value).getDay()], hours: [hour] });
  }
  return days;
}

/** The day the time picker opens on: the day of the latest free hour (during the hunt that's today), else the last day */
export function defaultDay(days: HintDay[]): string | undefined {
  const latestFree = days.flatMap((day) => day.hours).reverse().find((hour) => !hour.taken);
  return latestFree?.day ?? days.at(-1)?.key;
}

/** Trigger label of a chosen hour: "za 14:00" */
export function shortLabel(iso: string): string {
  const date = new Date(iso);
  return `${SHORT_WEEKDAYS[date.getDay()]} ${pad(date.getHours())}:00`;
}

/** Whether a chosen hour is still listed and free (used when the area changes); never while the hours are unknown */
export function isFreeHour(hours: HintHour[] | null, value: string): boolean {
  return !!hours && hours.some((hour) => hour.value === value && !hour.taken);
}

/** Whether the chosen hour is in the list but taken: a teammate registered a hint for it while this form was open. */
export function isTakenHour(hours: HintHour[] | null, value: string): boolean {
  return !!value && !!hours && hours.some((hour) => hour.value === value && hour.taken);
}

/**
 * Why Registreren still waits once the coordinates are complete: the picks that are missing, said in the status line
 * under the boxes (a greyed-out button alone gives no reason). Null when area and time are both chosen.
 */
export function missingPickText(area: string | undefined, time: string | undefined): string | null {
  if (!area && !time) return 'Kies nog een gebied en tijd';
  if (!area) return 'Kies nog een gebied';
  if (!time) return 'Kies nog een tijd';
  return null;
}

/**
 * The check under the boxes once a typed hint lies in the Netherlands: how far it is from the area's previous hint
 * ("3,2 km van vorige Alpha-hint"), so a typo that jumps across the map stands out. The previous hint is the newest
 * hint of that area from before `at` (the chosen hour; any time when not chosen yet).
 * @param location [lng, lat] of the typed hint
 * @returns null without an area or without an earlier hint of that area (the card then says "Ligt in Nederland")
 */
export function previousHintText(markers: Marker[] | undefined, area: string, at: string, location: [number, number]): string | null {
  const name = areaOptions.find((option) => option.value === area)?.label;
  if (!name || !markers) return null;
  const before = at ? Date.parse(at) : Infinity;
  let previous: Marker | null = null;
  let previousTime = -Infinity;
  for (const marker of markers) {
    if (marker.type !== MarkerType.Hint || marker.area?.toLowerCase() !== area) continue;
    const time = new Date(marker.time).getTime();
    if (!(time < before) || time <= previousTime) continue;
    previous = marker;
    previousTime = time;
  }
  if (!previous) return null;
  const [lng, lat] = previous.location.coordinates;
  const metres = distanceMetres({ lng, lat }, { lng: location[0], lat: location[1] });
  return `${formatDistance(metres)} van vorige ${name}-hint`;
}
