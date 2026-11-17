import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** An attached (already shrunk) chat image */
export interface ChatDraftImage {
  url: string;
  name: string;
}

/** What is typed in one item's AI prompt box */
export interface ChatDraft {
  text: string;
  image?: ChatDraftImage;
}

interface ChatDraftState {
  /** Per article id */
  drafts: Record<number, ChatDraft>;
  setText: (itemId: number, text: string) => void;
  setImage: (itemId: number, image: ChatDraftImage | null) => void;
  clear: (itemId: number) => void;
  /** Put a question that couldn't be sent back, unless something new was typed meanwhile */
  restore: (itemId: number, draft: ChatDraft) => void;
}

function withDraft(drafts: Record<number, ChatDraft>, itemId: number, draft: ChatDraft): Record<number, ChatDraft> {
  const next = { ...drafts };
  if (draft.text === '' && !draft.image) delete next[itemId];
  else next[itemId] = draft;
  return next;
}

/**
 * The AI chat drafts per item: closing the Intel window or opening another item keeps what was typed. The text is
 * kept in sessionStorage (a reload keeps it too); images only in memory (data URLs are too big for storage).
 */
const useChatDraftStore = create<ChatDraftState>()(
  persist(
    (set) => ({
      drafts: {},
      setText: (itemId, text) => set((state) => ({ drafts: withDraft(state.drafts, itemId, { ...state.drafts[itemId], text }) })),
      setImage: (itemId, image) => set((state) => ({ drafts: withDraft(state.drafts, itemId, { text: state.drafts[itemId]?.text ?? '', image: image ?? undefined }) })),
      clear: (itemId) => set((state) => ({ drafts: withDraft(state.drafts, itemId, { text: '' }) })),
      restore: (itemId, draft) =>
        set((state) => {
          const current = state.drafts[itemId];
          if (current?.text || current?.image) return state;
          return { drafts: withDraft(state.drafts, itemId, draft) };
        }),
    }),
    {
      name: 'intel-chat-drafts',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ drafts: Object.fromEntries(Object.entries(state.drafts).flatMap(([id, draft]) => (draft.text ? [[id, { text: draft.text }]] : []))) }),
    },
  ),
);

export default useChatDraftStore;
