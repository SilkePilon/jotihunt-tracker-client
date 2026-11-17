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

/** The delete confirmation's consequence line: which marker goes, for everyone, for good. */
export function markerDeleteDescription(marker: Pick<Marker, 'area' | 'type' | 'time'>, clock: string): string {
  const area = marker.area.charAt(0).toUpperCase() + marker.area.slice(1);
  return `De ${marker.type} van ${area} (${clock}) verdwijnt voor iedereen van de kaart. Dit kan niet ongedaan worden gemaakt.`;
}
