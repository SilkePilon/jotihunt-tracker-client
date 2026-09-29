import type { Area } from '@/types/Area';
import type { Hunt } from '@/types/Hunt';
import type { HuntReport } from '@/types/HuntReport';

export const HUNT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Time of the latest hunt on an area, from the scraped jotihunt.nl hunts and the app's own reports (so the
 * cooldown starts at registration). Tegenhunts don't count for the cooldown (since 2024).
 */
export function lastHuntTimeFor(hunts: Hunt[] | undefined, areaName: string, reports?: HuntReport[]): Date | string | undefined {
  const area = areaName.toLowerCase();
  const times: (Date | string)[] = [
    ...(hunts ?? []).filter((hunt) => !hunt.status.toLowerCase().includes('tegenhunt') && hunt.area.toLowerCase() === area).map((hunt) => hunt.huntTime),
    // Only once the time on the sticker is known (read from the photo or entered by an admin), not the upload time
    ...(reports ?? []).filter((report) => report.kind === 'hunt' && report.huntTimeKnown && report.area === area).map((report) => report.huntTime),
  ];
  return times
    .filter((time) => !Number.isNaN(new Date(time).getTime()))
    .reduce<Date | string | undefined>((latest, time) => (!latest || new Date(time).getTime() > new Date(latest).getTime() ? time : latest), undefined);
}

/**
 * Milliseconds until an area can be hunted again (0 when huntable).
 */
export function huntCooldownMs(lastHuntTime: Date | string | undefined, now: number): number {
  if (!lastHuntTime) return 0;
  return Math.max(0, new Date(lastHuntTime).getTime() + HUNT_COOLDOWN_MS - now);
}

/** Pill colours per fox status (and for a fox still in its hunt cooldown), light and dark mode. */
export const COOLDOWN_PILL_CLASS = 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300';

export function statusPillClass(status: string): string {
  switch (status) {
    case 'green':
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-400';
    case 'orange':
      return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300';
    case 'red':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-500/30 dark:bg-gray-500/15 dark:text-gray-300';
  }
}

/**
 * Dutch summary like "3 groen · 3 oranje · 3 rood".
 */
export function statusSummary(areas: Area[]): string {
  const count = (status: string) => areas.filter((area) => area.status === status).length;
  return `${count('green')} groen · ${count('orange')} oranje · ${count('red')} rood`;
}
