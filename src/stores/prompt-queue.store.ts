import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * The follow-up prompts after sign-in / the tour. Each decides on its own whether it is due (eligibility stays in its
 * hook); this queue only decides when it may show, so they never stack: at most one at a time, in this order.
 */
export const PROMPTS = ['notifications', 'android-promo', 'pwa-install', 'passkey'] as const;
export type PromptId = (typeof PROMPTS)[number];

/** Between one prompt closing (or the tour ending, or a prompt being asked for) and the next one showing */
export const PROMPT_GAP_MS = 1500;
/** Right after the tour, prompts wait this long while the user is busy with the map */
export const AFTER_TOUR_QUIET_MS = 10_000;

export interface PromptQueueTimes {
  /** Waiting prompts, with when each was asked for */
  waiting: Partial<Record<PromptId, number>>;
  /** The prompt on screen now */
  active: PromptId | null;
  /** Nothing shows while held (the tour is due or running) */
  held: boolean;
  /** Dialogs and drawers open now (Account, Beheer, a confirm…): nothing shows over them */
  openModals: number;
  /** No prompt before this (a gap after the last one closed or the tour ended) */
  readyAt: number;
  /** When the hold (tour) last ended; null when there was none */
  tourEndedAt: number | null;
  /** Last pointer/wheel on the map */
  mapTouchedAt: number | null;
}

/** What the queue does now: show a prompt, check again after `waitMs`, or nothing (idle, held or one is on screen). */
export type QueueStep = { show: PromptId } | { waitMs: number } | null;

/** Pure: the next step of the queue at `now`. */
export function nextPromptStep(times: PromptQueueTimes, now: number): QueueStep {
  if (times.held || times.active || times.openModals > 0) return null;
  const id = PROMPTS.find((prompt) => times.waiting[prompt] !== undefined);
  if (!id) return null;
  let at = Math.max(times.readyAt, times.waiting[id]! + PROMPT_GAP_MS);
  // The map was used since the tour ended: leave the user alone for the first seconds after it
  if (times.tourEndedAt !== null && times.mapTouchedAt !== null && times.mapTouchedAt >= times.tourEndedAt) {
    at = Math.max(at, times.tourEndedAt + AFTER_TOUR_QUIET_MS);
  }
  return at <= now ? { show: id } : { waitMs: at - now };
}

interface PromptQueueState extends PromptQueueTimes {
  /** Ask for a turn (no-op when already waiting or on screen) */
  request: (id: PromptId, now?: number) => void;
  /** No longer due: leave the queue (a prompt on screen stays until {@link done}) */
  cancel: (id: PromptId) => void;
  /** The prompt was closed: the next may follow after the gap */
  done: (id: PromptId, now?: number) => void;
  setHeld: (held: boolean, now?: number) => void;
  /** A dialog or drawer opened: hold the queue until it closes */
  modalOpened: () => void;
  /** A dialog or drawer closed: once none is left, the next prompt follows after the gap */
  modalClosed: (now?: number) => void;
  mapTouched: (now?: number) => void;
  /** Re-check (timer); tests pass `now` */
  pump: (now?: number) => void;
  /** Tests only */
  reset: () => void;
}

const INITIAL: PromptQueueTimes = { waiting: {}, active: null, held: false, openModals: 0, readyAt: 0, tourEndedAt: null, mapTouchedAt: null };

let timer: ReturnType<typeof setTimeout> | undefined;

const usePromptQueueStore = create<PromptQueueState>()((set, get) => ({
  ...INITIAL,
  request: (id, now = Date.now()) => {
    const { waiting, active } = get();
    if (active === id || waiting[id] !== undefined) return;
    set({ waiting: { ...waiting, [id]: now } });
    get().pump(now);
  },
  cancel: (id) => {
    const { waiting } = get();
    if (waiting[id] === undefined) return;
    const rest = { ...waiting };
    delete rest[id];
    set({ waiting: rest });
  },
  done: (id, now = Date.now()) => {
    if (get().active !== id) return;
    set({ active: null, readyAt: now + PROMPT_GAP_MS });
    get().pump(now);
  },
  setHeld: (held, now = Date.now()) => {
    const wasHeld = get().held;
    if (held === wasHeld) return;
    set(held ? { held } : { held, tourEndedAt: now, readyAt: Math.max(get().readyAt, now + PROMPT_GAP_MS) });
    get().pump(now);
  },
  modalOpened: () => {
    set({ openModals: get().openModals + 1 });
    get().pump();
  },
  modalClosed: (now = Date.now()) => {
    const openModals = Math.max(0, get().openModals - 1);
    set(openModals === 0 ? { openModals, readyAt: Math.max(get().readyAt, now + PROMPT_GAP_MS) } : { openModals });
    get().pump(now);
  },
  mapTouched: (now = Date.now()) => {
    set({ mapTouchedAt: now });
    get().pump(now);
  },
  pump: (now = Date.now()) => {
    clearTimeout(timer);
    timer = undefined;
    const step = nextPromptStep(get(), now);
    if (!step) return;
    if ('waitMs' in step) {
      timer = setTimeout(() => get().pump(), step.waitMs);
      return;
    }
    const waiting = { ...get().waiting };
    delete waiting[step.show];
    set({ active: step.show, waiting });
  },
  reset: () => {
    clearTimeout(timer);
    timer = undefined;
    set(INITIAL);
  },
}));

export default usePromptQueueStore;

/**
 * Wait in the queue while `wanted` (the prompt is due and nothing of its own blocks it). True once it's this prompt's
 * turn: show it then, and call `done` when it closes.
 */
export function usePromptTurn(id: PromptId, wanted: boolean): boolean {
  const turn = usePromptQueueStore((state) => state.active === id);
  useEffect(() => {
    const queue = usePromptQueueStore.getState();
    if (wanted) queue.request(id);
    else queue.cancel(id);
  }, [id, wanted]);
  return turn;
}

/**
 * Hold the prompt queue while `open`: a dialog or drawer the user is in. Used by the shared dialog frames
 * (DialogContent, AlertDialogContent, ResponsiveDialog), so every modal counts without each one opting in.
 */
export function useModalHold(open = true) {
  useEffect(() => {
    if (!open) return;
    usePromptQueueStore.getState().modalOpened();
    return () => usePromptQueueStore.getState().modalClosed();
  }, [open]);
}

/** {@link useModalHold} as an element: put it inside a Radix dialog's Content, which only mounts while it is shown. */
export function ModalHold() {
  useModalHold();
  return null;
}

/** A pointer or wheel on the map canvas */
const isOnMap = (target: EventTarget | null) => target instanceof Element && !!target.closest('.maplibregl-canvas-container');

/** Hold the queue while `held` (the tour is due or running), and notice map use right after it. Mounted once (Layout). */
export function usePromptQueueHold(held: boolean) {
  useEffect(() => {
    usePromptQueueStore.getState().setHeld(held);
  }, [held]);
  useEffect(() => {
    const onInput = (event: Event) => {
      if (isOnMap(event.target)) usePromptQueueStore.getState().mapTouched();
    };
    window.addEventListener('pointerdown', onInput, true);
    window.addEventListener('wheel', onInput, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', onInput, true);
      window.removeEventListener('wheel', onInput, true);
    };
  }, []);
}
