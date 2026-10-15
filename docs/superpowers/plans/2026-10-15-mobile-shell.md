# Mobile Shell (plan 1 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the phone vaul drawer with our own bottom sheet that stays above bottom browser toolbars, drives map padding, carries a hunt-marker camera button and docked marker popups, and holds a navigation stack (menu → page) with Back-button support.

**Architecture:** Pure logic in `src/lib/` (snap maths, viewport maths, nav stack, back stack) with `bun test` tests; small zustand stores for viewport + nav; components in `src/components/mobile/`. A shared motion value `sheetVisibleHeight` lets the camera button and popup dock follow the sheet live; the settled height goes into `sidebar.store.sheetHeight` for map padding. In this plan, pages render the EXISTING sidebar section components (plan 2 replaces them with extracted D1 content, adds Intel / AI / dialog pages).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, motion/react (`motion` v14), zustand, react-map-gl/maplibre, bun test.

Spec: `docs/superpowers/specs/2026-10-15-mobile-redesign-design.md` (build steps 1–2, plus the minimum tour fix so the tour keeps working).

## Global Constraints

- Mobile = `useIsMobile()` (`(max-width: 767px)`); desktop rendering must not change.
- Sheet: `position: fixed; bottom: 0`, moved only with transform; never translate any part below `bottom: 0`.
- Snaps (px from the bottom): peek = clamp(peek content, 120, max(120, 0.22 × visibleH)) + safe-area bottom; half = 0.5 × visibleH; full = visibleH − safe-area top − 12.
- Flick threshold 0.45 px/ms; rubber band ×0.25 above max, ×0.4 below min; spring `bounce: 0`; pointer capture only after 6px.
- Keyboard inset counts only when > 60px.
- Viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual`.
- Debug overlay only with `?viewport-debug` in the URL.
- Camera button: 60px 9-lobe cookie, depth `MARKER_COOKIE_DEPTH` (0.07), fill palette `tertiaryContainer`, 2.5px rim `surfaceContainerLowest`, glyph `GLYPHS.photo_camera` in `onTertiaryContainer`, 12px above the sheet edge, hidden at `full`.
- Back order: marker popup → page → sheet to peek → browser.
- Every UI state change animates (project rule): use `lib/motion.ts` presets (`PANE_SLIDE`, `POP`, `SWAP`).
- Copy is Dutch. Code comments English, matching the surrounding density.
- Run tests with `npx --yes bun test <path>` (bun is not on PATH); type-check with `npx tsc -b` from the client root.
- Work on branch `feat/mobile-shell` in a worktree (another session may use client `main`).

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/sheet-snaps.ts` (+ `.test.ts`) | Snap heights, rubber band, settle/next snap (pure) |
| `src/lib/viewport.ts` (+ `.test.ts`) | Keyboard inset + visible height from window/visualViewport numbers (pure) |
| `src/lib/back-stack.ts` (+ `.test.ts`) | Back-button entry stack over an injected History (pure) |
| `src/lib/mobile-nav.ts` (+ `.test.ts`) | Page stack operations (pure) |
| `src/lib/tracker.ts` (+ existing test file) | add `trackerPeekLine()` |
| `src/stores/viewport.store.ts` | visibleH, keyboard, safeTop, safeBottom |
| `src/stores/mobile-nav.store.ts` | Page stack + direction; push sets sheet to full |
| `src/stores/sidebar.store.ts` | add `sheetHeight` (settled px), re-export `SheetSnap` from lib |
| `src/hooks/viewport-insets.hook.ts` | Measures viewport + safe areas into the store |
| `src/hooks/back-entry.hook.ts` | `useBackEntry(key, active, close)` on a module-level back stack |
| `src/components/mobile/sheet-motion.ts` | Shared `sheetVisibleHeight` motion value |
| `src/components/mobile/BottomSheet.tsx` | The sheet (drag, snaps, body height) |
| `src/components/mobile/HuntMarkerButton.tsx` | Camera button in hunt-marker style |
| `src/components/mobile/DockedPopup.tsx` | Mobile rendering of `MapPopup` in the dock |
| `src/components/mobile/PeekStrip.tsx` | Tracker line + Vossen bar |
| `src/components/mobile/MobileMenu.tsx` | Home menu (Beheer D1 style) |
| `src/components/mobile/MobilePage.tsx` | Page frame + interim page content |
| `src/components/mobile/MobileShell.tsx` | Wires everything; replaces `MobileSheet` |
| `src/components/mobile/ViewportDebug.tsx` | `?viewport-debug` overlay |
| Modify: `index.html`, `src/index.css`, `src/components/Map.tsx`, `src/components/layers/Teams.tsx`, `src/components/map/MapPopup.tsx`, `src/components/sidebar/Sidebar.tsx`, `src/pages/App.tsx`, `src/components/ui/sonner.tsx`, `src/components/tour/actions.ts`, `src/components/tour/steps.ts`, `src/components/tour/TourOverlay.tsx` | |
| Delete: `src/components/sidebar/MobileSheet.tsx`, `src/components/hunts/HuntCaptureButton.tsx` | |

---

### Task 0: Worktree

- [ ] **Step 1: Create the worktree and branch**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
git worktree add ../.worktrees/client-mobile-shell -b feat/mobile-shell main
cd ../.worktrees/client-mobile-shell && npm ci
npx --yes bun test 2>&1 | tail -3
```

Expected: all existing tests pass (baseline). All later paths are relative to this worktree.

---

### Task 1: Snap maths

**Files:**
- Create: `src/lib/sheet-snaps.ts`
- Test: `src/lib/sheet-snaps.test.ts`

**Interfaces:**
- Produces: `type SheetSnap = 'peek' | 'half' | 'full'`, `SNAP_ORDER`, `type SnapHeights = Record<SheetSnap, number>`, `computeSnapHeights(input: { visibleH: number; safeTop: number; safeBottom: number; peekContent: number }): SnapHeights`, `rubberBand(h: number, min: number, max: number): number`, `FLICK_VELOCITY = 0.45`, `settleSnap(height: number, velocity: number, heights: SnapHeights): SheetSnap` (velocity in px/ms, positive = sheet growing), `nextSnap(snap: SheetSnap): SheetSnap`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/sheet-snaps.test.ts
import { describe, expect, test } from 'bun:test';
import { computeSnapHeights, nextSnap, rubberBand, settleSnap } from './sheet-snaps';

describe('computeSnapHeights', () => {
  test('iPhone-like viewport', () => {
    expect(computeSnapHeights({ visibleH: 760, safeTop: 47, safeBottom: 34, peekContent: 136 })).toEqual({ peek: 170, half: 380, full: 701 });
  });
  test('peek content is clamped to 120 … 22% of the visible height', () => {
    expect(computeSnapHeights({ visibleH: 800, safeTop: 0, safeBottom: 0, peekContent: 60 }).peek).toBe(120);
    expect(computeSnapHeights({ visibleH: 800, safeTop: 0, safeBottom: 0, peekContent: 400 }).peek).toBe(176);
  });
  test('landscape: half never below peek, nothing above full', () => {
    const h = computeSnapHeights({ visibleH: 360, safeTop: 0, safeBottom: 21, peekContent: 136 });
    expect(h.half).toBeGreaterThanOrEqual(h.peek);
    expect(h.peek).toBeLessThanOrEqual(h.full);
    expect(h.half).toBeLessThanOrEqual(h.full);
  });
});

describe('rubberBand', () => {
  test('inside the range is unchanged', () => expect(rubberBand(300, 100, 700)).toBe(300));
  test('above max moves at a quarter', () => expect(rubberBand(800, 100, 700)).toBe(725));
  test('below min moves at 40%', () => expect(rubberBand(50, 100, 700)).toBe(80));
});

describe('settleSnap', () => {
  const heights = { peek: 170, half: 380, full: 700 };
  test('slow release picks the nearest snap', () => {
    expect(settleSnap(300, 0, heights)).toBe('half');
    expect(settleSnap(600, 0.1, heights)).toBe('full');
    expect(settleSnap(200, -0.1, heights)).toBe('peek');
  });
  test('an upward flick goes to the next snap above', () => {
    expect(settleSnap(200, 0.8, heights)).toBe('half');
    expect(settleSnap(390, 0.8, heights)).toBe('full');
  });
  test('a downward flick goes to the next snap below', () => {
    expect(settleSnap(650, -0.8, heights)).toBe('half');
    expect(settleSnap(370, -0.8, heights)).toBe('peek');
  });
  test('a flick past the ends stays at the end', () => {
    expect(settleSnap(720, 0.9, heights)).toBe('full');
    expect(settleSnap(150, -0.9, heights)).toBe('peek');
  });
});

test('nextSnap cycles peek → half → full → peek', () => {
  expect(nextSnap('peek')).toBe('half');
  expect(nextSnap('half')).toBe('full');
  expect(nextSnap('full')).toBe('peek');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx --yes bun test src/lib/sheet-snaps.test.ts`
Expected: FAIL, `Cannot find module './sheet-snaps'`.

- [ ] **Step 3: Implement**

```ts
// src/lib/sheet-snaps.ts
/**
 * The phone bottom sheet's heights, in px measured from the bottom of the layout viewport. `bottom: 0` sits above
 * every mobile browser's own bottom toolbar, so these never need to know about the toolbar itself.
 */
export type SheetSnap = 'peek' | 'half' | 'full';
export const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full'];
export type SnapHeights = Record<SheetSnap, number>;

export const PEEK_MIN = 120;
export const PEEK_MAX_FRACTION = 0.22;
export const FULL_TOP_GAP = 12;
/** px/ms; a faster release moves one snap in the drag direction */
export const FLICK_VELOCITY = 0.45;

export function computeSnapHeights({ visibleH, safeTop, safeBottom, peekContent }: { visibleH: number; safeTop: number; safeBottom: number; peekContent: number }): SnapHeights {
  const full = Math.max(0, Math.round(visibleH - safeTop - FULL_TOP_GAP));
  const peekMax = Math.max(PEEK_MIN, PEEK_MAX_FRACTION * visibleH);
  const peek = Math.min(full, Math.round(Math.min(Math.max(peekContent, PEEK_MIN), peekMax) + safeBottom));
  const half = Math.min(full, Math.max(peek, Math.round(visibleH * 0.5)));
  return { peek, half, full };
}

export function rubberBand(h: number, min: number, max: number): number {
  if (h > max) return max + (h - max) * 0.25;
  if (h < min) return min - (min - h) * 0.4;
  return h;
}

export function settleSnap(height: number, velocity: number, heights: SnapHeights): SheetSnap {
  if (Math.abs(velocity) > FLICK_VELOCITY) {
    const target = velocity > 0 ? SNAP_ORDER.find((s) => heights[s] > height + 2) : [...SNAP_ORDER].reverse().find((s) => heights[s] < height - 2);
    return target ?? (velocity > 0 ? 'full' : 'peek');
  }
  return SNAP_ORDER.reduce((best, s) => (Math.abs(heights[s] - height) < Math.abs(heights[best] - height) ? s : best), 'peek' as SheetSnap);
}

export function nextSnap(snap: SheetSnap): SheetSnap {
  return SNAP_ORDER[(SNAP_ORDER.indexOf(snap) + 1) % SNAP_ORDER.length];
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx --yes bun test src/lib/sheet-snaps.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Re-export the type from the sidebar store and add `sheetHeight`**

In `src/stores/sidebar.store.ts` replace line 5 (`export type SheetSnap = ...`) with:

```ts
import type { SheetSnap } from '@/lib/sheet-snaps';
export type { SheetSnap };
```

Add to `SidebarState` (after `setSheetSnap`):

```ts
  /** Settled visible height of the phone sheet in px (0 on desktop); drives the map padding */
  sheetHeight: number;
  setSheetHeight: (height: number) => void;
```

and to the store body (after `setSheetSnap`):

```ts
      sheetHeight: 0,
      setSheetHeight: (sheetHeight) => set({ sheetHeight }),
```

`partialize` already only keeps `openSections`/`forcedOpenFor`, so `sheetHeight` is not persisted.

- [ ] **Step 6: Type-check and commit**

```bash
npx tsc -b && git add src/lib/sheet-snaps.ts src/lib/sheet-snaps.test.ts src/stores/sidebar.store.ts
git commit -m "feat(mobile): sheet snap maths"
```

---

### Task 2: Viewport insets (bottom toolbars, keyboard, safe areas) + debug overlay

**Files:**
- Create: `src/lib/viewport.ts`, `src/lib/viewport.test.ts`, `src/stores/viewport.store.ts`, `src/hooks/viewport-insets.hook.ts`, `src/components/mobile/ViewportDebug.tsx`
- Modify: `index.html:5`, `src/index.css` (base layer `html, body` rule at ~227)

**Interfaces:**
- Produces: `KEYBOARD_THRESHOLD = 60`, `keyboardInset(innerHeight: number, vv: { height: number; offsetTop: number } | null): number`, `visibleHeight(innerHeight: number, vv: { height: number } | null): number`; store `useViewportStore` with `{ visibleH: number; keyboard: number; safeTop: number; safeBottom: number; set(p: Partial<…>): void }`; hook `useViewportInsets(): void` (mount once); `<ViewportDebug />`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/viewport.test.ts
import { describe, expect, test } from 'bun:test';
import { keyboardInset, visibleHeight } from './viewport';

describe('keyboardInset', () => {
  test('no visualViewport → 0', () => expect(keyboardInset(800, null)).toBe(0));
  test('toolbar jitter below the threshold is ignored', () => expect(keyboardInset(800, { height: 760, offsetTop: 0 })).toBe(0));
  test('keyboard open (resizes-visual)', () => expect(keyboardInset(800, { height: 470, offsetTop: 0 })).toBe(330));
  test('visual viewport scrolled by iOS while the keyboard is open', () => expect(keyboardInset(800, { height: 470, offsetTop: 40 })).toBe(290));
});

describe('visibleHeight', () => {
  test('uses the visual viewport when present', () => expect(visibleHeight(800, { height: 470 })).toBe(470));
  test('falls back to innerHeight', () => expect(visibleHeight(800, null)).toBe(800));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx --yes bun test src/lib/viewport.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement the pure helpers**

```ts
// src/lib/viewport.ts
/**
 * Mobile viewport maths. With `interactive-widget=resizes-visual` the keyboard only shrinks the visual viewport;
 * the obscured strip at the bottom is innerHeight − (vv.height + vv.offsetTop). Small differences are browser
 * toolbars settling, not a keyboard.
 */
export const KEYBOARD_THRESHOLD = 60;

export function keyboardInset(innerHeight: number, vv: { height: number; offsetTop: number } | null): number {
  if (!vv) return 0;
  const inset = innerHeight - (vv.height + vv.offsetTop);
  return inset > KEYBOARD_THRESHOLD ? Math.round(inset) : 0;
}

export function visibleHeight(innerHeight: number, vv: { height: number } | null): number {
  return Math.round(vv ? vv.height : innerHeight);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx --yes bun test src/lib/viewport.test.ts` → PASS.

- [ ] **Step 5: Store**

```ts
// src/stores/viewport.store.ts
import { create } from 'zustand';

interface ViewportState {
  /** Height of the visual viewport in px (excludes an open keyboard) */
  visibleH: number;
  /** Keyboard height in px, 0 when closed */
  keyboard: number;
  /** env(safe-area-inset-top / -bottom) in px */
  safeTop: number;
  safeBottom: number;
  set: (patch: Partial<Omit<ViewportState, 'set'>>) => void;
}

/** Phone viewport measurements, filled by useViewportInsets (mounted once by the mobile shell). */
const useViewportStore = create<ViewportState>()((set) => ({
  visibleH: typeof window === 'undefined' ? 800 : window.innerHeight,
  keyboard: 0,
  safeTop: 0,
  safeBottom: 0,
  set: (patch) => set(patch),
}));

export default useViewportStore;
```

- [ ] **Step 6: Hook**

```ts
// src/hooks/viewport-insets.hook.ts
import { useEffect } from 'react';
import { keyboardInset, visibleHeight } from '@/lib/viewport';
import useViewportStore from '@/stores/viewport.store';

/** Reads env(safe-area-inset-*) through a hidden probe element (JS has no direct API for it). */
function readSafeAreas(probe: HTMLElement) {
  const style = getComputedStyle(probe);
  return { safeTop: parseFloat(style.paddingTop) || 0, safeBottom: parseFloat(style.paddingBottom) || 0 };
}

/**
 * Keeps the viewport store up to date: visual viewport size, keyboard inset (also as the CSS variable --kb on
 * <html>) and safe areas. Recomputes after rotation and after an input loses focus (iOS 26 leaves
 * visualViewport.offsetTop stale after the keyboard closes).
 */
export function useViewportInsets() {
  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(probe);
    const vv = window.visualViewport;
    const timers: number[] = [];

    const update = () => {
      const keyboard = keyboardInset(window.innerHeight, vv);
      document.documentElement.style.setProperty('--kb', `${keyboard}px`);
      useViewportStore.getState().set({ visibleH: visibleHeight(window.innerHeight, vv), keyboard, ...readSafeAreas(probe) });
    };
    const later = (ms: number) => () => timers.push(window.setTimeout(update, ms));
    const onRotate = later(300);
    const onFocusOut = later(350);

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', onRotate);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', onRotate);
      document.removeEventListener('focusout', onFocusOut);
      timers.forEach(clearTimeout);
      probe.remove();
      document.documentElement.style.removeProperty('--kb');
    };
  }, []);
}
```

- [ ] **Step 7: Debug overlay**

```tsx
// src/components/mobile/ViewportDebug.tsx
import { useEffect, useState } from 'react';
import useViewportStore from '@/stores/viewport.store';
import useSidebarStore from '@/stores/sidebar.store';

/** `?viewport-debug`: live viewport numbers for checking the sheet above bottom browser toolbars on real phones. */
export default function ViewportDebug({ snaps }: { snaps: Record<string, number> }) {
  const enabled = new URLSearchParams(window.location.search).has('viewport-debug');
  const viewport = useViewportStore();
  const snap = useSidebarStore((s) => s.sheetSnap);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [enabled]);
  if (!enabled) return null;
  const vv = window.visualViewport;
  const rows: [string, string | number][] = [
    ['innerHeight', window.innerHeight],
    ['clientHeight', document.documentElement.clientHeight],
    ['vv.height', vv ? Math.round(vv.height) : '—'],
    ['vv.offsetTop', vv ? Math.round(vv.offsetTop) : '—'],
    ['safeTop / safeBottom', `${viewport.safeTop} / ${viewport.safeBottom}`],
    ['--kb', viewport.keyboard],
    ['standalone', String(window.matchMedia('(display-mode: standalone)').matches)],
    ['snap', snap],
    ...Object.entries(snaps).map(([k, v]) => [`h.${k}`, v] as [string, number]),
  ];
  return (
    <div className="pointer-events-none fixed left-2 top-[calc(env(safe-area-inset-top)+8px)] z-[100] rounded-lg bg-black/75 px-2 py-1 font-mono text-[10.5px] leading-tight text-white">
      {rows.map(([k, v]) => (
        <div key={k}>
          {k}: {v}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Viewport meta and page CSS**

`index.html` line 5 becomes:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual" />
```

In `src/index.css` replace the base-layer rule

```css
  html,
  body {
    overscroll-behavior: none;
  }
```

with

```css
  html,
  body {
    overscroll-behavior: none;
    /* The page never scrolls (map app); keeps mobile browser toolbars expanded and the bottom sheet's bottom:0 fixed */
    height: 100%;
    overflow: hidden;
  }
```

- [ ] **Step 9: Verify and commit**

```bash
npx --yes bun test src/lib/viewport.test.ts && npx tsc -b
git add index.html src/index.css src/lib/viewport.ts src/lib/viewport.test.ts src/stores/viewport.store.ts src/hooks/viewport-insets.hook.ts src/components/mobile/ViewportDebug.tsx
git commit -m "feat(mobile): viewport insets for bottom toolbars and keyboard"
```

---

### Task 3: Back stack (pure) + `useBackEntry`

**Files:**
- Create: `src/lib/back-stack.ts`, `src/lib/back-stack.test.ts`, `src/hooks/back-entry.hook.ts`

**Interfaces:**
- Produces: `interface HistoryLike { pushState(data: unknown, unused: string): void; back(): void }`, `createBackStack(history: HistoryLike)` returning `{ open(key: string, close: () => void): void; closedByUi(key: string): void; onPopState(): void; keys(): string[] }`; hook `useBackEntry(key: string, active: boolean, close: () => void): void`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/back-stack.test.ts
import { describe, expect, test } from 'bun:test';
import { createBackStack, type HistoryLike } from './back-stack';

function fakeHistory() {
  const calls: string[] = [];
  const history: HistoryLike = { pushState: () => calls.push('push'), back: () => calls.push('back') };
  return { history, calls };
}

describe('back stack', () => {
  test('popstate closes the most recently opened entry first', () => {
    const { history } = fakeHistory();
    const stack = createBackStack(history);
    const closed: string[] = [];
    stack.open('sheet', () => closed.push('sheet'));
    stack.open('page:1', () => closed.push('page:1'));
    stack.open('popup', () => closed.push('popup'));
    stack.onPopState();
    stack.onPopState();
    stack.onPopState();
    expect(closed).toEqual(['popup', 'page:1', 'sheet']);
    expect(stack.keys()).toEqual([]);
  });

  test('each open pushes one history entry; opening the same key twice does not', () => {
    const { history, calls } = fakeHistory();
    const stack = createBackStack(history);
    stack.open('sheet', () => {});
    stack.open('sheet', () => {});
    expect(calls).toEqual(['push']);
  });

  test('closing from the UI consumes the history entry without calling close again', () => {
    const { history, calls } = fakeHistory();
    const stack = createBackStack(history);
    let closes = 0;
    stack.open('popup', () => closes++);
    stack.closedByUi('popup');
    expect(calls).toEqual(['push', 'back']);
    stack.onPopState(); // the popstate caused by our own back()
    expect(closes).toBe(0);
    expect(stack.keys()).toEqual([]);
  });

  test('closedByUi for an unknown key does nothing', () => {
    const { history, calls } = fakeHistory();
    createBackStack(history).closedByUi('nope');
    expect(calls).toEqual([]);
  });

  test('popstate with an empty stack does nothing', () => {
    const { history } = fakeHistory();
    expect(() => createBackStack(history).onPopState()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — `npx --yes bun test src/lib/back-stack.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/back-stack.ts
export interface HistoryLike {
  pushState(data: unknown, unused: string): void;
  back(): void;
}

/**
 * Makes the phone's Back button close our own layers (popup, page, raised sheet) before leaving the site.
 * Every open layer owns one history entry. Back → popstate → the newest layer closes. A layer closed from the UI
 * (X, ‹, drag down) removes its entry with history.back() and ignores the popstate that follows.
 */
export function createBackStack(history: HistoryLike) {
  const entries: { key: string; close: () => void }[] = [];
  let ownPops = 0;
  return {
    open(key: string, close: () => void) {
      if (entries.some((entry) => entry.key === key)) return;
      entries.push({ key, close });
      history.pushState({ jhBack: key }, '');
    },
    closedByUi(key: string) {
      const index = entries.findIndex((entry) => entry.key === key);
      if (index < 0) return;
      entries.splice(index, 1);
      ownPops++;
      history.back();
    },
    onPopState() {
      if (ownPops > 0) {
        ownPops--;
        return;
      }
      entries.pop()?.close();
    },
    keys: () => entries.map((entry) => entry.key),
  };
}
```

- [ ] **Step 4: Run it to verify it passes** — `npx --yes bun test src/lib/back-stack.test.ts` → PASS.

- [ ] **Step 5: Hook**

```ts
// src/hooks/back-entry.hook.ts
import { useEffect, useRef } from 'react';
import { createBackStack } from '@/lib/back-stack';

const backStack = typeof window === 'undefined' ? null : createBackStack(window.history);
if (backStack) window.addEventListener('popstate', () => backStack.onPopState());

/**
 * While `active`, the phone's Back button calls `close` (newest layer first). When the layer closes another way,
 * its history entry is removed again. Keys must be unique per layer ('sheet', 'page:1', 'popup').
 */
export function useBackEntry(key: string, active: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active || !backStack) return;
    let closedByBack = false;
    backStack.open(key, () => {
      closedByBack = true;
      closeRef.current();
    });
    return () => {
      if (!closedByBack) backStack.closedByUi(key);
    };
  }, [key, active]);
}
```

- [ ] **Step 6: Type-check and commit**

```bash
npx tsc -b && git add src/lib/back-stack.ts src/lib/back-stack.test.ts src/hooks/back-entry.hook.ts
git commit -m "feat(mobile): back-button stack for sheet layers"
```

---

### Task 4: BottomSheet component (replaces vaul MobileSheet)

**Files:**
- Create: `src/components/mobile/sheet-motion.ts`, `src/components/mobile/BottomSheet.tsx`

**Interfaces:**
- Consumes: Task 1 (`computeSnapHeights`, `rubberBand`, `settleSnap`, `nextSnap`, `SnapHeights`), Task 2 (`useViewportStore`), `useSidebarStore` (`sheetSnap`, `setSheetSnap`, `setSheetHeight`).
- Produces: `sheetVisibleHeight: MotionValue<number>` (live visible height px); `<BottomSheet peek={ReactNode} onHeights?={(h: SnapHeights) => void}>{body}</BottomSheet>`; the body scroller has `data-sheet-body`.

- [ ] **Step 1: Shared motion value**

```ts
// src/components/mobile/sheet-motion.ts
import { motionValue } from 'motion/react';

/** Live visible height of the phone sheet (px from the bottom). The camera button and popup dock ride on it. */
export const sheetVisibleHeight = motionValue(0);
```

- [ ] **Step 2: The sheet**

```tsx
// src/components/mobile/BottomSheet.tsx
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useTransform } from 'motion/react';
import { computeSnapHeights, nextSnap, rubberBand, settleSnap, type SnapHeights } from '@/lib/sheet-snaps';
import useSidebarStore from '@/stores/sidebar.store';
import useViewportStore from '@/stores/viewport.store';
import { tourTarget } from '@/components/tour/targets';
import { sheetVisibleHeight } from './sheet-motion';

const GRAB = 24;
const SPRING = { type: 'spring', bounce: 0, visualDuration: 0.35 } as const;

interface Drag {
  startY: number;
  startH: number;
  lastY: number;
  lastT: number;
  velocity: number;
  moved: boolean;
  pointerId?: number;
  fromGrab: boolean;
}

/**
 * The phone sheet: fixed to bottom:0 (above bottom browser toolbars), moved only with translateY, three snaps.
 * Drag from the grab/peek area; drag down from the body only when it is scrolled to the top. The body's height
 * follows the settled snap, so content scrolls at every height.
 */
export default function BottomSheet({ peek, children, onHeights }: { peek: ReactNode; children: ReactNode; onHeights?: (h: SnapHeights) => void }) {
  const snap = useSidebarStore((s) => s.sheetSnap);
  const setSnap = useSidebarStore((s) => s.setSheetSnap);
  const setSheetHeight = useSidebarStore((s) => s.setSheetHeight);
  const { visibleH, safeTop, safeBottom, keyboard } = useViewportStore();
  const peekRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [peekContent, setPeekContent] = useState(136);
  const drag = useRef<Drag | null>(null);

  // Peek height = grab + measured peek strip
  useLayoutEffect(() => {
    const el = peekRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPeekContent(GRAB + el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const heights = useMemo(() => computeSnapHeights({ visibleH, safeTop, safeBottom, peekContent }), [visibleH, safeTop, safeBottom, peekContent]);
  useEffect(() => onHeights?.(heights), [heights, onHeights]);
  // An open keyboard means an input in the sheet has focus: give it all the room
  useEffect(() => {
    if (keyboard > 0 && snap !== 'full') setSnap('full');
  }, [keyboard, snap, setSnap]);

  const settled = heights[snap];
  useEffect(() => {
    const controls = animate(sheetVisibleHeight, settled, SPRING);
    setSheetHeight(settled);
    return () => controls.stop();
  }, [settled, setSheetHeight]);
  useEffect(() => () => setSheetHeight(0), [setSheetHeight]);

  const y = useTransform(sheetVisibleHeight, (h) => heights.full - h);

  function onPointerDown(event: React.PointerEvent) {
    const body = bodyRef.current;
    const inBody = !!body && body.contains(event.target as Node);
    if (inBody && body.scrollTop > 0) return;
    drag.current = { startY: event.clientY, startH: sheetVisibleHeight.get(), lastY: event.clientY, lastT: performance.now(), velocity: 0, moved: false, pointerId: event.pointerId, fromGrab: !inBody };
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    // Positive velocity = sheet growing = finger moving up
    d.velocity = (d.lastY - event.clientY) / Math.max(1, now - d.lastT);
    d.lastY = event.clientY;
    d.lastT = now;
    const dy = event.clientY - d.startY;
    if (!d.moved) {
      if (Math.abs(dy) < 6) return;
      // From the body only a downward pull at scrollTop 0 moves the sheet; anything else is a scroll
      if (!d.fromGrab && (dy < 0 || (bodyRef.current?.scrollTop ?? 0) > 0)) {
        drag.current = null;
        return;
      }
      d.moved = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    sheetVisibleHeight.set(rubberBand(d.startH - dy, heights.peek, heights.full));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    // Taps: the grab <button> cycles snaps itself; taps in the peek/body are normal clicks
    if (!d.moved) return;
    const target = settleSnap(sheetVisibleHeight.get(), d.velocity, heights);
    if (target === snap) animate(sheetVisibleHeight, heights[target], SPRING);
    else setSnap(target);
  }

  return (
    <motion.div
      {...tourTarget('sidebar.root')}
      role="region"
      aria-label="Zijbalk"
      className="fixed inset-x-0 bottom-0 z-40 flex select-none flex-col rounded-t-3xl bg-beheer-window shadow-[0_-6px_30px_rgb(0_0_0/.25)] [-webkit-touch-callout:none] [&_input]:select-text [&_textarea]:select-text"
      style={{ height: heights.full, y, marginBottom: keyboard, paddingBottom: 'env(safe-area-inset-bottom)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="flex shrink-0 flex-col" style={{ height: settled - safeBottom }}>
        <button
          type="button"
          aria-label="Zijbalk groter of kleiner maken"
          onClick={() => setSnap(nextSnap(snap))}
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
        >
          <span className="h-[5px] w-9 rounded-full bg-muted-foreground/50" />
        </button>
        <div ref={peekRef} className="shrink-0 touch-none">
          {peek}
        </div>
        <div ref={bodyRef} data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc -b && git add src/components/mobile/sheet-motion.ts src/components/mobile/BottomSheet.tsx
git commit -m "feat(mobile): own bottom sheet with snaps and drag"
```

(The sheet is wired in Task 9; nothing renders it yet.)

---

### Task 5: Map padding follows the sheet

**Files:**
- Modify: `src/components/Map.tsx` (imports; after the `popupPosition` state ~line 146; `onLoad` ~line 75)
- Modify: `src/components/layers/Teams.tsx:16,70`

**Interfaces:**
- Consumes: `useSidebarStore(s => s.sheetHeight)` (Task 1).

- [ ] **Step 1: Map.tsx**

Add import: `import useSidebarStore from '@/stores/sidebar.store';`

After `const isMobile = useIsMobile();` (~line 155) add:

```tsx
    // Phones: the bottom sheet covers the lower part of the map; padding keeps every flyTo/easeTo centre above it
    const sheetHeight = useSidebarStore((state) => state.sheetHeight);
    const bottomPadding = isMobile && !wall ? sheetHeight : 0;
    useEffect(() => {
        mapRef.current?.easeTo({padding: {top: 0, left: 0, right: 0, bottom: bottomPadding}, duration: 300});
    }, [bottomPadding]);
```

In `onLoad`, after the attribution line, add:

```tsx
                    event.target.setPadding({top: 0, left: 0, right: 0, bottom: bottomPadding});
```

- [ ] **Step 2: Teams.tsx** — delete line 16 (`const MOBILE_CENTER_OFFSET ...`) and the `offset: isMobile ? MOBILE_CENTER_OFFSET : [0, 0],` line in the `easeTo` call. If `isMobile` is now unused in Teams.tsx, remove `const isMobile = useIsMobile();` and its import.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc -b && npm run lint
git add src/components/Map.tsx src/components/layers/Teams.tsx
git commit -m "feat(mobile): map padding follows the bottom sheet"
```

---

### Task 6: Camera button in hunt-marker style

**Files:**
- Create: `src/components/mobile/HuntMarkerButton.tsx`
- Delete: `src/components/hunts/HuntCaptureButton.tsx`
- Modify: `src/pages/App.tsx` (remove the import + `{isMobile && <HuntCaptureButton />}`; the shell renders the button)

**Interfaces:**
- Consumes: `sheetVisibleHeight` (Task 4), `cookiePath`, `MARKER_COOKIE_DEPTH` (`@/lib/cookie-shape`), `GLYPHS` (`@/components/layers/marker-glyphs`), `useMarkerPalette` (`@/components/layers/marker-icons`), `HuntPhotoInput`.
- Produces: `<HuntMarkerButton />`.

- [ ] **Step 1: Component**

```tsx
// src/components/mobile/HuntMarkerButton.tsx
import { AnimatePresence, motion, useTransform } from 'motion/react';
import { cookiePath, MARKER_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { GLYPHS } from '@/components/layers/marker-glyphs';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import HuntPhotoInput from '@/components/hunts/HuntPhotoInput';
import useSidebarStore from '@/stores/sidebar.store';
import { tourTarget } from '@/components/tour/targets';
import { POP } from '@/lib/motion';
import { sheetVisibleHeight } from './sheet-motion';

const SIZE = 60;
const RIM = 2.5;
const PATH = cookiePath(SIZE - RIM * 2, MARKER_COOKIE_DEPTH);

/**
 * Phones: "Hunt registreren" as the map's hunt marker (teal cookie, rim, marker shadow, camera glyph): what you tap
 * is what appears on the map. Rides 12px above the sheet; hidden while the sheet is full.
 */
export default function HuntMarkerButton() {
  const palette = useMarkerPalette();
  const snap = useSidebarStore((s) => s.sheetSnap);
  const bottom = useTransform(sheetVisibleHeight, (h) => h + 12);
  return (
    <HuntPhotoInput capture>
      {(open) => (
        <motion.div className="fixed right-3 z-30" style={{ bottom }}>
          <AnimatePresence initial={false}>
            {snap !== 'full' && (
              <motion.button
                {...POP}
                {...tourTarget('huntCapture.button')}
                type="button"
                aria-label="Hunt registreren"
                onClick={open}
                whileTap={{ scale: 0.88 }}
                className="relative grid place-items-center"
                style={{ width: SIZE, height: SIZE, color: palette.onTertiaryContainer, filter: 'drop-shadow(0 1px 4.5px rgb(0 0 0/.3)) drop-shadow(0 6px 14px rgb(0 0 0/.22))' }}
              >
                <svg className="absolute inset-0 overflow-visible" width={SIZE} height={SIZE} viewBox={`${-RIM} ${-RIM} ${SIZE} ${SIZE}`} aria-hidden>
                  <path d={PATH} fill={palette.tertiaryContainer} stroke={palette.surfaceContainerLowest} strokeWidth={RIM * 2} paintOrder="stroke" />
                </svg>
                <svg className="relative" width={26} height={26} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d={GLYPHS.photo_camera} />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </HuntPhotoInput>
  );
}
```

- [ ] **Step 2: Remove the old button** — `git rm src/components/hunts/HuntCaptureButton.tsx`; in `src/pages/App.tsx` delete the `HuntCaptureButton` import and the line `{isMobile && <HuntCaptureButton />}` (keep `<HuntRegistrationDialog />`). Remove `isMobile`/`useIsMobile` from App.tsx if now unused.

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc -b && npm run lint
git add -A src/components/mobile/HuntMarkerButton.tsx src/components/hunts/HuntCaptureButton.tsx src/pages/App.tsx
git commit -m "feat(mobile): camera button as the hunt marker"
```

---

### Task 7: Docked marker popups on phones

**Files:**
- Create: `src/components/mobile/DockedPopup.tsx`
- Modify: `src/components/map/MapPopup.tsx`

**Interfaces:**
- Consumes: `useBackEntry` (Task 3). The dock element `#map-popup-dock` is rendered by `MobileShell` (Task 9).
- Produces: `<DockedPopup longitude latitude onClose>{children}</DockedPopup>`; `DOCK_ID = 'map-popup-dock'`.

- [ ] **Step 1: Component**

```tsx
// src/components/mobile/DockedPopup.tsx
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { XIcon } from 'lucide-react';
import { useMap } from 'react-map-gl/maplibre';
import { useBackEntry } from '@/hooks/back-entry.hook';
import { EASE_OUT } from '@/lib/motion';

export const DOCK_ID = 'map-popup-dock';

/**
 * Phones: a map popup as a card docked just above the sheet instead of floating at the point (where the sheet
 * would hide it). The map eases the point into view; the padding keeps it above the sheet. Back or X closes it.
 */
export default function DockedPopup({ longitude, latitude, onClose, children }: { longitude: number; latitude: number; onClose: () => void; children: ReactNode }) {
  const { current: map } = useMap();
  useBackEntry('popup', true, onClose);
  useEffect(() => {
    map?.easeTo({ center: [longitude, latitude], duration: 500 });
  }, [map, longitude, latitude]);

  const dock = document.getElementById(DOCK_ID);
  if (!dock) return null;
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="pointer-events-auto relative rounded-2xl bg-card p-2.5 text-[12.5px] leading-[1.35] text-card-foreground shadow-[0_0_0_1px_var(--border),0_6px_20px_rgb(0_0_0/.5)]"
    >
      <button type="button" aria-label="Sluiten" onClick={onClose} className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full text-muted-foreground">
        <XIcon className="size-4" />
      </button>
      <div className="flex flex-col pr-6">{children}</div>
    </motion.div>,
    dock,
  );
}
```

- [ ] **Step 2: MapPopup switches on phones**

In `src/components/map/MapPopup.tsx` add imports `import { useIsMobile } from '@/hooks/media.hook';` and `import DockedPopup from '@/components/mobile/DockedPopup';`, and at the top of the component body:

```tsx
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <DockedPopup longitude={longitude} latitude={latitude} onClose={onClose}>
        {children}
      </DockedPopup>
    );
  }
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc -b && npm run lint
git add src/components/mobile/DockedPopup.tsx src/components/map/MapPopup.tsx
git commit -m "feat(mobile): dock map popups above the sheet"
```

---

### Task 8: Nav stack (pure + store) and tracker peek line

**Files:**
- Create: `src/lib/mobile-nav.ts`, `src/lib/mobile-nav.test.ts`, `src/stores/mobile-nav.store.ts`
- Modify: `src/lib/tracker.ts` (add `trackerPeekLine`), `src/lib/tracker.test.ts` (existing)

**Interfaces:**
- Consumes: `SidebarSectionId` from `@/stores/sidebar.store`, `VEHICLE_OPTIONS`, `hasSignalLost` (`@/lib/tracker`), `TrackerMe`.
- Produces: `type MobilePageId = SidebarSectionId` (plan 2 widens it), `interface MobilePage { id: MobilePageId; params?: Record<string, string> }`, `pushPage(stack, page)`, `popPage(stack)`, `replacePage(stack, page)`; store `useMobileNavStore` `{ stack: MobilePage[]; direction: 1 | -1; push(page): void; pop(): void; replace(page): void; reset(): void }`; `trackerPeekLine(status: TrackerMe | undefined, now?: number): { tone: 'ok' | 'warn' | 'muted'; text: string }`.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/mobile-nav.test.ts
import { describe, expect, test } from 'bun:test';
import { popPage, pushPage, replacePage } from './mobile-nav';

describe('mobile nav stack', () => {
  test('push adds a page', () => expect(pushPage([], { id: 'foxes' })).toEqual([{ id: 'foxes' }]));
  test('pushing the page that is already on top is a no-op', () => {
    const stack = [{ id: 'foxes' as const }];
    expect(pushPage(stack, { id: 'foxes' })).toBe(stack);
  });
  test('same id with other params is a new page', () => {
    expect(pushPage([{ id: 'hunts' }], { id: 'hunts', params: { reportId: '1' } })).toHaveLength(2);
  });
  test('pop removes the top; popping an empty stack stays empty', () => {
    expect(popPage([{ id: 'foxes' }, { id: 'hunts' }])).toEqual([{ id: 'foxes' }]);
    expect(popPage([])).toEqual([]);
  });
  test('replace swaps the top page (or pushes on an empty stack)', () => {
    expect(replacePage([{ id: 'foxes' }], { id: 'hunts' })).toEqual([{ id: 'hunts' }]);
    expect(replacePage([], { id: 'hunts' })).toEqual([{ id: 'hunts' }]);
  });
});
```

Append to the existing `src/lib/tracker.test.ts` (it already imports from `bun:test`; add `trackerPeekLine` to its import from `./tracker`):

```ts

describe('trackerPeekLine', () => {
  const now = Date.parse('2026-10-17T14:41:00Z');
  const base = { configured: true as const, qrUrl: '', deepLink: '', osmandUrl: '', uniqueId: 'x', vehicle: 'car' as const };
  test('loading', () => expect(trackerPeekLine(undefined, now)).toEqual({ tone: 'muted', text: 'Tracker laden…' }));
  test('not configured', () => expect(trackerPeekLine({ configured: false, reason: 'api_missing', connected: false }, now)).toEqual({ tone: 'muted', text: 'Tracker niet ingesteld' }));
  test('connected', () =>
    expect(trackerPeekLine({ ...base, connected: true, stats: { lastUpdate: '2026-10-17T14:40:56Z' } }, now)).toEqual({ tone: 'ok', text: 'Verbonden · in de auto · 4 s' }));
  test('signal lost', () =>
    expect(trackerPeekLine({ ...base, connected: false, stats: { lastUpdate: '2026-10-17T14:20:00Z' } }, now)).toEqual({ tone: 'warn', text: 'Geen signaal · 21 min' }));
  test('never paired', () => expect(trackerPeekLine({ ...base, connected: false, stats: {} }, now)).toEqual({ tone: 'warn', text: 'Koppel je telefoon' }));
});
```

- [ ] **Step 2: Run to verify failure** — `npx --yes bun test src/lib/mobile-nav.test.ts src/lib/tracker.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/mobile-nav.ts
import type { SidebarSectionId } from '@/stores/sidebar.store';

/** Pages of the phone sheet. Plan 1: one per sidebar section. */
export type MobilePageId = SidebarSectionId;
export interface MobilePage {
  id: MobilePageId;
  params?: Record<string, string>;
}

function samePage(a: MobilePage, b: MobilePage): boolean {
  return a.id === b.id && JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});
}

export function pushPage(stack: MobilePage[], page: MobilePage): MobilePage[] {
  const top = stack[stack.length - 1];
  return top && samePage(top, page) ? stack : [...stack, page];
}

export function popPage(stack: MobilePage[]): MobilePage[] {
  return stack.slice(0, -1);
}

export function replacePage(stack: MobilePage[], page: MobilePage): MobilePage[] {
  return [...stack.slice(0, -1), page];
}
```

Add to `src/lib/tracker.ts`:

```ts
function ageText(iso: string | undefined, now: number): string | undefined {
  if (!iso) return undefined;
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} u`;
}

/** First line of the phone sheet's peek strip. */
export function trackerPeekLine(status: TrackerMe | undefined, now = Date.now()): { tone: 'ok' | 'warn' | 'muted'; text: string } {
  if (!status) return { tone: 'muted', text: 'Tracker laden…' };
  if (!status.configured) return { tone: 'muted', text: status.reason === 'unreachable' ? 'Tracker niet bereikbaar' : 'Tracker niet ingesteld' };
  const age = ageText(status.stats.lastUpdate, now);
  if (status.connected) {
    const vehicle = VEHICLE_OPTIONS.find((option) => option.value === status.vehicle)?.phrase.toLowerCase();
    return { tone: 'ok', text: joinParts('Verbonden', vehicle, age) };
  }
  if (hasSignalLost(status)) return { tone: 'warn', text: joinParts('Geen signaal', age) };
  return { tone: 'warn', text: 'Koppel je telefoon' };
}
```

with `import { joinParts } from '@/lib/format';` at the top of `tracker.ts`.

Store:

```ts
// src/stores/mobile-nav.store.ts
import { create } from 'zustand';
import { type MobilePage, popPage, pushPage, replacePage } from '@/lib/mobile-nav';
import useSidebarStore from './sidebar.store';

interface MobileNavState {
  /** Pages above the menu; empty = menu */
  stack: MobilePage[];
  /** 1 = forward (push), -1 = back; drives PANE_SLIDE */
  direction: 1 | -1;
  push: (page: MobilePage) => void;
  pop: () => void;
  replace: (page: MobilePage) => void;
  reset: () => void;
}

const useMobileNavStore = create<MobileNavState>()((set) => ({
  stack: [],
  direction: 1,
  push: (page) => {
    set((state) => ({ stack: pushPage(state.stack, page), direction: 1 }));
    // A page gets the whole sheet; going back keeps the height the user chose
    useSidebarStore.getState().setSheetSnap('full');
  },
  pop: () => set((state) => ({ stack: popPage(state.stack), direction: -1 })),
  replace: (page) => set((state) => ({ stack: replacePage(state.stack, page), direction: 1 })),
  reset: () => set({ stack: [], direction: -1 }),
}));

export default useMobileNavStore;
```

- [ ] **Step 4: Run to verify pass** — `npx --yes bun test src/lib/mobile-nav.test.ts src/lib/tracker.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc -b && git add src/lib/mobile-nav.ts src/lib/mobile-nav.test.ts src/stores/mobile-nav.store.ts src/lib/tracker.ts src/lib/tracker.test.ts
git commit -m "feat(mobile): nav stack and tracker peek line"
```

---

### Task 9: Peek strip, menu, page frame, shell wiring

**Files:**
- Create: `src/components/mobile/PeekStrip.tsx`, `src/components/mobile/MobileMenu.tsx`, `src/components/mobile/MobilePage.tsx`, `src/components/mobile/MobileShell.tsx`
- Modify: `src/components/sidebar/Sidebar.tsx` (mobile branch), `src/components/ui/sonner.tsx` (mobile position)
- Delete: `src/components/sidebar/MobileSheet.tsx`

**Interfaces:**
- Consumes: everything above; `useSidebarFoxes` (`@/components/sidebar/foxes/useSidebarFoxes`), `useHuntableAreas` (`@/hooks/huntable-areas.hook`), `FoxStatusBar`, `groupCounts`, `FOX_GROUP_LABEL` (`@/lib/fox-status`), `useTrackerStatus`, `cookiePath`, `BADGE_COOKIE_DEPTH`, the existing section components, `SidebarHeader`, dialog stores (`useAdminStore.openDialog`, `useAccountDialogStore.setOpen`, `useNotificationsDialogStore.setOpen`), `hintProgress`, `predictionSummary`, `trackerSummary`.
- Produces: `<MobileShell mapRef />`.

- [ ] **Step 1: PeekStrip**

```tsx
// src/components/mobile/PeekStrip.tsx
import { useEffect, useState } from 'react';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { trackerPeekLine } from '@/lib/tracker';
import { cookiePath, BADGE_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { useSidebarFoxes } from '@/components/sidebar/foxes/useSidebarFoxes';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import FoxStatusBar from '@/components/sidebar/foxes/FoxStatusBar';
import { FOX_GROUP_LABEL, groupCounts } from '@/lib/fox-status';
import useMobileNavStore from '@/stores/mobile-nav.store';
import { cn } from '@/lib/utils';

const COOKIE_16 = cookiePath(16, BADGE_COOKIE_DEPTH);
const TONE_FILL = { ok: '#22c55e', warn: '#f59e0b', muted: 'var(--muted-foreground)' } as const;
const GROUP_ORDER = ['green', 'orange', 'cooldown', 'red'] as const;

/** Always-visible top of the phone sheet: own tracker line + Vossen status bar with legend. */
export default function PeekStrip() {
  const { status } = useTrackerStatus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const line = trackerPeekLine(status, now);
  const foxes = useSidebarFoxes();
  const { isForbidden } = useHuntableAreas();
  const push = useMobileNavStore((s) => s.push);
  const counts = foxes ? groupCounts(foxes) : undefined;

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <button type="button" onClick={() => push({ id: 'tracking' })} className="flex min-h-9 items-center gap-2 text-left text-[13.5px]">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
          <path d={COOKIE_16} fill={TONE_FILL[line.tone]} />
        </svg>
        <span className={cn('truncate font-semibold', line.tone === 'warn' && 'text-amber-700 dark:text-amber-300')}>{line.text}</span>
      </button>
      {foxes && foxes.length > 0 && counts && (
        <button type="button" onClick={() => push({ id: 'foxes' })} className="flex flex-col gap-1.5 text-left" aria-label="Vossen openen">
          <FoxStatusBar foxes={foxes} size="full" isForbidden={isForbidden} />
          <span className="flex justify-between text-[11px] text-muted-foreground">
            {GROUP_ORDER.map((group) => (
              <span key={group}>
                <b className="font-semibold text-foreground">{counts[group]}</b> {FOX_GROUP_LABEL[group].toLowerCase()}
              </span>
            ))}
          </span>
        </button>
      )}
    </div>
  );
}
```

(Check `FoxGroup` keys in `src/lib/fox-status.ts:54` — they are `green | orange | red | cooldown`; `groupCounts` returns that record.)

- [ ] **Step 2: Page frame with interim content**

```tsx
// src/components/mobile/MobilePage.tsx
import type { ReactNode, RefObject } from 'react';
import { ChevronLeftIcon } from 'lucide-react';
import type { MapRef } from '@/components/Map';
import type { MobilePage as Page } from '@/lib/mobile-nav';
import useMobileNavStore from '@/stores/mobile-nav.store';
import SidebarSections from '@/components/sidebar/SidebarSections';

/**
 * A pushed page: "‹ Menu" plus the page content. Plan 1 shows the existing sidebar card for the section
 * (SidebarSections filtered to one id); plan 2 swaps in the extracted D1 content with a title and description.
 */
export default function MobilePage({ page, mapRef }: { page: Page; mapRef: RefObject<MapRef | null> }) {
  const pop = useMobileNavStore((s) => s.pop);
  return (
    <div className="flex flex-col gap-3 px-3 pb-8">
      <button type="button" onClick={pop} className="flex h-10 w-fit items-center gap-1 rounded-xl pl-1 pr-2.5 text-[13.5px] font-semibold text-muted-foreground">
        <ChevronLeftIcon className="size-5" /> Menu
      </button>
      <PageBody>
        <SidebarSections mapRef={mapRef} only={page.id} />
      </PageBody>
    </div>
  );
}

function PageBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}
```

Modify `src/components/sidebar/SidebarSections.tsx`: add an optional prop `only?: SidebarSectionId` and render each section only when `!only || only === '<its id>'` (ids: `foxes`, `hints`, `hunts`, `predictions`, `hintEntry`, `counterHunt`, `telegram`, `tracking`, `life360`). Example for the first one:

```tsx
export default function SidebarSections({ mapRef, only }: { mapRef: RefObject<MapRef | null>; only?: SidebarSectionId }) {
  const show = (id: SidebarSectionId) => !only || only === id;
  // …
      {show('foxes') && (
        <SidebarSection id="foxes" title="Vossen" summary={<FoxesSummary />}>
          <FoxesCard />
        </SidebarSection>
      )}
```

Apply the same `show(id) &&` guard to every section (HuntsSection → 'hunts', CounterHuntSection → 'counterHunt', TelegramSection → 'telegram', TrackerSection → 'tracking', Life360Section → 'life360'). Import `SidebarSectionId` from `@/stores/sidebar.store`. When a page is pushed the section must be open: in `useMobileNavStore.push` add `useSidebarStore.getState().setSectionOpen(page.id, true);` before `setSheetSnap('full')`.

- [ ] **Step 3: Menu**

```tsx
// src/components/mobile/MobileMenu.tsx
import type { ReactNode } from 'react';
import { BellIcon, ChevronRightIcon, CrosshairIcon, FlagIcon, Grid3x3Icon, KeyRoundIcon, MapPinIcon, MessageSquareIcon, PawPrintIcon, PenLineIcon, ShieldIcon, SmartphoneIcon, UsersIcon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import type { User } from '@/types/User';
import SidebarHeader from '@/components/sidebar/SidebarHeader';
import { FoxesSummary } from '@/components/sidebar/foxes/FoxesCard';
import { useHintBoard } from '@/hooks/hints.hook';
import { hintProgress } from '@/lib/hints';
import { usePredictions, usePredictionSetting } from '@/hooks/predictions.hook';
import { predictionSummary } from '@/lib/prediction';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { trackerSummary } from '@/lib/tracker';
import useMobileNavStore from '@/stores/mobile-nav.store';
import useAdminStore, { type AdminDialogId } from '@/stores/admin.store';
import useAccountDialogStore from '@/stores/account-dialog.store';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import type { MobilePageId } from '@/lib/mobile-nav';

interface Row {
  key: string;
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
  onSelect: () => void;
}

/** Beheer D1 card with segmented rows (radii 16/6, 2px gaps). */
function MenuCard({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="rounded-3xl bg-card p-2">
      <h2 className="px-3 pb-2 pt-1.5 text-[15px] font-bold">{title}</h2>
      <div className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={row.onSelect}
            className="flex min-h-14 items-center gap-3 rounded-md bg-beheer-row px-3 py-2.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl active:bg-beheer-row-high"
          >
            <span className="grid size-[18px] shrink-0 place-items-center text-muted-foreground">{row.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{row.title}</span>
              {row.meta && <span className="block truncate text-xs text-muted-foreground">{row.meta}</span>}
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </section>
  );
}

const BEHEER: [AdminDialogId, string][] = [
  ['algemeen', 'Algemeen'],
  ['users', 'Gebruikers'],
  ['invites', 'Invites'],
  ['hunters', 'Hunters'],
  ['broadcast', 'Bericht versturen'],
  ['koppelingen', 'Koppelingen'],
];

/** Home of the phone sheet: header card + menu cards with live summaries. */
export default function MobileMenu() {
  const push = useMobileNavStore((s) => s.push);
  const user = useAuthUser<User>();
  const { board } = useHintBoard();
  const progress = board ? hintProgress(board) : undefined;
  const { predictions } = usePredictions();
  const { enabled: predictionEnabled } = usePredictionSetting();
  const { status } = useTrackerStatus();
  const page = (id: MobilePageId) => () => push({ id });
  const icon = 'size-[18px]';

  const spel: Row[] = [
    { key: 'foxes', icon: <PawPrintIcon className={icon} />, title: 'Vossen', meta: <FoxesSummary />, onSelect: page('foxes') },
    { key: 'hunts', icon: <CrosshairIcon className={icon} />, title: 'Hunts', onSelect: page('hunts') },
    { key: 'telegram', icon: <MessageSquareIcon className={icon} />, title: 'Jotihunt-berichten', onSelect: page('telegram') },
    ...(predictionEnabled !== false ? [{ key: 'predictions', icon: <MapPinIcon className={icon} />, title: 'Voorspelling', meta: predictionSummary(predictions), onSelect: page('predictions') }] : []),
    { key: 'hints', icon: <Grid3x3Icon className={icon} />, title: 'Hints', meta: progress ? `${progress.solved}/${progress.total} opgelost` : undefined, onSelect: page('hints') },
    { key: 'hintEntry', icon: <PenLineIcon className={icon} />, title: 'Hint registreren', onSelect: page('hintEntry') },
    ...(import.meta.env.HOME_TEAM_API_ID ? [{ key: 'counterHunt', icon: <FlagIcon className={icon} />, title: 'Tegenhunt', onSelect: page('counterHunt') }] : []),
  ];
  const jij: Row[] = [
    { key: 'tracking', icon: <SmartphoneIcon className={icon} />, title: 'Mijn tracker', meta: trackerSummary(status), onSelect: page('tracking') },
    { key: 'life360', icon: <UsersIcon className={icon} />, title: 'Life360', onSelect: page('life360') },
    { key: 'meldingen', icon: <BellIcon className={icon} />, title: 'Meldingen', onSelect: () => useNotificationsDialogStore.getState().setOpen(true) },
    { key: 'account', icon: <KeyRoundIcon className={icon} />, title: 'Account', onSelect: () => useAccountDialogStore.getState().setOpen(true) },
  ];
  const beheer: Row[] = BEHEER.map(([id, title]) => ({ key: id, icon: <ShieldIcon className={icon} />, title, onSelect: () => useAdminStore.getState().openDialog(id) }));

  return (
    <div className="flex flex-col gap-3 px-3 pb-8">
      <SidebarHeader />
      <MenuCard title="Spel" rows={spel} />
      <MenuCard title="Jij" rows={jij} />
      {user?.admin && <MenuCard title="Beheer" rows={beheer} />}
    </div>
  );
}
```

(Meldingen / Account / Beheer still open their existing drawers in plan 1; plan 2 turns them into pages. Check the lucide icon names exist in `lucide-react` ^1.48 — if one is missing (e.g. `Grid3x3Icon`), pick the nearest existing icon.)

- [ ] **Step 4: Shell**

```tsx
// src/components/mobile/MobileShell.tsx
import { type RefObject, useState } from 'react';
import { AnimatePresence, motion, useTransform } from 'motion/react';
import type { MapRef } from '@/components/Map';
import { useViewportInsets } from '@/hooks/viewport-insets.hook';
import { useBackEntry } from '@/hooks/back-entry.hook';
import useSidebarStore from '@/stores/sidebar.store';
import useMobileNavStore from '@/stores/mobile-nav.store';
import { PANE_SLIDE, PANE_SLIDE_TRANSITION } from '@/lib/motion';
import type { SnapHeights } from '@/lib/sheet-snaps';
import BottomSheet from './BottomSheet';
import PeekStrip from './PeekStrip';
import MobileMenu from './MobileMenu';
import MobilePage from './MobilePage';
import HuntMarkerButton from './HuntMarkerButton';
import ViewportDebug from './ViewportDebug';
import { DOCK_ID } from './DockedPopup';
import { sheetVisibleHeight } from './sheet-motion';

/** Back entries per pushed page, newest last (Back pops the newest page). */
function PageBackEntry({ depth }: { depth: number }) {
  const pop = useMobileNavStore((s) => s.pop);
  useBackEntry(`page:${depth}`, true, pop);
  return null;
}

/** Phones: the bottom sheet (peek strip + menu/page stack), camera button and popup dock. */
export default function MobileShell({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  useViewportInsets();
  const snap = useSidebarStore((s) => s.sheetSnap);
  const setSnap = useSidebarStore((s) => s.setSheetSnap);
  const { stack, direction } = useMobileNavStore();
  const [heights, setHeights] = useState<SnapHeights>({ peek: 0, half: 0, full: 0 });
  const dockBottom = useTransform(sheetVisibleHeight, (h) => h + 10);
  const top = stack[stack.length - 1];

  // Declared before the page entries: Back closes pages first, then lowers the sheet
  useBackEntry('sheet', snap !== 'peek', () => setSnap('peek'));

  return (
    <>
      <ViewportDebug snaps={heights} />
      <motion.div id={DOCK_ID} className="pointer-events-none fixed inset-x-3 z-[45] flex flex-col gap-2" style={{ bottom: dockBottom }} />
      <HuntMarkerButton />
      <BottomSheet peek={<PeekStrip />} onHeights={setHeights}>
        {stack.map((page, i) => (
          <PageBackEntry key={`${i}:${page.id}`} depth={i + 1} />
        ))}
        {/* The menu stays mounted (keeps its scroll) while a page is open */}
        <div hidden={!!top}>
          <MobileMenu />
        </div>
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {top && (
            <motion.div key={`${stack.length}:${top.id}`} custom={direction} variants={PANE_SLIDE} initial="enter" animate="center" exit="exit" transition={PANE_SLIDE_TRANSITION}>
              <MobilePage page={top} mapRef={mapRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </BottomSheet>
    </>
  );
}
```

`onHeights={setHeights}` is stable (React state setter), so BottomSheet's effect does not loop.

- [ ] **Step 5: Use the shell**

`src/components/sidebar/Sidebar.tsx`: replace the mobile branch and imports:

```tsx
import MobileShell from '@/components/mobile/MobileShell';
// …
  if (isMobile) return <MobileShell mapRef={mapRef} />;
```

Remove the `MobileSheet` import; `git rm src/components/sidebar/MobileSheet.tsx`.

Reset the nav stack when leaving phone width: in `MobileShell` add

```tsx
  useEffect(() => () => useMobileNavStore.getState().reset(), []);
```

(import `useEffect`).

- [ ] **Step 6: Toasts at the top on phones**

In `src/components/ui/sonner.tsx` add `import { useIsMobile } from '@/hooks/media.hook';`, call `const isMobile = useIsMobile()` next to `isDarkMode`, and pass `position={isMobile ? 'top-center' : 'bottom-right'}` to `<Sonner …>` (before `{...props}`).

- [ ] **Step 7: Verify**

```bash
npx --yes bun test && npx tsc -b && npm run lint
```

Expected: all green. Then run `npm run dev`, open the app with Chrome DevTools device mode (iPhone 14 Pro) and check:
- sheet starts at peek showing the tracker line + Vossen bar; grab tap cycles peek → half → full;
- dragging the grab follows the finger; release snaps; flick skips;
- at half the menu scrolls; tapping "Hints" slides the page in, sheet goes full, "‹ Menu" slides back;
- browser Back closes page → lowers sheet → leaves;
- camera button sits 12px above the sheet, follows drag, pops away at full;
- tapping a fox marker docks its popup above the sheet and the map centres the fox above the sheet;
- `?viewport-debug` shows the overlay;
- desktop width: sidebar unchanged.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/mobile src/components/sidebar src/components/ui/sonner.tsx src/stores/mobile-nav.store.ts
git commit -m "feat(mobile): sheet shell with peek strip, menu and page stack"
```

---

### Task 10: Tour on the new shell

**Files:**
- Modify: `src/components/tour/actions.ts`, `src/components/tour/steps.ts`, `src/components/tour/TourOverlay.tsx`

**Interfaces:**
- Consumes: `useMobileNavStore` (Task 8).
- Produces: tour action `showSection(id: SidebarSectionId): TourAction`, `resetToMenu(): TourAction`.

- [ ] **Step 1: Actions**

Add to `src/components/tour/actions.ts` (import `useMobileNavStore from '@/stores/mobile-nav.store'`):

```ts
/**
 * Show a sidebar section: on desktop expand it, on the phone push its page (sheet goes full). The undo collapses
 * it again / pops the page.
 */
export function showSection(id: SidebarSectionId): TourAction {
  return {
    name: `showSection(${id})`,
    run: (ctx) => {
      if (!ctx.isMobile) return openSection(id).run(ctx);
      useMobileNavStore.getState().push({ id });
      return () => useMobileNavStore.getState().pop();
    },
  };
}

/** Phones: back to the menu (no-op on desktop). */
export function resetToMenu(): TourAction {
  return {
    name: 'resetToMenu',
    run: (ctx) => {
      if (ctx.isMobile) useMobileNavStore.getState().reset();
    },
  };
}
```

- [ ] **Step 2: Steps**

In `src/components/tour/steps.ts` replace every `[sheetSnap('full'), openSection('<id>')]` with `[sheetSnap('full'), showSection('<id>')]` (foxes, hunts, hints, hintEntry, predictions, counterHunt, tracking), and the settings step's actions with `[resetToMenu(), sheetSnap('half'), openSettings()]` (the settings button now sits in the header card at the top of the menu; drop `scrollSidebarToTop()` there, keep the function for desktop use elsewhere if referenced, otherwise delete it). Update the imports.

- [ ] **Step 3: Snapshot also restores the nav stack**

In `src/components/tour/TourOverlay.tsx`, next to the sidebar snapshot (`snapshot` ref, ~line 43), snapshot `useMobileNavStore.getState().stack` into a second ref when the tour starts and restore it with `useMobileNavStore.setState({ stack })` in the same cleanup that restores the sidebar.

```tsx
  const navSnapshot = useRef<MobilePage[] | null>(null);
  // in the useLayoutEffect that takes the sidebar snapshot:
  navSnapshot.current = useMobileNavStore.getState().stack;
  // in the restore cleanup:
  if (navSnapshot.current) useMobileNavStore.setState({ stack: navSnapshot.current, direction: -1 });
  navSnapshot.current = null;
```

(imports: `useMobileNavStore`, `type MobilePage` from `@/lib/mobile-nav`.)

- [ ] **Step 4: Verify**

```bash
npx --yes bun test src/components/tour && npx tsc -b && npm run lint
```

Expected: PASS. Manually in device mode: replay the tour (gear → Rondleiding); each section step opens its page; the settings step shows the menu with the header card and opens the gear menu; finishing restores the menu.

- [ ] **Step 5: Commit**

```bash
git add src/components/tour
git commit -m "feat(mobile): tour steps push sheet pages"
```

---

### Task 11: Real-device check

- [ ] **Step 1:** Build + deploy a preview the user can open on phones (or `npm run dev -- --host` on the LAN). Open with `?viewport-debug`.
- [ ] **Step 2:** Walk the spec's device checklist: iOS 26 Safari Compact and Bottom tab layouts, iOS Home Screen web app, Chrome Android with bottom address bar, Samsung Internet bottom bar, Firefox Android, gesture and 3-button navigation. Verify: grab handle fully visible and tappable above each toolbar, drag to full, keyboard open/close (Hint registreren page), scrolling inside the sheet, rotation, toolbar tint.
- [ ] **Step 3:** Record findings in the PR description; fix regressions before merging.
