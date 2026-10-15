import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ChatModes } from '@/types/IntelChat';

/** Web on (the web tools only run when the AI needs them), Denk diep off (slower, pricier model) */
export const DEFAULT_CHAT_MODES: ChatModes = { web: true, deep: false };

interface IntelChatState {
  /** Per user id: the prompt box modes */
  modes: Record<string, ChatModes>;
  setMode: (userId: string, mode: keyof ChatModes, on: boolean) => void;
}

const useIntelChatStore = create<IntelChatState>()(
  persist(
    (set) => ({
      modes: {},
      setMode: (userId, mode, on) => set((state) => ({ modes: { ...state.modes, [userId]: { ...(state.modes[userId] ?? DEFAULT_CHAT_MODES), [mode]: on } } })),
    }),
    { name: 'intel-chat-modes', storage: createJSONStorage(() => localStorage) },
  ),
);

export default useIntelChatStore;
