import type { Area } from '@/types/Area';
import type { Hunt } from '@/types/Hunt';
import { formatHintCountdown } from '@/lib/next-hint';

export const HUNT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Time of the latest hunt on an area. Tegenhunts don't count for the cooldown (since 2024).
 * Assumes hunts are sorted newest first, as the API returns them.
 */
export function lastHuntTimeFor(hunts: Hunt[] | undefined, areaName: string): Date | string | undefined {
  return hunts
    ?.filter((hunt) => !hunt.status.toLowerCase().includes('tegenhunt'))
    .find((hunt) => hunt.area.toLowerCase() === areaName.toLowerCase())?.huntTime;
}

/**
 * Milliseconds until an area can be hunted again (0 when huntable).
 */
export function huntCooldownMs(lastHuntTime: Date | string | undefined, now: number): number {
  if (!lastHuntTime) return 0;
  return Math.max(0, new Date(lastHuntTime).getTime() + HUNT_COOLDOWN_MS - now);
}

/**
 * Tailwind classes for a fox status pill.
 */
export function statusPillClass(status: string): string {
  switch (status) {
    case 'green':
      return 'bg-green-100 border-green-400 text-green-700';
    case 'orange':
      return 'bg-orange-100 border-orange-400 text-orange-700';
    case 'red':
      return 'bg-red-100 border-red-400 text-red-700';
    default:
      return 'bg-gray-100 border-gray-400 text-gray-700';
  }
}

/**
 * Dutch summary like "3 groen · 3 oranje · 3 rood".
 */
export function statusSummary(areas: Area[]): string {
  const count = (status: string) => areas.filter((area) => area.status === status).length;
  return `${count('green')} groen · ${count('orange')} oranje · ${count('red')} rood`;
}

/**
 * Summary of areas still cooling down, like "A 23:12 · D 04:10".
 * Returns undefined when no area is cooling down.
 */
export function cooldownSummary(areas: Area[], hunts: Hunt[] | undefined, now: number): string | undefined {
  const entries = areas
    .map((area) => ({
      letter: area.name.charAt(0).toUpperCase(),
      cooldown: huntCooldownMs(lastHuntTimeFor(hunts, area.name), now),
    }))
    .filter((entry) => entry.cooldown > 0)
    .map((entry) => `${entry.letter} ${formatHintCountdown(entry.cooldown)}`);
  return entries.length ? entries.join(' · ') : undefined;
}
