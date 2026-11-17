import { describe, expect, test } from 'bun:test';
import { desktopToolbarTop, desktopTopStack, phoneToastOffset, phoneTopStack } from './top-stack';

const NONE = { badge: 0, pill: 0, toolbar: 0, error: 0 };

describe('phoneTopStack', () => {
  test('nothing shown: the resting places', () => {
    expect(phoneTopStack(NONE)).toEqual({ pillTop: 40, toolbarTop: 12, errorTop: 48, toastTop: 48 });
  });

  test('a one-line badge leaves the pill and toasts where they were', () => {
    expect(phoneTopStack({ ...NONE, badge: 24 })).toEqual({ pillTop: 40, toolbarTop: 40, errorTop: 48, toastTop: 48 });
  });

  test('a two-line badge pushes the pill and toasts down', () => {
    const stack = phoneTopStack({ ...NONE, badge: 40, pill: 32 });
    expect(stack.pillTop).toBe(56);
    expect(stack.toastTop).toBe(96);
  });

  test('toasts go below the pill', () => {
    expect(phoneTopStack({ ...NONE, pill: 32 }).toastTop).toBe(80);
  });

  test('the drawing toolbar sits below badge and pill, toasts below the toolbar', () => {
    expect(phoneTopStack({ ...NONE, badge: 24, pill: 32, toolbar: 44 })).toEqual({ pillTop: 40, toolbarTop: 80, errorTop: 132, toastTop: 132 });
    expect(phoneTopStack({ ...NONE, toolbar: 44 })).toEqual({ pillTop: 40, toolbarTop: 12, errorTop: 64, toastTop: 64 });
  });

  test('never overlaps: every next item starts at least 8px below the previous one', () => {
    for (const badge of [0, 24, 40]) {
      for (const pill of [0, 32]) {
        const { pillTop, toolbarTop, toastTop } = phoneTopStack({ ...NONE, badge, pill, toolbar: 44 });
        if (badge) expect(pillTop).toBeGreaterThanOrEqual(8 + badge + 8);
        if (pill) expect(toolbarTop).toBeGreaterThanOrEqual(pillTop + pill + 8);
        expect(toastTop).toBeGreaterThanOrEqual(toolbarTop + 44 + 8);
      }
    }
  });

  test('an error card takes the toasts\' place, under everything else; the toasts move below it', () => {
    expect(phoneTopStack({ ...NONE, error: 90 })).toEqual({ pillTop: 40, toolbarTop: 12, errorTop: 48, toastTop: 146 });
    const stack = phoneTopStack({ badge: 40, pill: 32, toolbar: 44, error: 90 });
    expect(stack.errorTop).toBe(stack.toolbarTop + 44 + 8);
    expect(stack.toastTop).toBe(stack.errorTop + 90 + 8);
  });
});

describe('desktopToolbarTop', () => {
  test('below the pill while it is shown', () => {
    expect(desktopToolbarTop(0)).toBe(56);
    expect(desktopToolbarTop(32)).toBe(92);
  });

  test('below the badge too', () => {
    expect(desktopToolbarTop(0, 30)).toBe(90);
    expect(desktopToolbarTop(32, 30)).toBe(130);
  });
});

describe('desktopTopStack', () => {
  test('nothing shown: badge and pill both at the first row under the search / coordinates cards', () => {
    expect(desktopTopStack({ badge: 0, pill: 0 })).toEqual({ badgeTop: 52, pillTop: 52, toolbarTop: 56 });
  });

  test('the pill stacks under the badge (8px gap)', () => {
    expect(desktopTopStack({ badge: 30, pill: 32 })).toEqual({ badgeTop: 52, pillTop: 90, toolbarTop: 130 });
    expect(desktopTopStack({ badge: 0, pill: 32 }).pillTop).toBe(52);
  });
});

describe('phoneToastOffset', () => {
  test('adds the top safe area', () => {
    expect(phoneToastOffset({ ...NONE, pill: 32 })).toEqual({ top: 'calc(env(safe-area-inset-top) + 80px)' });
    expect(phoneToastOffset(NONE)).toEqual({ top: 'calc(env(safe-area-inset-top) + 48px)' });
  });
});
