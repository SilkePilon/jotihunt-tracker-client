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
  /** Put a question that couldn't be sent back; when something new was typed meanwhile, the question goes above it */
  restore: (itemId: number, draft: ChatDraft) => RestoreResult;
}

/** How `restore` put a failed question back */
export interface RestoreResult {
  /** Something new was typed meanwhile: the question went above it */
  merged: boolean;
  /** The question's image could not go back: a newer image is attached */
  imageDropped: boolean;
}

/** The failed question in front of what was typed since (no doubling when it is already there); the newer image wins */
export function mergeDrafts(failed: ChatDraft, current: ChatDraft | undefined): { draft: ChatDraft } & RestoreResult {
  if (!current?.text && !current?.image) return { draft: failed, merged: false, imageDropped: false };
  const text = !current.text ? failed.text : !failed.text || current.text.startsWith(failed.text) ? current.text : `${failed.text}\n${current.text}`;
  const image = current.image ?? failed.image;
  return { draft: { text, image }, merged: true, imageDropped: !!failed.image && !!current.image && failed.image.url !== current.image.url };
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
    (set, get) => ({
      drafts: {},
      setText: (itemId, text) => set((state) => ({ drafts: withDraft(state.drafts, itemId, { ...state.drafts[itemId], text }) })),
      setImage: (itemId, image) => set((state) => ({ drafts: withDraft(state.drafts, itemId, { text: state.drafts[itemId]?.text ?? '', image: image ?? undefined }) })),
      clear: (itemId) => set((state) => ({ drafts: withDraft(state.drafts, itemId, { text: '' }) })),
      restore: (itemId, draft) => {
        const { draft: next, ...result } = mergeDrafts(draft, get().drafts[itemId]);
        set((state) => ({ drafts: withDraft(state.drafts, itemId, next) }));
        return result;
      },
    }),
    {
      name: 'intel-chat-drafts',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ drafts: Object.fromEntries(Object.entries(state.drafts).flatMap(([id, draft]) => (draft.text ? [[id, { text: draft.text }]] : []))) }),
    },
  ),
);

export default useChatDraftStore;
