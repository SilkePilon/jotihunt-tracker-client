import { create } from 'zustand';
import { useHintFormBridge } from '@/hooks/hint-bridge.hook';
import { fillPattern, guessAnswerText, type GuessFormat } from '@/lib/hint-guess';
import useIntelStore from '@/stores/intel.store';

/** Where the guess was typed: the Hint registreren card or an Intel hint row */
export type GuessSource = 'card' | 'intel';

export interface GuessInput {
  source: GuessSource;
  /** Digit patterns with '?' (4 or 6 characters each) */
  x: string;
  y: string;
  /** Area key for the reach circle, null when unknown */
  area: string | null;
  /** Epoch ms of the hint hour, null when unknown */
  at: number | null;
  /** Intel only: the hint article to reopen on a pick */
  articleId: number | null;
  format: GuessFormat;
}

/** A picked Intel answer waiting for its row to open again (filled in, not saved) */
export interface PendingAnswer {
  id: number;
  articleId: number;
  area: string;
  text: string;
}

interface HintGuessState {
  /** The one guess on the map (only the person typing sees it) */
  input: GuessInput | null;
  pendingAnswer: PendingAnswer | null;
  show: (input: GuessInput) => void;
  /** Clear the guess; with a source only when it came from there */
  clear: (source?: GuessSource) => void;
  /** Fill every '?' with `digit` and hand the answer back to where it was typed */
  pick: (digit: number) => void;
  clearPending: (id: number) => void;
}

const sameInput = (a: GuessInput | null, b: GuessInput) =>
  !!a && a.source === b.source && a.x === b.x && a.y === b.y && a.area === b.area && a.at === b.at && a.articleId === b.articleId && a.format === b.format;

let pendingCount = 0;

const useHintGuessStore = create<HintGuessState>()((set, get) => ({
  input: null,
  pendingAnswer: null,
  // The card calls this from an effect on every render with typed values: an equal input keeps the same object
  show: (input) => {
    if (!sameInput(get().input, input)) set({ input });
  },
  clear: (source) => {
    const current = get().input;
    if (current && (!source || current.source === source)) set({ input: null });
  },
  pick: (digit) => {
    const input = get().input;
    if (!input) return;
    const x = fillPattern(input.x, digit);
    const y = fillPattern(input.y, digit);
    set({ input: null });
    if (input.source === 'card') {
      useHintFormBridge.getState().setCoords(x, y);
    } else if (input.articleId !== null && input.area) {
      pendingCount += 1;
      set({ pendingAnswer: { id: pendingCount, articleId: input.articleId, area: input.area, text: guessAnswerText(x, y, input.format) } });
      useIntelStore.getState().openIntel(input.articleId, input.area);
    }
  },
  clearPending: (id) => {
    if (get().pendingAnswer?.id === id) set({ pendingAnswer: null });
  },
}));

export default useHintGuessStore;
