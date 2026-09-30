import { create } from 'zustand';

export type TourMode = 'auto' | 'replay';

interface TourState {
  active: boolean;
  /** 'auto' = first-login tour (reports completion to the server), 'replay' = started from Settings */
  mode: TourMode;
  stepIndex: number;
  stepCount: number;
  /** Last move direction; optional steps with a missing target are skipped this way */
  direction: 1 | -1;
  /** Paused by the user (hover pauses are handled in the card) */
  paused: boolean;
  onEnd?: () => void;
  start: (opts: { mode: TourMode; stepCount: number; onEnd?: () => void }) => void;
  next: () => void;
  prev: () => void;
  togglePause: () => void;
  skip: () => void;
  finish: () => void;
  /** End without reporting completion, e.g. when the layout unmounts. */
  stop: () => void;
}

const INACTIVE = { active: false, stepIndex: 0, stepCount: 0, direction: 1 as const, paused: false, onEnd: undefined };

const useTourStore = create<TourState>()((set, get) => {
  function end() {
    const { onEnd } = get();
    set(INACTIVE);
    onEnd?.();
  }

  return {
    ...INACTIVE,
    mode: 'auto',
    start: ({ mode, stepCount, onEnd }) => set({ active: true, mode, stepCount, onEnd, stepIndex: 0, direction: 1, paused: false }),
    next: () => {
      const { stepIndex, stepCount } = get();
      if (stepIndex >= stepCount - 1) end();
      else set({ stepIndex: stepIndex + 1, direction: 1 });
    },
    prev: () => set((state) => ({ stepIndex: Math.max(0, state.stepIndex - 1), direction: -1 })),
    togglePause: () => set((state) => ({ paused: !state.paused })),
    skip: end,
    finish: end,
    stop: () => set(INACTIVE),
  };
});

export default useTourStore;
