import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import usePromptQueueStore, { isTypingField, WORK_AREA_ATTRIBUTE, WORK_AREAS, nextPromptStep, PROMPT_GAP_MS, QUIET_MS, type PromptQueueTimes } from './prompt-queue.store';

const T = 1_000_000;
const idle: PromptQueueTimes = {
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
const queue = () => usePromptQueueStore.getState();

describe('nextPromptStep', () => {
  test('nothing waiting: idle', () => {
    expect(nextPromptStep(idle, T)).toBeNull();
  });

  test('a request shows after the gap', () => {
    const times = { ...idle, waiting: { passkey: T } };
    expect(nextPromptStep(times, T)).toEqual({ waitMs: PROMPT_GAP_MS });
    expect(nextPromptStep(times, T + PROMPT_GAP_MS)).toEqual({ show: 'passkey' });
  });

  test('held (tour) or another prompt on screen: nothing shows', () => {
    const waiting = { notifications: T - 10_000 };
    expect(nextPromptStep({ ...idle, waiting, held: true }, T)).toBeNull();
    expect(nextPromptStep({ ...idle, waiting, active: 'passkey' }, T)).toBeNull();
  });

  test('an open dialog or drawer: nothing shows', () => {
    expect(nextPromptStep({ ...idle, waiting: { notifications: T - 10_000 }, openModals: 1 }, T)).toBeNull();
  });

  test('a fixed order: notifications, the Android promo, the iOS install prompt, then the passkey', () => {
    const waiting = { passkey: T - 9000, 'pwa-install': T - 8500, 'android-promo': T - 8000, notifications: T - 5000 };
    expect(nextPromptStep({ ...idle, waiting }, T)).toEqual({ show: 'notifications' });
    expect(nextPromptStep({ ...idle, waiting: { passkey: T - 9000, 'pwa-install': T - 8500, 'android-promo': T - 8000 } }, T)).toEqual({ show: 'android-promo' });
    expect(nextPromptStep({ ...idle, waiting: { passkey: T - 9000, 'pwa-install': T - 8500 } }, T)).toEqual({ show: 'pwa-install' });
  });

  test('after the tour, map or sheet use holds prompts back until a quiet window after the last interaction', () => {
    const base = { ...idle, waiting: { notifications: T - 60_000 }, tourEndedAt: T, readyAt: T + PROMPT_GAP_MS };
    // Not using the map: still a quiet window after the tour, not straight after it
    expect(nextPromptStep(base, T + PROMPT_GAP_MS)).toEqual({ waitMs: QUIET_MS - PROMPT_GAP_MS });
    expect(nextPromptStep(base, T + QUIET_MS)).toEqual({ show: 'notifications' });
    // Panning the map after the tour: wait until the quiet window after that is over
    const busy = { ...base, interactedAt: T + 1000 };
    expect(nextPromptStep(busy, T + PROMPT_GAP_MS)).toEqual({ waitMs: 1000 + QUIET_MS - PROMPT_GAP_MS });
    expect(nextPromptStep(busy, T + 1000 + QUIET_MS)).toEqual({ show: 'notifications' });
    // Each interaction restarts the window
    const later = { ...base, interactedAt: T + 8000 };
    expect(nextPromptStep(later, T + 1000 + QUIET_MS)).toEqual({ waitMs: 7000 });
    // Use from before the tour ended doesn't count
    expect(nextPromptStep({ ...base, interactedAt: T - 1 }, T + QUIET_MS)).toEqual({ show: 'notifications' });
  });

  test('a form or a focused text field holds the queue', () => {
    const waiting = { notifications: T - 60_000 };
    expect(nextPromptStep({ ...idle, waiting, workHolds: 1 }, T)).toBeNull();
    expect(nextPromptStep({ ...idle, waiting, fieldFocused: true }, T)).toBeNull();
  });

  test('no follow-up chained onto the previous prompt while the user is at work', () => {
    const base = { ...idle, waiting: { passkey: T - 60_000 }, closedAt: T, readyAt: T + PROMPT_GAP_MS };
    // Left alone after closing the first: the second follows after the gap
    expect(nextPromptStep(base, T + PROMPT_GAP_MS)).toEqual({ show: 'passkey' });
    // Back on the map after closing it: a quiet window first
    expect(nextPromptStep({ ...base, interactedAt: T + 500 }, T + PROMPT_GAP_MS)).toEqual({ waitMs: 500 + QUIET_MS - PROMPT_GAP_MS });
    // What came before the first prompt doesn't hold the second
    expect(nextPromptStep({ ...base, interactedAt: T - 500 }, T + PROMPT_GAP_MS)).toEqual({ show: 'passkey' });
  });

  test('without a tour or an earlier prompt, recent use still waits for the quiet window', () => {
    const times = { ...idle, waiting: { notifications: T }, interactedAt: T + 1000 };
    expect(nextPromptStep(times, T + PROMPT_GAP_MS)).toEqual({ waitMs: 1000 + QUIET_MS - PROMPT_GAP_MS });
  });
});

describe('prompt queue store', () => {
  beforeEach(() => queue().reset());
  afterEach(() => queue().reset());

  test('one at a time; the next only a gap after the previous closed', () => {
    queue().request('passkey', T);
    queue().request('notifications', T);
    queue().pump(T + PROMPT_GAP_MS);
    expect(queue().active).toBe('notifications');
    queue().pump(T + 60_000);
    expect(queue().active).toBe('notifications');
    queue().done('notifications', T + 60_000);
    expect(queue().active).toBeNull();
    queue().pump(T + 60_000 + PROMPT_GAP_MS - 1);
    expect(queue().active).toBeNull();
    queue().pump(T + 60_000 + PROMPT_GAP_MS);
    expect(queue().active).toBe('passkey');
  });

  test('requests while held wait for the tour to end, then the quiet window', () => {
    queue().setHeld(true, T);
    queue().request('android-promo', T);
    queue().pump(T + 30_000);
    expect(queue().active).toBeNull();
    queue().setHeld(false, T + 30_000);
    expect(queue().tourEndedAt).toBe(T + 30_000);
    queue().pump(T + 30_000 + PROMPT_GAP_MS);
    expect(queue().active).toBeNull();
    queue().pump(T + 30_000 + QUIET_MS);
    expect(queue().active).toBe('android-promo');
  });

  test('map use right after the tour pushes the prompt to a quiet window after the last interaction', () => {
    queue().setHeld(true, T);
    queue().request('notifications', T);
    queue().setHeld(false, T + 1000);
    queue().interacted(T + 2000);
    queue().pump(T + 1000 + PROMPT_GAP_MS);
    expect(queue().active).toBeNull();
    queue().pump(T + 2000 + QUIET_MS - 1);
    expect(queue().active).toBeNull();
    queue().pump(T + 2000 + QUIET_MS);
    expect(queue().active).toBe('notifications');
  });

  test('a form holds the queue; closing it starts the quiet window', () => {
    queue().request('passkey', T);
    queue().workStarted();
    queue().pump(T + 60_000);
    expect(queue().active).toBeNull();
    queue().workEnded(T + 60_000);
    expect(queue().workHolds).toBe(0);
    queue().pump(T + 60_000 + QUIET_MS - 1);
    expect(queue().active).toBeNull();
    queue().pump(T + 60_000 + QUIET_MS);
    expect(queue().active).toBe('passkey');
    // Never below zero
    queue().workEnded(T + 70_000);
    expect(queue().workHolds).toBe(0);
  });

  test('a focused text field holds the queue; leaving it starts the quiet window', () => {
    queue().request('notifications', T);
    queue().setFieldFocused(true, T);
    queue().pump(T + 60_000);
    expect(queue().active).toBeNull();
    queue().setFieldFocused(false, T + 60_000);
    queue().pump(T + 60_000 + QUIET_MS - 1);
    expect(queue().active).toBeNull();
    queue().pump(T + 60_000 + QUIET_MS);
    expect(queue().active).toBe('notifications');
  });

  test('done records when the prompt closed', () => {
    queue().request('notifications', T);
    queue().pump(T + PROMPT_GAP_MS);
    queue().done('notifications', T + 5000);
    expect(queue().closedAt).toBe(T + 5000);
  });

  test('a dialog the user opened holds the queue; the prompt follows a gap after the last one closes', () => {
    queue().request('passkey', T);
    queue().modalOpened();
    queue().modalOpened();
    queue().pump(T + 30_000);
    expect(queue().active).toBeNull();
    queue().modalClosed(T + 30_000);
    queue().pump(T + 30_000 + PROMPT_GAP_MS);
    // One (e.g. a confirm over Beheer) is still open
    expect(queue().active).toBeNull();
    queue().modalClosed(T + 40_000);
    queue().pump(T + 40_000 + PROMPT_GAP_MS - 1);
    expect(queue().active).toBeNull();
    queue().pump(T + 40_000 + PROMPT_GAP_MS);
    expect(queue().active).toBe('passkey');
  });

  test('closing more dialogs than were opened never goes below zero', () => {
    queue().modalClosed(T);
    expect(queue().openModals).toBe(0);
    queue().modalOpened();
    expect(queue().openModals).toBe(1);
  });

  test('a prompt that opens its own dialog keeps its turn', () => {
    queue().request('notifications', T);
    queue().pump(T + PROMPT_GAP_MS);
    expect(queue().active).toBe('notifications');
    queue().modalOpened();
    expect(queue().active).toBe('notifications');
  });

  test('cancel leaves the queue; done for a prompt not on screen is ignored; duplicate requests keep their place', () => {
    queue().request('passkey', T);
    queue().request('passkey', T + 5000);
    expect(queue().waiting.passkey).toBe(T);
    queue().cancel('passkey');
    queue().pump(T + 10_000);
    expect(queue().active).toBeNull();
    queue().request('notifications', T);
    queue().pump(T + PROMPT_GAP_MS);
    queue().done('passkey', T + PROMPT_GAP_MS);
    expect(queue().active).toBe('notifications');
    // A prompt on screen stays when it is no longer due; only done frees the turn
    queue().cancel('notifications');
    expect(queue().active).toBe('notifications');
  });
});

describe('isTypingField', () => {
  test('text inputs, textareas, selects and contenteditable take typing', () => {
    expect(isTypingField('INPUT', null, false)).toBe(true);
    expect(isTypingField('INPUT', 'search', false)).toBe(true);
    expect(isTypingField('INPUT', 'time', false)).toBe(true);
    expect(isTypingField('TEXTAREA', null, false)).toBe(true);
    expect(isTypingField('SELECT', null, false)).toBe(true);
    expect(isTypingField('DIV', null, true)).toBe(true);
  });
  test('buttons, checkboxes and plain elements do not', () => {
    for (const type of ['button', 'checkbox', 'radio', 'range', 'submit']) expect(isTypingField('INPUT', type, false)).toBe(false);
    expect(isTypingField('BUTTON', null, false)).toBe(false);
    expect(isTypingField('DIV', null, false)).toBe(false);
  });
});

describe('WORK_AREAS', () => {
  test('counts map controls and portalled popovers, not only the canvas, popups and sheet', () => {
    const selectors = WORK_AREAS.split(',').map((part) => part.trim());
    expect(selectors).toContain('.maplibregl-ctrl');
    expect(selectors).toContain('[data-slot="popover-content"]');
    expect(selectors).toContain('.maplibregl-canvas-container');
    expect(selectors).toContain(`[${WORK_AREA_ATTRIBUTE}]`);
  });
});
