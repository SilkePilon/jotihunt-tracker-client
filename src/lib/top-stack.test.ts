import { describe, expect, test } from 'bun:test';
import { desktopToolbarTop, phoneToastOffset, phoneTopStack } from './top-stack';

const NONE = { badge: 0, pill: 0, toolbar: 0 };

describe('phoneTopStack', () => {
  test('nothing shown: the resting places', () => {
    expect(phoneTopStack(NONE)).toEqual({ pillTop: 40, toolbarTop: 12, toastTop: 48 });
  });

  test('a one-line badge leaves the pill and toasts where they were', () => {
    expect(phoneTopStack({ ...NONE, badge: 24 })).toEqual({ pillTop: 40, toolbarTop: 40, toastTop: 48 });
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
    expect(phoneTopStack({ badge: 24, pill: 32, toolbar: 44 })).toEqual({ pillTop: 40, toolbarTop: 80, toastTop: 132 });
    expect(phoneTopStack({ ...NONE, toolbar: 44 })).toEqual({ pillTop: 40, toolbarTop: 12, toastTop: 64 });
  });

  test('never overlaps: every next item starts at least 8px below the previous one', () => {
    for (const badge of [0, 24, 40]) {
      for (const pill of [0, 32]) {
        const { pillTop, toolbarTop, toastTop } = phoneTopStack({ badge, pill, toolbar: 44 });
        if (badge) expect(pillTop).toBeGreaterThanOrEqual(8 + badge + 8);
        if (pill) expect(toolbarTop).toBeGreaterThanOrEqual(pillTop + pill + 8);
        expect(toastTop).toBeGreaterThanOrEqual(toolbarTop + 44 + 8);
      }
    }
  });
});

describe('desktopToolbarTop', () => {
  test('below the pill while it is shown', () => {
    expect(desktopToolbarTop(0)).toBe(56);
    expect(desktopToolbarTop(32)).toBe(92);
  });
});

describe('phoneToastOffset', () => {
  test('adds the top safe area', () => {
    expect(phoneToastOffset({ ...NONE, pill: 32 })).toEqual({ top: 'calc(env(safe-area-inset-top) + 80px)' });
    expect(phoneToastOffset(NONE)).toEqual({ top: 'calc(env(safe-area-inset-top) + 48px)' });
  });
});
