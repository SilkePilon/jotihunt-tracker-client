import type { Area } from '@/types/Area';
import type { SyncedHunt } from '@/types/HuntSync';
import { capitalizeFirstLetter } from './utils';

export const HUNT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Time of the latest hunt on an area, from the hunts synced from jotihunt.nl (the site registers each QR hunt with
 * its time). Tegenhunts on the site don't count for the cooldown (since 2024); hunts without a readable time are skipped.
 */
export function lastHuntTimeFor(hunts: SyncedHunt[] | undefined, areaName: string): string | undefined {
  const area = areaName.toLowerCase();
  let latest: string | undefined;
  let latestMs = -Infinity;
  for (const hunt of hunts ?? []) {
    if (hunt.area.toLowerCase() !== area || !hunt.huntTime || hunt.statusText.toLowerCase().includes('tegenhunt')) continue;
    const ms = Date.parse(hunt.huntTime);
    if (Number.isNaN(ms) || ms <= latestMs) continue;
    latest = hunt.huntTime;
    latestMs = ms;
  }
  return latest;
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

/** Sidebar / HQ fox groups: the area status, or `cooldown` while the fox can't be hunted yet. */
export type FoxGroup = 'green' | 'orange' | 'red' | 'cooldown';

/** Display order: huntable now, on the way, free soon, inactive. */
export const FOX_GROUP_ORDER: readonly FoxGroup[] = ['green', 'orange', 'cooldown', 'red'];

export const FOX_GROUP_LABEL: Record<FoxGroup, string> = { green: 'Actief', orange: 'Onderweg', red: 'Inactief', cooldown: 'Cooldown' };

/** A fox in its hunt cooldown is listed under cooldown; an unknown status counts as inactive. */
export function foxGroup(status: string, cooldownMs: number): FoxGroup {
  if (cooldownMs > 0) return 'cooldown';
  return status === 'green' || status === 'orange' ? status : 'red';
}

/** One area's fox in the sidebar "Vossen" card. `key` is the lowercase area name. */
export interface SidebarFox {
  area: Area;
  key: string;
  name: string;
  group: FoxGroup;
  cooldownMs: number;
  lastHunt: Date | string | undefined;
}

/** Every area as a fox, in {@link FOX_GROUP_ORDER}; cooldowns soonest-free first, the rest by area name. */
export function sidebarFoxes({ areas, hunts, now }: { areas: Area[]; hunts?: SyncedHunt[]; now: number }): SidebarFox[] {
  return areas
    .map((area) => {
      const lastHunt = lastHuntTimeFor(hunts, area.name);
      const cooldownMs = huntCooldownMs(lastHunt, now);
      return { area, key: area.name.toLowerCase(), name: capitalizeFirstLetter(area.name), group: foxGroup(area.status, cooldownMs), cooldownMs, lastHunt };
    })
    .sort(
      (a, b) =>
        FOX_GROUP_ORDER.indexOf(a.group) - FOX_GROUP_ORDER.indexOf(b.group) ||
        (a.group === 'cooldown' ? a.cooldownMs - b.cooldownMs : 0) ||
        a.key.localeCompare(b.key),
    );
}

export function groupCounts(foxes: SidebarFox[]): Record<FoxGroup, number> {
  const counts: Record<FoxGroup, number> = { green: 0, orange: 0, cooldown: 0, red: 0 };
  for (const fox of foxes) counts[fox.group] += 1;
  return counts;
}
