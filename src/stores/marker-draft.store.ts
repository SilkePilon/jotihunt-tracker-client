import { create } from 'zustand';
import type { Marker } from '@/types/Marker';
import type { MarkerType } from '@/types/MarkerType';
import type { LostResponseOutcome } from '@/lib/hint-submit';

/**
 * A Hunt / Spot save that got no answer and wasn't confirmed by a fresh marker list. Kept (in memory, so it outlives
 * the map popup that opened the dialog) until it is confirmed, discarded or replaced by a save that did go through;
 * reopening the same kind of dialog at the same pin restores it.
 */
export interface MarkerDraft {
  type: MarkerType;
  area: string;
  day: Date;
  time: Date;
  /** The marker that was sent: "Opnieuw controleren" looks for it in a fresh list. Its spot keys the draft. */
  sent: Marker;
  outcome: Exclude<LostResponseOutcome, 'registered'>;
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

interface MarkerDraftState {
  /** Kept drafts by `draftKey` */
  drafts: Record<string, MarkerDraft>;
  /** Keep (or replace) the draft for its type and pin */
  keep: (draft: MarkerDraft) => void;
  /** Update a kept draft's form values or outcome (no-op without one) */
  update: (key: string, patch: Partial<Omit<MarkerDraft, 'type' | 'sent'>>) => void;
  clear: (key: string) => void;
}

const useMarkerDraftStore = create<MarkerDraftState>()((set, get) => ({
  drafts: {},
  keep: (draft) => set({ drafts: { ...get().drafts, [keyOfDraft(draft)]: draft } }),
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

export default useMarkerDraftStore;
