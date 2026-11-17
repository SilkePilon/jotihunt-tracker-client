import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
}

const useHintDraftStore = create<HintDraftState>()(
  persist(
    (set) => ({
      draft: EMPTY_HINT_DRAFT,
      save: (draft) => set({ draft: { area: draft.area ?? '', time: draft.time ?? '', x: draft.x ?? '', y: draft.y ?? '' } }),
      clear: () => set({ draft: EMPTY_HINT_DRAFT }),
    }),
    { name: 'hint-draft', storage: createJSONStorage(() => sessionStorage) },
  ),
);

export default useHintDraftStore;
