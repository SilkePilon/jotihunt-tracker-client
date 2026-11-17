import type { SheetSnap } from './sheet-snaps';
import type { MobilePageId } from './mobile-nav';

/**
 * Session continuity: a reload (or the OS killing the PWA in the background) brings you back where you were, the map
 * at the same spot and the phone sheet on the same page, as long as that was recent. Older state is a new session and
 * starts from the overview again.
 */
export const CONTINUITY_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const SAVED_VIEW_KEY = 'map-view';
export const SAVED_PAGE_KEY = 'mobile-page';

export interface SavedView {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface SavedPage {
  id: MobilePageId;
  snap: SheetSnap;
}

const PAGE_IDS: ReadonlySet<string> = new Set<MobilePageId>(['foxes', 'hints', 'points', 'hunts', 'predictions', 'hintEntry', 'counterHunt', 'telegram', 'tracking', 'life360', 'jotiboard']);
const SNAPS: ReadonlySet<string> = new Set<SheetSnap>(['peek', 'half', 'full']);

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The stored record's payload when it parses and was saved at most CONTINUITY_MAX_AGE_MS before `now` (not in the future). */
export function freshRecord(raw: string | null, now: number): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const ts = record.ts;
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return undefined;
  const age = now - ts;
  // A clock that jumped back a little is fine; a timestamp from the future is not
  if (age > CONTINUITY_MAX_AGE_MS || age < -60_000) return undefined;
  return record;
}

const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** A fresh, well-formed saved map view, else undefined. */
export function parseSavedView(raw: string | null, now: number): SavedView | undefined {
  const record = freshRecord(raw, now);
  if (!record) return undefined;
  const { longitude, latitude, zoom, bearing, pitch } = record;
  if (!isNum(longitude) || !isNum(latitude) || !isNum(zoom) || !isNum(bearing) || !isNum(pitch)) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || zoom < 0 || zoom > 24 || pitch < 0 || pitch > 90) return undefined;
  return { longitude, latitude, zoom, bearing, pitch };
}

/** A fresh saved phone page with a known id, else undefined. */
export function parseSavedPage(raw: string | null, now: number): SavedPage | undefined {
  const record = freshRecord(raw, now);
  if (!record) return undefined;
  const { id, snap } = record;
  if (typeof id !== 'string' || !PAGE_IDS.has(id)) return undefined;
  return { id: id as MobilePageId, snap: typeof snap === 'string' && SNAPS.has(snap) ? (snap as SheetSnap) : 'full' };
}

/** Storage may be missing or throw (private mode, blocked site data, quota): continuity is a nicety, never an error. */
function storage(kind: 'localStorage' | 'sessionStorage'): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window[kind];
  } catch {
    return undefined;
  }
}

function read(kind: 'localStorage' | 'sessionStorage', key: string): string | null {
  try {
    return storage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(kind: 'localStorage' | 'sessionStorage', key: string, value: object | null, now: number) {
  try {
    const target = storage(kind);
    if (!target) return;
    if (value) target.setItem(key, JSON.stringify({ ...value, ts: now }));
    else target.removeItem(key);
  } catch {
    // Ignore: see storage()
  }
}

export const loadSavedView = (now = Date.now()) => parseSavedView(read('localStorage', SAVED_VIEW_KEY), now);
export const saveView = (view: SavedView, now = Date.now()) => write('localStorage', SAVED_VIEW_KEY, view, now);

export const loadSavedPage = (now = Date.now()) => parseSavedPage(read('sessionStorage', SAVED_PAGE_KEY), now);
/** null: the sheet is on its menu, nothing to restore. */
export const savePage = (page: SavedPage | null, now = Date.now()) => write('sessionStorage', SAVED_PAGE_KEY, page, now);
