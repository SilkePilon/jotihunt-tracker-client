import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

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
 * a hint for the area.
 */
export function buildHintHours(start: Date, end: Date, now: Date, markers: Marker[] | undefined, area: string): HintHour[] {
  const last = now < end ? now : end;
  const taken = new Set(
    (markers ?? [])
      .filter((marker) => marker.type === MarkerType.Hint && marker.area === area)
      .map((marker) => hourKey(new Date(marker.time))),
  );
  const hours: HintHour[] = [];
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

/** Whether a chosen hour is still listed and free (used when the area changes) */
export function isFreeHour(hours: HintHour[], value: string): boolean {
  return hours.some((hour) => hour.value === value && !hour.taken);
}
