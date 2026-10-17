/** API contract of the jotihunt.nl hunt sync (plan 2026-10-16-hunt-sync). */

export type HuntStatusClass = 'pending' | 'approved' | 'rejected' | 'unknown';

export interface HuntLocation {
  lat: number;
  lng: number;
  /** Metres; null when unknown (an estimate is always at least 150 m) */
  accuracy: number | null;
  /** Guessed from our own trackers at the hunt time (jotihunt.nl shows no location); false when exact */
  estimated: boolean;
  /** The tracker / member the estimate came from, e.g. "Jonas"; null when exact or unknown */
  source: string | null;
}

/** GET /hunts/sync */
export interface HuntSyncStatus {
  /** A jotihunt.nl login is set in Beheer */
  configured: boolean;
  /** A scrape is in progress right now */
  running: boolean;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  /** Dutch, short, e.g. "jotihunt.nl reageert niet" */
  lastError: string | null;
  counts: { approved: number; pending: number; rejected: number; total: number };
  /** Sum of the points of all synced hunts */
  points: number;
}

export type HuntSyncEventType = 'new' | 'approved' | 'rejected' | 'points';

/** GET /hunts/events?limit=&before= (newest first) */
export interface HuntSyncEvent {
  _id: string;
  huntId: string;
  /** Lowercase, e.g. "alpha" */
  area: string;
  type: HuntSyncEventType;
  /** For approved / points */
  points: number | null;
  /** When our sync noticed it */
  at: string;
  /** The hunt time from the site */
  huntTime: string | null;
  location: HuntLocation | null;
}

/** GET /hunts */
export interface SyncedHunt {
  _id: string;
  siteKey: string;
  area: string;
  huntTime: string | null;
  status: HuntStatusClass;
  /** The site's own status text, e.g. "Wacht op bevestiging" */
  statusText: string;
  points: number;
  location: HuntLocation | null;
  firstSeenAt: string;
  statusChangedAt: string | null;
}
