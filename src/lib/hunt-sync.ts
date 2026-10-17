import type { HuntLocation, HuntSyncEvent, HuntSyncStatus, SyncedHunt } from '@/types/HuntSync';
import { formatAgo } from './life360';
import { capitalizeFirstLetter } from './utils';

/** What the Hunts card shows: synced, a scrape running, the last scrape failed, or no jotihunt.nl login. */
export type HuntSyncView = 'synced' | 'syncing' | 'failing' | 'unlinked';

/**
 * The card's state. A failure only counts while it is newer than the last success (lastError can linger from an
 * earlier attempt); a running scrape wins over a failure, so the spinner shows while it retries.
 */
export function huntSyncView(status: HuntSyncStatus): HuntSyncView {
  if (!status.configured) return 'unlinked';
  if (status.running) return 'syncing';
  if (status.lastError && !succeededSinceLastAttempt(status)) return 'failing';
  return 'synced';
}

function succeededSinceLastAttempt(status: HuntSyncStatus): boolean {
  if (!status.lastSuccessAt) return false;
  if (!status.lastAttemptAt) return true;
  return Date.parse(status.lastSuccessAt) >= Date.parse(status.lastAttemptAt);
}

export const HUNT_SYNC_TITLE: Record<HuntSyncView, string> = {
  synced: 'Gesynchroniseerd',
  syncing: 'Synchroniseert…',
  failing: 'Synchroniseert',
  unlinked: 'Niet gekoppeld',
};

const hunts = (count: number) => `${count} ${count === 1 ? 'hunt' : 'hunts'}`;

/**
 * The line under the title: "jotihunt.nl · 12 s geleden · 9 hunts · 70 pnt" (synced), "jotihunt.nl · hunts ophalen"
 * (syncing), "laatst gelukt 4 min geleden · probeert opnieuw" (failing), the Beheer hint (unlinked).
 */
export function huntSyncLine(status: HuntSyncStatus, now: number): string {
  switch (huntSyncView(status)) {
    case 'unlinked':
      return 'Een beheerder koppelt het jotihunt.nl-account in Beheer.';
    case 'syncing':
      return 'jotihunt.nl · hunts ophalen';
    case 'failing': {
      const ago = formatAgo(status.lastSuccessAt, now);
      return ago ? `laatst gelukt ${ago} · probeert opnieuw` : 'nog niet gelukt · probeert opnieuw';
    }
    case 'synced':
      return ['jotihunt.nl', formatAgo(status.lastSuccessAt, now), hunts(status.counts.total), `${status.points} pnt`].filter(Boolean).join(' · ');
  }
}

/** Collapsed header: "70 pnt · 1 wacht", "Niet gekoppeld"; undefined while loading. */
export function huntSyncSummary(status: HuntSyncStatus | undefined): string | undefined {
  if (!status) return undefined;
  if (!status.configured) return 'Niet gekoppeld';
  const pending = status.counts.pending;
  return pending > 0 ? `${status.points} pnt · ${pending} wacht` : `${status.points} pnt`;
}

/** One log line in parts: the bold area, what happened, and a points tag ("+10") for approved hunts. */
export interface HuntEventParts {
  area: string;
  text: string;
  points: string | null;
}

export function huntEventParts(event: HuntSyncEvent): HuntEventParts {
  const area = capitalizeFirstLetter(event.area);
  switch (event.type) {
    case 'new':
      return { area, text: 'binnengekomen', points: null };
    case 'approved':
      return { area, text: 'goedgekeurd', points: event.points ? `+${event.points}` : null };
    case 'rejected':
      return { area, text: 'afgekeurd', points: null };
    case 'points':
      return { area, text: event.points === null ? 'punten aangepast' : `punten aangepast · ${event.points}`, points: null };
  }
}

/** The log line's time: a new hunt shows its hunt time from the site (when known), a verdict or points change when we noticed it. */
export function huntEventTime(event: HuntSyncEvent): string {
  if (event.type === 'new' && event.huntTime && !Number.isNaN(Date.parse(event.huntTime))) return event.huntTime;
  return event.at;
}

/** "Alpha binnengekomen", "Delta goedgekeurd +10", "Echo afgekeurd", "Delta punten aangepast · 15". */
export function huntEventText(event: HuntSyncEvent): string {
  const { area, text, points } = huntEventParts(event);
  return [area, text, points].filter(Boolean).join(' ');
}

/** The result bar's segments, as fractions of the bar (0 when there are no hunts yet). */
export function resultBarShares(counts: HuntSyncStatus['counts']): { approved: number; pending: number; rejected: number } {
  const sum = counts.approved + counts.pending + counts.rejected;
  if (sum === 0) return { approved: 0, pending: 0, rejected: 0 };
  return { approved: counts.approved / sum, pending: counts.pending / sum, rejected: counts.rejected / sum };
}

/**
 * A hunt location from the API with its newer fields defaulted: older servers omit `estimated` / `source` (read as an
 * exact location); anything without finite coordinates is no location.
 */
export function normalizeHuntLocation(location: unknown): HuntLocation | null {
  if (!location || typeof location !== 'object') return null;
  const raw = location as Partial<Record<keyof HuntLocation, unknown>>;
  if (typeof raw.lat !== 'number' || typeof raw.lng !== 'number' || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lng)) return null;
  const accuracy = typeof raw.accuracy === 'number' && Number.isFinite(raw.accuracy) ? raw.accuracy : null;
  const estimated = raw.estimated === true;
  const source = estimated && typeof raw.source === 'string' && raw.source.trim() ? raw.source.trim() : null;
  return { lat: raw.lat, lng: raw.lng, accuracy, estimated, source };
}

/** A sync log line or synced hunt with its location normalised (same object when nothing changes, so memo keeps working). */
function withNormalizedLocation<T extends { location: HuntLocation | null }>(item: T): T {
  const location = normalizeHuntLocation(item.location);
  const current = item.location;
  if (location === current) return item;
  if (location && current && location.lat === current.lat && location.lng === current.lng && location.accuracy === current.accuracy && location.estimated === current.estimated && location.source === current.source) return item;
  return { ...item, location };
}

export const normalizeHuntEvent = (event: HuntSyncEvent): HuntSyncEvent => withNormalizedLocation(event);
export const normalizeSyncedHunt = (hunt: SyncedHunt): SyncedHunt => withNormalizedLocation(hunt);

/** "Geschatte locatie · via Jonas" / "Geschatte locatie" for an estimated location; null for an exact one (or none). */
export function huntLocationNote(location: HuntLocation | null | undefined): string | null {
  if (!location?.estimated) return null;
  return location.source ? `Geschatte locatie · via ${location.source}` : 'Geschatte locatie';
}

/** The synced hunt a map marker was made from (the server's "jotihunt" markers carry the hunt's siteKey as externalId). */
export function syncedHuntForMarker(marker: { source?: string; externalId?: string }, hunts: SyncedHunt[] | undefined): SyncedHunt | undefined {
  if (marker.source !== 'jotihunt' || !marker.externalId) return undefined;
  return hunts?.find((hunt) => hunt.siteKey === marker.externalId);
}

/** Pages of the sync log, newest first, locations normalised; duplicates (same `at` on a page boundary) are dropped. */
export function flattenEventPages(pages: HuntSyncEvent[][] | undefined): HuntSyncEvent[] {
  const seen = new Set<string>();
  const events: HuntSyncEvent[] = [];
  for (const page of pages ?? []) {
    if (!Array.isArray(page)) continue;
    for (const event of page) {
      if (seen.has(event._id)) continue;
      seen.add(event._id);
      events.push(normalizeHuntEvent(event));
    }
  }
  return events;
}

export const HUNT_EVENTS_PAGE_SIZE = 50;

/** SWR infinite key path for page `index` of the sync log; null once the previous page came back short (the end). */
export function huntEventsPath(index: number, previous: HuntSyncEvent[] | null): string | null {
  if (index === 0) return `/hunts/events?limit=${HUNT_EVENTS_PAGE_SIZE}`;
  if (!previous || previous.length < HUNT_EVENTS_PAGE_SIZE) return null;
  return `/hunts/events?limit=${HUNT_EVENTS_PAGE_SIZE}&before=${encodeURIComponent(previous[previous.length - 1].at)}`;
}
