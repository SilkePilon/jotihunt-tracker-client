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

/**
 * When the last running hunt cooldown ends (ms since epoch; may lie in the past), or undefined without any hunt.
 * The sidebar only needs a per-second clock until then.
 */
export function lastCooldownEnd(areas: Area[], hunts: SyncedHunt[] | undefined): number | undefined {
  let end: number | undefined;
  for (const area of areas) {
    const lastHunt = lastHuntTimeFor(hunts, area.name);
    if (!lastHunt) continue;
    const areaEnd = new Date(lastHunt).getTime() + HUNT_COOLDOWN_MS;
    if (end === undefined || areaEnd > end) end = areaEnd;
  }
  return end;
}

/** Pill colours per fox status (and for a fox still in its hunt cooldown): the fox-* tonal tokens, light and dark. */
export const COOLDOWN_PILL_CLASS = 'border-fox-cooldown/30 bg-fox-cooldown-container text-fox-on-cooldown';

export function statusPillClass(status: string): string {
  switch (status) {
    case 'green':
      return 'border-fox-ok/30 bg-fox-ok-container text-fox-on-ok';
    case 'orange':
      return 'border-fox-warn/30 bg-fox-warn-container text-fox-on-warn';
    case 'red':
      return 'border-fox-error/30 bg-fox-error-container text-fox-on-error';
    case 'blue':
      return 'border-fox-ov/30 bg-fox-ov-container text-fox-on-ov';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

/** Sidebar / HQ fox groups: the area status (`blue` = ov), or `cooldown` while the fox can't be hunted yet. */
export type FoxGroup = 'green' | 'orange' | 'ov' | 'red' | 'cooldown';

/** Display order: huntable now, on the way, by OV (not huntable), free soon, inactive. */
export const FOX_GROUP_ORDER: readonly FoxGroup[] = ['green', 'orange', 'ov', 'cooldown', 'red'];

export const FOX_GROUP_LABEL: Record<FoxGroup, string> = { green: 'Actief', orange: 'Onderweg', ov: 'OV', red: 'Inactief', cooldown: 'Cooldown' };

/** Dutch status text for tooltips ("Oscar: met OV"). */
export const FOX_STATUS_TEXT: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood', blue: 'met OV' };

/**
 * `blue` (travelling by OV, not huntable) is its own group, also during a cooldown; otherwise a fox in its hunt
 * cooldown is listed under cooldown; an unknown status counts as inactive.
 */
export function foxGroup(status: string, cooldownMs: number): FoxGroup {
  if (status === 'blue') return 'ov';
  if (cooldownMs > 0) return 'cooldown';
  return status === 'green' || status === 'orange' ? status : 'red';
}

/** Legend items: every group, but `ov` only while a fox travels by OV (normally four items). */
export function legendGroups(counts: Record<FoxGroup, number>): FoxGroup[] {
  return FOX_GROUP_ORDER.filter((group) => group !== 'ov' || counts.ov > 0);
}

/** How long a fox has been on OV: "< 1 min", "12 min", "1 u 5 min", "2 u". */
export function formatOvDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} u ${rest} min` : `${hours} u`;
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

/** Same fox as far as its chip shows (the list is rebuilt every tick, so the objects themselves are always new). */
export function sameSidebarFox(a: SidebarFox, b: SidebarFox): boolean {
  return a === b || (a.area === b.area && a.key === b.key && a.name === b.name && a.group === b.group && a.cooldownMs === b.cooldownMs && a.lastHunt === b.lastHunt);
}

export function groupCounts(foxes: SidebarFox[]): Record<FoxGroup, number> {
  const counts: Record<FoxGroup, number> = { green: 0, orange: 0, ov: 0, cooldown: 0, red: 0 };
  for (const fox of foxes) counts[fox.group] += 1;
  return counts;
}
