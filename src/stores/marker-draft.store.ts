import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import { lostResponseOutcome, type LostResponseOutcome } from '@/lib/hint-submit';

/**
 * A Hunt / Spot save that got no answer and wasn't confirmed by a fresh marker list. Kept (in localStorage, so it
 * outlives the map popup that opened the dialog, a reload and the app being closed) until it is confirmed, discarded or
 * replaced by a save that did go through; reopening the same kind of dialog at the same pin restores it, and the peek
 * strip / sidebar header name it (pendingDraftLine) with a tap that reopens it (`requestOpen`).
 */
export interface MarkerDraft {
  type: MarkerType;
  area: string;
  day: Date;
  time: Date;
  /** The marker that was sent: "Opnieuw controleren" looks for it in a fresh list. Its spot keys the draft. */
  sent: Marker;
  outcome: Exclude<LostResponseOutcome, 'registered'>;
  /** Offline at Registreren: nothing went out (outcome 'absent'); the dialog says so instead of "geen antwoord" */
  notSent?: boolean;
  /** When the save gave up waiting (ms): a check sooner than LOST_RESPONSE_SETTLE_MS after it can't say 'absent' */
  lostAt?: number;
  /** When the draft was kept (ms); `keep` stamps it. Drafts older than DRAFT_MAX_AGE_MS are dropped on load. */
  savedAt?: number;
}

/** A kept draft older than this is dropped when the app loads: by then it is about another evening (or edition) */
export const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** When a draft was kept: its stamp, else (kept before stamps existed) the time the marker was sent; NaN when unknown */
function draftAge(draft: MarkerDraft, now: number): number {
  const at = typeof draft.savedAt === 'number' ? draft.savedAt : new Date(draft.sent?.time ?? NaN).getTime();
  return now - at;
}

/** Pure: the kept drafts that are at most DRAFT_MAX_AGE_MS old at `now` (an unreadable age counts as too old). */
export function freshDrafts(drafts: Record<string, MarkerDraft> | undefined, now: number): Record<string, MarkerDraft> {
  const fresh: Record<string, MarkerDraft> = {};
  for (const [key, draft] of Object.entries(drafts ?? {})) {
    const age = draftAge(draft, now);
    if (Number.isFinite(age) && age <= DRAFT_MAX_AGE_MS) fresh[key] = draft;
  }
  return fresh;
}

/** The form values a draft keeps */
export type MarkerDraftValues = Pick<MarkerDraft, 'area' | 'day' | 'time'>;

/** Decimals the pin's coordinates are rounded to for the key: 5 is ~1 m, so float round-trips still match */
const KEY_DECIMALS = 5;

/** A draft's key: the marker type plus the pin's rounded coordinates, so a draft only comes back at the same pin. */
export const draftKey = (type: MarkerType, lat: number, lng: number) => `${type}:${lat.toFixed(KEY_DECIMALS)}:${lng.toFixed(KEY_DECIMALS)}`;

/** The key of a kept draft, from the spot it was sent with */
export const keyOfDraft = (draft: MarkerDraft) => {
  const [lng, lat] = draft.sent.location.coordinates;
  return draftKey(draft.type, lat, lng);
};

/** A request to open the Hunt / Spot dialog outside a map popup (MarkerRegistrationHost): a kept draft, "Hunt hier" */
export interface RegistrationRequest {
  type: MarkerType;
  lat: number;
  lng: number;
  /** Counts up, so the same pin asked for twice opens the dialog again */
  id: number;
}

interface MarkerDraftState {
  /** Kept drafts by `draftKey` */
  drafts: Record<string, MarkerDraft>;
  /** Keep (or replace) the draft for its type and pin */
  keep: (draft: MarkerDraft) => void;
  /** Update a kept draft's form values or outcome (no-op without one) */
  update: (key: string, patch: Partial<Omit<MarkerDraft, 'type' | 'sent' | 'notSent'>>) => void;
  clear: (key: string) => void;
  /** Drop every kept draft (logout, another edition) */
  clearAll: () => void;
  /** The Deelgebied of the last Hunt/Spot sent this session ('' before any): a fresh dialog starts at it */
  lastArea: string;
  rememberArea: (area: string) => void;
  /** The last open request (MarkerRegistrationHost opens the dialog for each new one); null before any */
  request: RegistrationRequest | null;
  requestOpen: (type: MarkerType, lat: number, lng: number) => void;
}

/** Storage key: drafts only (the last area and open requests are per page session) */
export const MARKER_DRAFT_STORAGE_KEY = 'marker-drafts';

/** The draft's Date fields (`day`, `time`, `sent.time`) come back from JSON as strings: dates again */
export function reviveDraftDates(key: string, value: unknown): unknown {
  if ((key === 'day' || key === 'time') && typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date;
  }
  return value;
}

/** localStorage that never throws (private mode, storage full, blocked site data): the drafts then live in memory only */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Not kept across reloads; still in memory
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Nothing to remove
    }
  },
};

const useMarkerDraftStore = create<MarkerDraftState>()(persist((set, get) => ({
  drafts: {},
  lastArea: '',
  rememberArea: (area) => set({ lastArea: area }),
  request: null,
  requestOpen: (type, lat, lng) => set({ request: { type, lat, lng, id: (get().request?.id ?? 0) + 1 } }),
  keep: (draft) => set({ drafts: { ...get().drafts, [keyOfDraft(draft)]: draft.savedAt === undefined ? { ...draft, savedAt: Date.now() } : draft } }),
  update: (key, patch) => {
    const draft = get().drafts[key];
    if (draft) set({ drafts: { ...get().drafts, [key]: { ...draft, ...patch } } });
  },
  clear: (key) => {
    if (!(key in get().drafts)) return;
    const drafts = { ...get().drafts };
    delete drafts[key];
    set({ drafts });
  },
  clearAll: () => set({ drafts: {} }),
}), {
  name: MARKER_DRAFT_STORAGE_KEY,
  storage: createJSONStorage(() => safeLocalStorage, { reviver: reviveDraftDates }),
  partialize: (state) => ({ drafts: state.drafts }),
  // Stale drafts (another evening) don't come back
  merge: (persisted, current) => ({ ...current, drafts: freshDrafts((persisted as Partial<MarkerDraftState> | undefined)?.drafts, Date.now()) }),
}));

/** An unconfirmed draft of this type kept for another pin (the latest one), for the "nog niet bevestigd" note; else null. */
export function draftElsewhere(drafts: Record<string, MarkerDraft>, type: MarkerType, key: string): MarkerDraft | null {
  const others = Object.entries(drafts).filter(([otherKey, draft]) => otherKey !== key && draft.type === type);
  return others.length ? others[others.length - 1][1] : null;
}

/** Whether two sets of form values would send the same marker: area, day and the time to the minute. */
export function sameMarkerValues(a: MarkerDraftValues, b: MarkerDraftValues): boolean {
  const day = (value: Date) => new Date(value).toDateString();
  const minute = (value: Date) => {
    const time = new Date(value);
    return time.getHours() * 60 + time.getMinutes();
  };
  return a.area === b.area && day(a.day) === day(b.day) && minute(a.time) === minute(b.time);
}

/** Kept drafts per type: what the "niet bevestigd" line counts */
export function draftCounts(drafts: Record<string, MarkerDraft>): { hunt: number; spot: number } {
  const all = Object.values(drafts);
  return { hunt: all.filter((draft) => draft.type === MarkerType.Hunt).length, spot: all.filter((draft) => draft.type === MarkerType.Spot).length };
}

/**
 * The line in the peek strip / sidebar header while drafts wait: "1 hunt niet bevestigd — tik om te controleren",
 * "2 hunts en 1 spot niet bevestigd — …"; null without any.
 */
export function pendingDraftLine(drafts: Record<string, MarkerDraft>): string | null {
  const { hunt, spot } = draftCounts(drafts);
  const part = (count: number, noun: string) => (count ? `${count} ${noun}${count === 1 ? '' : 's'}` : null);
  const parts = [part(hunt, 'hunt'), part(spot, 'spot')].filter(Boolean);
  if (!parts.length) return null;
  return `${parts.join(' en ')} niet bevestigd — tik om te controleren`;
}

/** The draft the line's tap opens: the latest one kept (the one most likely still on the user's mind) */
export function latestDraft(drafts: Record<string, MarkerDraft>): MarkerDraft | null {
  const all = Object.values(drafts);
  return all.length ? all[all.length - 1] : null;
}

/**
 * Check every kept draft against a fresh marker list (back online): the ones that did go through are cleared and
 * returned (for a toast); the rest keep their values with the new outcome ('absent', or 'unknown' while a list read
 * within LOST_RESPONSE_SETTLE_MS of the timeout can't rule out a late save; `checkedAt`: when the list was fetched). Without a list nothing changes. Only checks, never sends anything again.
 */
export function settleDrafts(fresh: Marker[] | undefined, checkedAt = Date.now()): MarkerDraft[] {
  // No list either: nothing learned, every draft stays as it was
  if (!fresh) return [];
  const store = useMarkerDraftStore.getState();
  const confirmed: MarkerDraft[] = [];
  for (const [key, draft] of Object.entries(store.drafts)) {
    const outcome = lostResponseOutcome(fresh, draft.sent, draft.lostAt, checkedAt);
    if (outcome === 'registered') {
      store.clear(key);
      confirmed.push(draft);
    } else if (outcome !== draft.outcome) {
      store.update(key, { outcome });
    }
  }
  return confirmed;
}

/** Open the registration dialog at a kept draft's pin (MarkerRegistrationHost flies the map there) */
export function reopenDraft(draft: MarkerDraft) {
  const [lng, lat] = draft.sent.location.coordinates;
  useMarkerDraftStore.getState().requestOpen(draft.type, lat, lng);
}

export default useMarkerDraftStore;
