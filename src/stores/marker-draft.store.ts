import { create } from 'zustand';
import type { Marker } from '@/types/Marker';
import type { MarkerType } from '@/types/MarkerType';
import type { LostResponseOutcome } from '@/lib/hint-submit';

/**
 * A Hunt / Spot save that got no answer and wasn't confirmed by a fresh marker list. Kept (in memory, so it outlives
 * the map popup that opened the dialog) until it is confirmed, discarded or replaced by a save that did go through;
 * reopening the same kind of dialog restores it.
 */
export interface MarkerDraft {
  type: MarkerType;
  area: string;
  day: Date;
  time: Date;
  /** The marker that was sent: "Opnieuw controleren" looks for it in a fresh list */
  sent: Marker;
  outcome: Exclude<LostResponseOutcome, 'registered'>;
}

interface MarkerDraftState {
  draft: MarkerDraft | null;
  keep: (draft: MarkerDraft) => void;
  /** Update the kept draft's form values or outcome (no-op without one) */
  update: (patch: Partial<Omit<MarkerDraft, 'type' | 'sent'>>) => void;
  clear: () => void;
}

const useMarkerDraftStore = create<MarkerDraftState>()((set, get) => ({
  draft: null,
  keep: (draft) => set({ draft }),
  update: (patch) => {
    const { draft } = get();
    if (draft) set({ draft: { ...draft, ...patch } });
  },
  clear: () => set({ draft: null }),
}));

/** The kept draft when it belongs to a dialog of this marker type, else null. */
export const draftForType = (draft: MarkerDraft | null, type: MarkerType): MarkerDraft | null => (draft?.type === type ? draft : null);

export default useMarkerDraftStore;
