import type { Marker } from '@/types/Marker';

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
  split: Date;
  isVisible: (area: string) => boolean;
}

/** Markers in an enabled part whose area isn't hidden. */
export function filterMarkers(markers: Marker[], { part1, part2, split, isVisible }: MarkerFilter): Marker[] {
  return markers.filter((marker) => {
    const time = new Date(marker.time);
    const inPart = (part1 && time < split) || (part2 && time >= split);
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
