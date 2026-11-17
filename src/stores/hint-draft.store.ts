import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UnconfirmedHint } from '@/lib/hint-submit';

/** The hint entry form as typed; survives leaving the phone page (and a reload in the same tab). */
export interface HintDraft {
  area: string;
  time: string;
  x: string;
  y: string;
}

export const EMPTY_HINT_DRAFT: HintDraft = { area: '', time: '', x: '', y: '' };

interface HintDraftState {
  draft: HintDraft;
  save: (draft: HintDraft) => void;
  clear: () => void;
  /**
   * The last hint whose Registreren got no answer and wasn't confirmed yet. Kept with the draft so leaving the phone
   * page doesn't turn Registreren live again (a second send) or show our own late hint as "iemand anders".
   * Its `sent.time` comes back from sessionStorage as a string; the marker compare reads both.
   */
  pending: UnconfirmedHint | null;
  setPending: (pending: UnconfirmedHint | null) => void;
}

const useHintDraftStore = create<HintDraftState>()(
  persist(
    (set) => ({
      draft: EMPTY_HINT_DRAFT,
      save: (draft) => set({ draft: { area: draft.area ?? '', time: draft.time ?? '', x: draft.x ?? '', y: draft.y ?? '' } }),
      clear: () => set({ draft: EMPTY_HINT_DRAFT }),
      pending: null,
      setPending: (pending) => set({ pending }),
    }),
    { name: 'hint-draft', storage: createJSONStorage(() => sessionStorage) },
  ),
);

export default useHintDraftStore;
