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
/**
 * After the tour, and while the user is busy with the map or the sheet / sidebar, a prompt waits until this long after
 * the tour ended or the last interaction (restarted by each one). Interactions count from the tour's end or the previous
 * prompt closing, so follow-ups never chain while the user is at work.
 */
export const QUIET_MS = 10_000;

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
  /** When the last prompt closed; null when none has */
  closedAt: number | null;
  /** Last pointer, wheel, key or focus on the map, a map popup or the sheet / sidebar */
  interactedAt: number | null;
  /** Forms the user is in now (the phone's Hint registreren page, a docked popup with Hunt / Spot): nothing shows */
  workHolds: number;
  /** Focus is in a text field outside a dialog (typing a search, a hint): nothing shows */
  fieldFocused: boolean;
}

/** What the queue does now: show a prompt, check again after `waitMs`, or nothing (idle, held or one is on screen). */
export type QueueStep = { show: PromptId } | { waitMs: number } | null;

/** Pure: the next step of the queue at `now`. */
export function nextPromptStep(times: PromptQueueTimes, now: number): QueueStep {
  if (times.held || times.active || times.openModals > 0 || times.workHolds > 0 || times.fieldFocused) return null;
  const id = PROMPTS.find((prompt) => times.waiting[prompt] !== undefined);
  if (!id) return null;
  let at = Math.max(times.readyAt, times.waiting[id]! + PROMPT_GAP_MS);
  // Not straight after the tour: a quiet window first, so the user can look around before the follow-ups start
  if (times.tourEndedAt !== null) at = Math.max(at, times.tourEndedAt + QUIET_MS);
  // Busy with the map or the sheet: wait for a quiet window after the last interaction. Only interactions since the tour
  // ended or the last prompt closed count (the tour's own taps, or what came before that prompt, don't hold the next).
  const since = Math.max(times.tourEndedAt ?? -Infinity, times.closedAt ?? -Infinity);
  if (times.interactedAt !== null && times.interactedAt >= since) at = Math.max(at, times.interactedAt + QUIET_MS);
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
  /** Pointer, wheel, key or focus on the map or the sheet: restarts the quiet window */
  interacted: (now?: number) => void;
  /** A form opened (phone form page, docked popup with Hunt / Spot): hold the queue until it closes */
  workStarted: () => void;
  /** A form closed: the quiet window starts now */
  workEnded: (now?: number) => void;
  /** Focus entered or left a text field; leaving one starts the quiet window */
  setFieldFocused: (focused: boolean, now?: number) => void;
  /** Re-check (timer); tests pass `now` */
  pump: (now?: number) => void;
  /** Tests only */
  reset: () => void;
}

const INITIAL: PromptQueueTimes = {
  waiting: {},
  active: null,
  held: false,
  openModals: 0,
  readyAt: 0,
  tourEndedAt: null,
  closedAt: null,
  interactedAt: null,
  workHolds: 0,
  fieldFocused: false,
};

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
    set({ active: null, readyAt: now + PROMPT_GAP_MS, closedAt: now });
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
  interacted: (now = Date.now()) => {
    set({ interactedAt: now });
    get().pump(now);
  },
  workStarted: () => {
    set({ workHolds: get().workHolds + 1 });
    get().pump();
  },
  workEnded: (now = Date.now()) => {
    set({ workHolds: Math.max(0, get().workHolds - 1), interactedAt: now });
    get().pump(now);
  },
  setFieldFocused: (focused, now = Date.now()) => {
    if (focused === get().fieldFocused) return;
    set(focused ? { fieldFocused: true } : { fieldFocused: false, interactedAt: now });
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

/**
 * Hold the prompt queue while `active`: a form the user is in that isn't a dialog (the phone's Hint registreren page, a
 * docked popup with Hunt / Spot). Closing it starts the quiet window.
 */
export function useWorkHold(active = true) {
  useEffect(() => {
    if (!active) return;
    usePromptQueueStore.getState().workStarted();
    return () => usePromptQueueStore.getState().workEnded();
  }, [active]);
}

/** Marks the sheet / sidebar: pointer, wheel, key and focus in it count as work, like on the map */
export const WORK_AREA_ATTRIBUTE = 'data-work-area';
/** The map canvas, its popups (also docked on a phone: DOCK_ID in DockedPopup) and the sheet / sidebar */
const WORK_AREAS = `.maplibregl-canvas-container, .maplibregl-popup, #map-popup-dock, [${WORK_AREA_ATTRIBUTE}]`;
const isInWorkArea = (target: EventTarget | null) => target instanceof Element && !!target.closest(WORK_AREAS);

/** Input types that take typing (not buttons, checkboxes, sliders…) */
const NON_TYPING_INPUTS = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'hidden']);

/** Pure: whether an element with this tag / input type / contenteditable takes typing. */
export function isTypingField(tagName: string, inputType: string | null, contentEditable: boolean): boolean {
  const tag = tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select' || contentEditable) return true;
  return tag === 'input' && !NON_TYPING_INPUTS.has((inputType ?? 'text').toLowerCase());
}

/** A text field outside a dialog (fields in dialogs, prompts included, are covered by the modal hold) */
function isWorkField(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (!isTypingField(element.tagName, element.getAttribute('type'), element.isContentEditable)) return false;
  return !element.closest('[role="dialog"], [role="alertdialog"]');
}

/** How often a focused field is checked again (a field removed while focused fires no focusout everywhere) */
const FIELD_RECHECK_MS = 2000;

/**
 * Hold the queue while `held` (the tour is due or running) or while a text field has focus, and restart the quiet
 * window on every interaction with the map or the sheet. Mounted once (Layout).
 */
export function usePromptQueueHold(held: boolean) {
  useEffect(() => {
    usePromptQueueStore.getState().setHeld(held);
  }, [held]);
  useEffect(() => {
    const queue = () => usePromptQueueStore.getState();
    const onInput = (event: Event) => {
      if (isInWorkArea(event.target)) queue().interacted();
    };
    const onFocusIn = (event: FocusEvent) => {
      onInput(event);
      queue().setFieldFocused(isWorkField(event.target as Element | null));
    };
    // focusout fires before focus lands on the next element: decide once it has
    let pending: ReturnType<typeof setTimeout> | undefined;
    const onFocusOut = () => {
      clearTimeout(pending);
      pending = setTimeout(() => queue().setFieldFocused(isWorkField(document.activeElement)));
    };
    const recheck = setInterval(() => {
      if (queue().fieldFocused && !isWorkField(document.activeElement)) queue().setFieldFocused(false);
    }, FIELD_RECHECK_MS);
    window.addEventListener('pointerdown', onInput, true);
    window.addEventListener('keydown', onInput, true);
    window.addEventListener('wheel', onInput, { capture: true, passive: true });
    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('focusout', onFocusOut, true);
    return () => {
      clearTimeout(pending);
      clearInterval(recheck);
      window.removeEventListener('pointerdown', onInput, true);
      window.removeEventListener('keydown', onInput, true);
      window.removeEventListener('wheel', onInput, true);
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('focusout', onFocusOut, true);
    };
  }, []);
}
