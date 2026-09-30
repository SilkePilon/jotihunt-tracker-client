# Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-login guided tour: a floating card glides between parts of the UI, spotlights them, drives the real UI (sections, sheet, hint board, settings menu, map), auto-advances with a progress bar, and can be replayed from Settings.

**Architecture:** A custom tour engine in `src/components/tour/`. Tour content is a plain `TOUR_STEPS` array. Components mark themselves with typed `tourTarget(id)` data attributes. Steps drive the UI only through a small library of named, reversible actions. A zustand store holds the progress. `TourOverlay` (mounted once in `Layout.tsx`) runs the actions, finds the target, draws the spotlight and positions the card. The server stores `tutorialVersion` per user, and the tour auto-starts when it is lower than `TOUR_VERSION`.

**Tech Stack:** React 19, TypeScript, zustand, Tailwind v4, shadcn/ui, react-auth-kit, vaul, Radix. Server: Express, Mongoose, express-validator. Tests: `bun test`.

**Spec:** `docs/superpowers/specs/2026-09-30-onboarding-tour-design.md`

## Global Constraints

- No new dependencies (no driver.js / react-joyride / framer-motion).
- The tour never creates, edits or deletes data. Actions only open/close UI and move the map.
- UI copy is Dutch. Code, comments and identifiers are English.
- `TOUR_VERSION = 1`. The server field is `tutorialVersion: number`, default `0`.
- Duration formula: `step.durationMs ?? clamp(4000 + 40 * (title.length + body.length), 4000, 10000)`.
- Card: 12px viewport margin, 12px gap to target, spotlight padding 8px, move transition ~350ms, `motion-reduce:transition-none`.
- Keyboard while the tour is active: `→` next, `←` previous, `Esc` skip.
- Skip and finish both mark the tour as seen, but only in `auto` mode. A replay never calls the server.
- `bun` is not on PATH: use `npx --yes bun test`. Type check: client `npx tsc -b`, server `npx --yes bun x tsc --noEmit`.
- Server tests use the docker Mongo at `mongodb://localhost:27017/jotihunt-test`. Never restart the docker stack (it's the user's live instance).
- Both repos are on `main` with unrelated uncommitted work. Only `git add` the files named in each task. Never `git add -A` or `git add .`.

## Deviations from spec (decided during planning)

- **Spotlight:** a positioned `div` with a huge `box-shadow`, instead of an SVG mask. Same look, and `top/left/width/height` transitions work in every browser.
- **Target tracking:** a `requestAnimationFrame` loop re-measures the target rect instead of ResizeObserver plus scroll listeners. This also catches movement without a resize, such as the sheet snapping or sections expanding above the target.
- **`flyTo` overview:** there is no area geometry client-side (`Area` has only a name and status). The overview flies to the map's default view, which moves from `Map.tsx` to `src/lib/map-view.ts`.
- **`sheetSnap` has no undo**, to avoid the sheet bouncing between consecutive steps. The start-of-tour sidebar snapshot restores the sheet at the end.
- **New step field `optional: true`:** if the target is missing (Voorspelling hidden, Tegenhunt without `HOME_TEAM_API_ID`), the step is skipped in the current direction instead of showing a centered card.
- **Desktop step 13 target** is `cards.topRight`, the wrapper around the coordinates and search cards.
- **Server tests** cover the model helper `setTutorialVersion`. The codebase has no HTTP-level tests; `verifyToken` already guards the route.
- **Modal guards:** Radix/vaul dialogs close on outside pointer-down, and a click on the tour card counts as outside. The hint board and the settings menu ignore close requests while the tour is active. The tour's own undo closes them.

## File Structure

Client (`jotihunt-tracker-client/`):

| File | Status | Responsibility |
|---|---|---|
| `src/components/tour/types.ts` | create | `TourStep`, `TourAction`, `TourContext`, `Undo`, `Platform`, `Placement` |
| `src/components/tour/targets.ts` | create | `TourTargetId` union, `tourTarget()`, `tourSelector()` |
| `src/components/tour/duration.ts` | create | `stepDuration()` |
| `src/components/tour/resolve.ts` | create | `stepsForPlatform()`, `targetFor()` |
| `src/components/tour/runner.ts` | create | `runActions()`, `runUndos()` |
| `src/components/tour/placement.ts` | create | `placeCard()`, pure positioning |
| `src/components/tour/tour.store.ts` | create | zustand store for progress |
| `src/components/tour/actions.ts` | create | named actions: `openSection`, `sheetSnap`, `openHintBoard`, `openSettings`, `flyToOverview` |
| `src/components/tour/steps.ts` | create | `TOUR_VERSION`, `TOUR_STEPS` (the Dutch copy) |
| `src/components/tour/useTargetRect.ts` | create | find target element and track its rect |
| `src/components/tour/useTour.ts` | create | `useStartTour()`, `useTourAutoStart()` (server + auth glue) |
| `src/components/tour/TourCard.tsx` | create | the card UI |
| `src/components/tour/TourOverlay.tsx` | create | runner, spotlight, card placement, keyboard |
| `src/components/tour/*.test.ts` | create | unit tests |
| `src/stores/settings-menu.store.ts` | create | settings dropdown open state |
| `src/lib/map-view.ts` | create | `DEFAULT_VIEW` (moved out of `Map.tsx`) |
| `src/types/User.ts` | modify | `tutorialVersion?: number` |
| `src/components/Map.tsx` | modify | use `DEFAULT_VIEW`, `tourTarget('map')` |
| `src/components/sidebar/SidebarSection.tsx` | modify | `tourTarget(\`sidebar.${id}\`)` |
| `src/components/sidebar/Sidebar.tsx` | modify | `tourTarget('sidebar.root')` (desktop) |
| `src/components/sidebar/MobileSheet.tsx` | modify | `tourTarget('sidebar.root')` (mobile) |
| `src/components/hints/HintBoardDialog.tsx` | modify | `tourTarget('hintBoard.dialog')`, close guard |
| `src/components/hunts/HuntCaptureButton.tsx` | modify | `tourTarget('huntCapture.button')` |
| `src/pages/App.tsx` | modify | `tourTarget('cards.topRight')` |
| `src/components/Settings.tsx` | modify | controlled open state, close guard, "Rondleiding opnieuw" item |
| `src/Layout.tsx` | modify | mount `TourOverlay`, auto start, hold PWA prompt |
| `src/index.css` | modify | `@keyframes tour-progress` |

Server (`jotihunt-tracker-server/`):

| File | Status | Responsibility |
|---|---|---|
| `src/models/user.model.ts` | modify | `tutorialVersion` field + `setTutorialVersion()` helper |
| `src/models/user.model.test.ts` | create | helper tests |
| `src/controllers/auth.controller.ts` | modify | login returns `tutorialVersion`; `updateTutorial` handler |
| `src/routes/auth.route.ts` | modify | `POST /auth/tutorial` |

---

### Task 0: Branches

**Files:** none

- [ ] **Step 1: Create feature branches in both repos**

```bash
git -C "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client" switch -c feat/onboarding-tour
git -C "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-server" switch -c feat/onboarding-tour
```

The existing uncommitted changes carry over untouched. Don't commit them.

- [ ] **Step 2: Commit the spec and plan (client)**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
git add docs/superpowers/specs/2026-09-30-onboarding-tour-design.md docs/superpowers/plans/2026-09-30-onboarding-tour.md
git commit -m "docs: onboarding tour spec and plan"
```

---

### Task 1: Server: `tutorialVersion` field and endpoint

**Files:**
- Modify: `jotihunt-tracker-server/src/models/user.model.ts`
- Create: `jotihunt-tracker-server/src/models/user.model.test.ts`
- Modify: `jotihunt-tracker-server/src/controllers/auth.controller.ts`
- Modify: `jotihunt-tracker-server/src/routes/auth.route.ts`

**Interfaces:**
- Produces: `POST /auth/tutorial` with body `{ version: number }` (integer ≥ 0) returns `200 { tutorialVersion: number }`. The login response `user` gains `tutorialVersion: number`.

- [ ] **Step 1: Write the failing test**

Create `src/models/user.model.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { setTutorialVersion, User } from "./user.model";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/db";

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

async function createUser() {
  return User.create({ email: "tour@example.com", password: "x", name: "Tour" });
}

describe("tutorialVersion", () => {
  test("defaults to 0", async () => {
    const user = await createUser();
    expect(user.tutorialVersion).toBe(0);
  });

  test("setTutorialVersion stores the version", async () => {
    const user = await createUser();
    expect(await setTutorialVersion(user, 2)).toBe(2);
    const reloaded = await User.findById(user._id);
    expect(reloaded!.tutorialVersion).toBe(2);
  });

  test("setTutorialVersion never lowers the version", async () => {
    const user = await createUser();
    await setTutorialVersion(user, 3);
    expect(await setTutorialVersion(user, 1)).toBe(3);
  });

  test("users stored before the field existed read as 0", async () => {
    await User.collection.insertOne({ email: "old@example.com", password: "x", name: "Old", admin: false, requiresPasswordChange: false });
    const user = await User.findOne({ email: "old@example.com" });
    expect(user!.tutorialVersion).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-server" && npx --yes bun test src/models/user.model.test.ts`
Expected: FAIL. `setTutorialVersion` is not exported.

- [ ] **Step 3: Add the field and helper**

In `src/models/user.model.ts`, add after the `requiresPasswordChange` block inside `UserSchema`:

```ts
  /** Highest onboarding tour version this user has seen (client TOUR_VERSION); 0 = never. */
  tutorialVersion: {
    type: Number,
    default: 0,
    required: true,
  },
```

Append at the end of the file:

```ts
/** Record that the user has seen the onboarding tour up to `version`. Never lowers the stored version. */
export async function setTutorialVersion(user: UserType, version: number): Promise<number> {
  user.tutorialVersion = Math.max(user.tutorialVersion ?? 0, version);
  await user.save();
  return user.tutorialVersion;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx --yes bun test src/models/user.model.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Controller and route**

In `src/controllers/auth.controller.ts`, change the import to `import { setTutorialVersion, User } from "../models/user.model";`. In the login response `user` object, add after `requiresPasswordChange: user.requiresPasswordChange,`:

```ts
        tutorialVersion: user.tutorialVersion,
```

Append:

```ts
export async function updateTutorial(req: Request, res: Response) {
  const tutorialVersion = await setTutorialVersion(req.user!, req.body.version);
  return res.status(200).json({ tutorialVersion });
}
```

In `src/routes/auth.route.ts`, add below `updatePasswordValidator`:

```ts
const tutorialValidator = [
  body("version").isInt({ min: 0 }).withMessage("Versie moet een getal van 0 of hoger zijn.").toInt(),
];
```

and below the update-password route:

```ts
router.post("/tutorial", [verifyToken, validate(tutorialValidator)], authController.updateTutorial);
```

- [ ] **Step 6: Type check and full test run**

Run: `npx --yes bun x tsc --noEmit && npx --yes bun test`
Expected: no type errors; all tests pass. If `req.user` is typed so that `setTutorialVersion(req.user!, …)` doesn't type check, look at how `updatePassword` uses `req.user!` and match the type in `src/types/`.

- [ ] **Step 7: Commit**

```bash
git add src/models/user.model.ts src/models/user.model.test.ts src/controllers/auth.controller.ts src/routes/auth.route.ts
git commit -m "feat: store onboarding tour version per user"
```

---

### Task 2: Client: tour types, targets, duration, platform resolution

**Files:**
- Create: `src/components/tour/types.ts`
- Create: `src/components/tour/targets.ts`
- Create: `src/components/tour/duration.ts`
- Create: `src/components/tour/resolve.ts`
- Test: `src/components/tour/duration.test.ts`, `src/components/tour/resolve.test.ts`

(All paths in this and later client tasks are relative to `jotihunt-tracker-client/`.)

**Interfaces:**
- Produces:
  - `TourTargetId`, `TOUR_TARGET_IDS: readonly TourTargetId[]`, `tourTarget(id): { 'data-tour': TourTargetId }`, `tourSelector(id): string`
  - `TourStep`, `TourAction`, `TourContext`, `Undo`, `Platform`, `Placement`
  - `stepDuration(step: Pick<TourStep,'title'|'body'|'durationMs'>): number`
  - `stepsForPlatform(steps, platform): TourStep[]`, `targetFor(step, platform): TourTargetId | null`

- [ ] **Step 1: Write `types.ts` and `targets.ts`** (types only, no test needed)

`src/components/tour/targets.ts`:

```ts
import type { SidebarSectionId } from '@/stores/sidebar.store';

const SIDEBAR_SECTIONS = ['foxes', 'hints', 'hunts', 'predictions', 'hintEntry', 'counterHunt', 'tracking', 'hunters'] as const satisfies readonly SidebarSectionId[];

/**
 * Every element the tour can point at. Components mark themselves with {...tourTarget(id)};
 * steps refer to the same ids, so a moved component keeps working and a typo does not compile.
 */
export const TOUR_TARGET_IDS = [
  'map',
  'sidebar.root',
  ...SIDEBAR_SECTIONS.map((id) => `sidebar.${id}` as const),
  'hintBoard.dialog',
  'huntCapture.button',
  'cards.topRight',
  'settings.replayItem',
] as const;

export type TourTargetId = (typeof TOUR_TARGET_IDS)[number];

export function tourTarget(id: TourTargetId) {
  return { 'data-tour': id } as const;
}

export function tourSelector(id: TourTargetId) {
  return `[data-tour="${id}"]`;
}
```

`src/components/tour/types.ts`:

```ts
import type { RefObject } from 'react';
import type { MapRef } from '@/components/Map';
import type { TourTargetId } from './targets';

export type Platform = 'mobile' | 'desktop';
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/** Reverts what an action did. */
export type Undo = () => void;

export interface TourContext {
  mapRef: RefObject<MapRef | null>;
  isMobile: boolean;
}

/** A reusable UI action (see actions.ts). `run` may return an Undo; the runner calls it when leaving the step. */
export interface TourAction {
  name: string;
  run: (ctx: TourContext) => void | Undo | Promise<void | Undo>;
}

export interface TourStep {
  /** Unique, stable id */
  id: string;
  /** null = centered card without spotlight; an object picks a target per platform */
  target: TourTargetId | null | Partial<Record<Platform, TourTargetId | null>>;
  /** Dutch */
  title: string;
  /** Dutch */
  body: string;
  /** Run in order when the step is entered; undone in reverse when it is left */
  actions?: TourAction[];
  /** Overrides the length-based duration */
  durationMs?: number;
  /** Default 'auto' */
  placement?: Placement;
  /** Only show on this platform */
  only?: Platform;
  /** Skip the step (in the current direction) when its target is not in the DOM, e.g. a feature that is turned off */
  optional?: boolean;
  /** TOUR_VERSION that introduced this step; reserved for a future "what's new" tour */
  since?: number;
}
```

- [ ] **Step 2: Write the failing tests**

`src/components/tour/duration.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { stepDuration } from './duration';

describe('stepDuration', () => {
  test('uses 4s + 40ms per character', () => {
    expect(stepDuration({ title: 'a'.repeat(10), body: 'b'.repeat(40) })).toBe(4000 + 40 * 50);
  });

  test('is at least 4s', () => {
    expect(stepDuration({ title: '', body: '' })).toBe(4000);
  });

  test('is at most 10s', () => {
    expect(stepDuration({ title: 'x', body: 'y'.repeat(1000) })).toBe(10000);
  });

  test('durationMs overrides the formula', () => {
    expect(stepDuration({ title: 'x', body: 'y', durationMs: 1234 })).toBe(1234);
  });
});
```

`src/components/tour/resolve.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { stepsForPlatform, targetFor } from './resolve';
import type { TourStep } from './types';

const base = { title: 't', body: 'b' };
const steps: TourStep[] = [
  { ...base, id: 'all', target: null },
  { ...base, id: 'phone', target: 'huntCapture.button', only: 'mobile' },
  { ...base, id: 'desk', target: 'cards.topRight', only: 'desktop' },
  { ...base, id: 'split', target: { mobile: 'sidebar.root', desktop: 'map' } },
];

describe('stepsForPlatform', () => {
  test('keeps shared steps and the platform-only ones', () => {
    expect(stepsForPlatform(steps, 'mobile').map((s) => s.id)).toEqual(['all', 'phone', 'split']);
    expect(stepsForPlatform(steps, 'desktop').map((s) => s.id)).toEqual(['all', 'desk', 'split']);
  });
});

describe('targetFor', () => {
  test('plain target', () => {
    expect(targetFor(steps[1], 'mobile')).toBe('huntCapture.button');
  });

  test('null target', () => {
    expect(targetFor(steps[0], 'desktop')).toBeNull();
  });

  test('per-platform target', () => {
    expect(targetFor(steps[3], 'mobile')).toBe('sidebar.root');
    expect(targetFor(steps[3], 'desktop')).toBe('map');
  });

  test('per-platform target missing for a platform is null', () => {
    expect(targetFor({ ...base, id: 'x', target: { mobile: 'map' } }, 'desktop')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx --yes bun test src/components/tour`
Expected: FAIL. Modules `./duration` and `./resolve` not found.

- [ ] **Step 4: Implement**

`src/components/tour/duration.ts`:

```ts
import type { TourStep } from './types';

const MIN_MS = 4000;
const MAX_MS = 10000;
const MS_PER_CHAR = 40;

/** How long a step stays before auto-advancing: longer text gets more time. */
export function stepDuration(step: Pick<TourStep, 'title' | 'body' | 'durationMs'>): number {
  if (step.durationMs != null) return step.durationMs;
  const ms = MIN_MS + MS_PER_CHAR * (step.title.length + step.body.length);
  return Math.min(MAX_MS, Math.max(MIN_MS, ms));
}
```

`src/components/tour/resolve.ts`:

```ts
import type { TourTargetId } from './targets';
import type { Platform, TourStep } from './types';

export function stepsForPlatform(steps: TourStep[], platform: Platform): TourStep[] {
  return steps.filter((step) => !step.only || step.only === platform);
}

export function targetFor(step: TourStep, platform: Platform): TourTargetId | null {
  const { target } = step;
  if (target === null || typeof target === 'string') return target;
  return target[platform] ?? null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx --yes bun test src/components/tour`
Expected: 9 pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/tour/types.ts src/components/tour/targets.ts src/components/tour/duration.ts src/components/tour/resolve.ts src/components/tour/duration.test.ts src/components/tour/resolve.test.ts
git commit -m "feat(tour): step types, typed targets, duration and platform resolution"
```

---

### Task 3: Client: action runner and card placement

**Files:**
- Create: `src/components/tour/runner.ts`, `src/components/tour/placement.ts`
- Test: `src/components/tour/runner.test.ts`, `src/components/tour/placement.test.ts`

**Interfaces:**
- Consumes: `TourAction`, `TourContext`, `Undo`, `Placement` (Task 2)
- Produces:
  - `runActions(actions: TourAction[], ctx: TourContext): Promise<Undo[]>`: runs the actions in order and collects their undos.
  - `runUndos(undos: Undo[]): void`: runs the undos in reverse order and never throws.
  - `interface Rect { x; y; width; height }`, `interface Size { width; height }`
  - `placeCard(opts: { target: Rect | null; card: Size; viewport: Size; placement?: Placement; isMobile: boolean }): { x: number; y: number }`
  - `CARD_MARGIN = 12`, `CARD_GAP = 12`

- [ ] **Step 1: Write the failing tests**

`src/components/tour/runner.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { runActions, runUndos } from './runner';
import type { TourAction, TourContext } from './types';

const ctx = { mapRef: { current: null }, isMobile: false } as TourContext;

function action(name: string, log: string[], withUndo = true): TourAction {
  return {
    name,
    run: async () => {
      log.push(`run ${name}`);
      return withUndo ? () => log.push(`undo ${name}`) : undefined;
    },
  };
}

describe('runner', () => {
  test('runs actions in order and undoes them in reverse', async () => {
    const log: string[] = [];
    const undos = await runActions([action('a', log), action('b', log, false), action('c', log)], ctx);
    runUndos(undos);
    expect(log).toEqual(['run a', 'run b', 'run c', 'undo c', 'undo a']);
  });

  test('a failing action does not stop the rest', async () => {
    const log: string[] = [];
    const broken: TourAction = { name: 'broken', run: () => { throw new Error('boom'); } };
    const undos = await runActions([broken, action('ok', log)], ctx);
    expect(log).toEqual(['run ok']);
    expect(undos).toHaveLength(1);
  });

  test('a failing undo does not stop the rest', () => {
    const log: string[] = [];
    runUndos([() => log.push('first'), () => { throw new Error('boom'); }]);
    expect(log).toEqual(['first']);
  });
});
```

`src/components/tour/placement.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { placeCard } from './placement';

const viewport = { width: 1280, height: 800 };
const card = { width: 340, height: 200 };

describe('placeCard', () => {
  test('no target: centered', () => {
    expect(placeCard({ target: null, card, viewport, isMobile: false })).toEqual({ x: 470, y: 300 });
  });

  test('left sidebar section: card goes to the right of it, vertically centered', () => {
    const target = { x: 8, y: 100, width: 320, height: 100 };
    expect(placeCard({ target, card, viewport, isMobile: false })).toEqual({ x: 340, y: 50 });
  });

  test('clamped inside the viewport', () => {
    const target = { x: 8, y: 0, width: 320, height: 40 };
    expect(placeCard({ target, card, viewport, isMobile: false }).y).toBe(12);
  });

  test('explicit placement that does not fit falls back to auto', () => {
    const target = { x: 8, y: 100, width: 320, height: 100 };
    expect(placeCard({ target, card, viewport, placement: 'left', isMobile: false }).x).toBe(340);
  });

  test('full-screen target (map): centered over it', () => {
    const target = { x: 0, y: 0, width: 1280, height: 800 };
    expect(placeCard({ target, card, viewport, isMobile: false })).toEqual({ x: 470, y: 300 });
  });

  test('mobile, target in bottom half: card docks at the top', () => {
    const phone = { width: 390, height: 844 };
    const target = { x: 0, y: 600, width: 390, height: 100 };
    expect(placeCard({ target, card: { width: 366, height: 180 }, viewport: phone, isMobile: true })).toEqual({ x: 12, y: 12 });
  });

  test('mobile, target in top half: card docks at the bottom', () => {
    const phone = { width: 390, height: 844 };
    const target = { x: 0, y: 40, width: 390, height: 60 };
    expect(placeCard({ target, card: { width: 366, height: 180 }, viewport: phone, isMobile: true })).toEqual({ x: 12, y: 652 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx --yes bun test src/components/tour/runner.test.ts src/components/tour/placement.test.ts`
Expected: FAIL. Modules not found.

- [ ] **Step 3: Implement**

`src/components/tour/runner.ts`:

```ts
import type { TourAction, TourContext, Undo } from './types';

/** Run a step's actions in order; returns their undos. A broken action is logged and skipped so the tour keeps going. */
export async function runActions(actions: TourAction[], ctx: TourContext): Promise<Undo[]> {
  const undos: Undo[] = [];
  for (const action of actions) {
    try {
      const undo = await action.run(ctx);
      if (undo) undos.push(undo);
    } catch (error) {
      console.warn(`[tour] action failed: ${action.name}`, error);
    }
  }
  return undos;
}

/** Revert a step's actions, last first. */
export function runUndos(undos: Undo[]): void {
  for (const undo of [...undos].reverse()) {
    try {
      undo();
    } catch (error) {
      console.warn('[tour] undo failed', error);
    }
  }
}
```

`src/components/tour/placement.ts`:

```ts
import type { Placement } from './types';

export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }

export const CARD_MARGIN = 12;
export const CARD_GAP = 12;

type Side = Exclude<Placement, 'auto'>;
const AUTO_ORDER: Side[] = ['right', 'bottom', 'left', 'top'];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function space(target: Rect, viewport: Size): Record<Side, number> {
  return {
    right: viewport.width - (target.x + target.width),
    left: target.x,
    bottom: viewport.height - (target.y + target.height),
    top: target.y,
  };
}

function fits(side: Side, room: Record<Side, number>, card: Size) {
  const needed = side === 'left' || side === 'right' ? card.width : card.height;
  return room[side] >= needed + CARD_GAP + CARD_MARGIN;
}

/** Top-left corner for the tour card, kept inside the viewport. */
export function placeCard({ target, card, viewport, placement = 'auto', isMobile }: {
  target: Rect | null;
  card: Size;
  viewport: Size;
  placement?: Placement;
  isMobile: boolean;
}): { x: number; y: number } {
  const maxX = viewport.width - card.width - CARD_MARGIN;
  const maxY = viewport.height - card.height - CARD_MARGIN;
  const centered = { x: Math.round((viewport.width - card.width) / 2), y: Math.round((viewport.height - card.height) / 2) };
  if (!target) return centered;

  // Phones: card centered horizontally, docked at the edge away from the target
  if (isMobile) {
    const targetCenter = target.y + target.height / 2;
    return { x: Math.max(CARD_MARGIN, centered.x), y: targetCenter > viewport.height / 2 ? CARD_MARGIN : maxY };
  }

  const room = space(target, viewport);
  const side: Side | undefined =
    placement !== 'auto' && fits(placement, room, card) ? placement : AUTO_ORDER.find((s) => fits(s, room, card));
  // Nothing fits beside the target (e.g. the whole map): float in the middle of the screen
  if (!side) return centered;

  const midX = target.x + target.width / 2 - card.width / 2;
  const midY = target.y + target.height / 2 - card.height / 2;
  const raw = {
    right: { x: target.x + target.width + CARD_GAP, y: midY },
    left: { x: target.x - card.width - CARD_GAP, y: midY },
    bottom: { x: midX, y: target.y + target.height + CARD_GAP },
    top: { x: midX, y: target.y - card.height - CARD_GAP },
  }[side];

  return { x: Math.round(clamp(raw.x, CARD_MARGIN, maxX)), y: Math.round(clamp(raw.y, CARD_MARGIN, maxY)) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx --yes bun test src/components/tour`
Expected: all pass (19 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/tour/runner.ts src/components/tour/placement.ts src/components/tour/runner.test.ts src/components/tour/placement.test.ts
git commit -m "feat(tour): action runner with undo stack and card placement"
```

---

### Task 4: Client: tour store

**Files:**
- Create: `src/components/tour/tour.store.ts`
- Test: `src/components/tour/tour.store.test.ts`

**Interfaces:**
- Produces: default export `useTourStore` with state
  `{ active: boolean; mode: TourMode; stepIndex: number; stepCount: number; direction: 1 | -1; paused: boolean }`
  and actions
  `start(opts: { mode: TourMode; stepCount: number; onEnd?: () => void }): void`, `next(): void` (finishes on the last step), `prev(): void`, `togglePause(): void`, `skip(): void`, `finish(): void`, `stop(): void` (ends without `onEnd`).
  Exported type `TourMode = 'auto' | 'replay'`.

- [ ] **Step 1: Write the failing test**

`src/components/tour/tour.store.test.ts`:

```ts
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import useTourStore from './tour.store';

const store = () => useTourStore.getState();

beforeEach(() => store().stop());

describe('tour store', () => {
  test('start activates at step 0', () => {
    store().start({ mode: 'auto', stepCount: 3 });
    expect(store()).toMatchObject({ active: true, mode: 'auto', stepIndex: 0, stepCount: 3, paused: false });
  });

  test('prev stops at the first step', () => {
    store().start({ mode: 'replay', stepCount: 3 });
    store().prev();
    expect(store().stepIndex).toBe(0);
  });

  test('next and prev move and record the direction', () => {
    store().start({ mode: 'replay', stepCount: 3 });
    store().next();
    expect(store()).toMatchObject({ stepIndex: 1, direction: 1 });
    store().prev();
    expect(store()).toMatchObject({ stepIndex: 0, direction: -1 });
  });

  test('next on the last step finishes and calls onEnd once', () => {
    const onEnd = mock(() => {});
    store().start({ mode: 'auto', stepCount: 2, onEnd });
    store().next();
    store().next();
    expect(store().active).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('skip calls onEnd', () => {
    const onEnd = mock(() => {});
    store().start({ mode: 'auto', stepCount: 5, onEnd });
    store().skip();
    expect(store().active).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('stop ends without onEnd', () => {
    const onEnd = mock(() => {});
    store().start({ mode: 'auto', stepCount: 5, onEnd });
    store().stop();
    expect(store().active).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('restart resets index and pause', () => {
    store().start({ mode: 'replay', stepCount: 5 });
    store().next();
    store().togglePause();
    store().start({ mode: 'replay', stepCount: 5 });
    expect(store()).toMatchObject({ stepIndex: 0, paused: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx --yes bun test src/components/tour/tour.store.test.ts`
Expected: FAIL. Module not found.

- [ ] **Step 3: Implement**

`src/components/tour/tour.store.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx --yes bun test src/components/tour/tour.store.test.ts`
Expected: 7 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/tour/tour.store.ts src/components/tour/tour.store.test.ts
git commit -m "feat(tour): tour progress store"
```

---

### Task 5: Client: settings menu store, map view constant, actions, steps

**Files:**
- Create: `src/stores/settings-menu.store.ts`
- Create: `src/lib/map-view.ts`
- Modify: `src/components/Map.tsx:39-43` (use `DEFAULT_VIEW`)
- Create: `src/components/tour/actions.ts`
- Create: `src/components/tour/steps.ts`
- Test: `src/components/tour/steps.test.ts`

**Interfaces:**
- Consumes: `TourAction`, `TourStep`, `TOUR_TARGET_IDS`, `stepsForPlatform`, `targetFor`
- Produces:
  - `useSettingsMenuStore` with `{ open: boolean; setOpen(open: boolean): void }`
  - `DEFAULT_VIEW = { latitude: 52.1209259, longitude: 5.6869246, zoom: 9.5 }`
  - actions: `openSection(id)`, `sheetSnap(snap)`, `openHintBoard()`, `openSettings()`, `flyToOverview()`
  - `TOUR_VERSION = 1`, `TOUR_STEPS: TourStep[]`

- [ ] **Step 1: Settings menu store and map view constant**

`src/stores/settings-menu.store.ts`:

```ts
import { create } from 'zustand';

interface SettingsMenuState {
  /** Whether the settings dropdown (sidebar header cog) is open; controlled so the tour can open it */
  open: boolean;
  setOpen: (open: boolean) => void;
}

const useSettingsMenuStore = create<SettingsMenuState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export default useSettingsMenuStore;
```

`src/lib/map-view.ts`:

```ts
/** The map's start view: the whole Jotihunt play area. */
export const DEFAULT_VIEW = {
  latitude: 52.1209259,
  longitude: 5.6869246,
  zoom: 9.5,
};
```

In `src/components/Map.tsx`, delete the `initialViewState` constant (lines 39-43), add `import {DEFAULT_VIEW} from '@/lib/map-view';` and change `initialViewState={initialViewState}` to `initialViewState={DEFAULT_VIEW}`.

- [ ] **Step 2: Actions**

`src/components/tour/actions.ts`:

```ts
import useSidebarStore, { SheetSnap, SidebarSectionId } from '@/stores/sidebar.store';
import useHintBoardStore from '@/stores/hint-board.store';
import useSettingsMenuStore from '@/stores/settings-menu.store';
import { DEFAULT_VIEW } from '@/lib/map-view';
import type { TourAction } from './types';

/**
 * Everything the tour can do to the UI. Steps only use these, so when the layout changes
 * the fix is here, once. Each action returns an undo when it has something to revert.
 * Actions never change server data.
 */

/** Expand a sidebar section; the undo restores its previous open state. */
export function openSection(id: SidebarSectionId): TourAction {
  return {
    name: `openSection(${id})`,
    run: () => {
      const store = useSidebarStore.getState();
      const wasOpen = store.openSections[id];
      store.setSectionOpen(id, true);
      return () => useSidebarStore.getState().setSectionOpen(id, wasOpen);
    },
  };
}

/**
 * Move the phone bottom sheet (no-op on desktop). No undo, so consecutive steps don't make it bounce;
 * the overlay restores the sheet when the tour ends.
 */
export function sheetSnap(snap: SheetSnap): TourAction {
  return {
    name: `sheetSnap(${snap})`,
    run: (ctx) => {
      if (ctx.isMobile) useSidebarStore.getState().setSheetSnap(snap);
    },
  };
}

export function openHintBoard(): TourAction {
  return {
    name: 'openHintBoard',
    run: () => {
      useHintBoardStore.getState().openBoard();
      return () => useHintBoardStore.getState().close();
    },
  };
}

export function openSettings(): TourAction {
  return {
    name: 'openSettings',
    run: () => {
      useSettingsMenuStore.getState().setOpen(true);
      return () => useSettingsMenuStore.getState().setOpen(false);
    },
  };
}

/** Fly the map to the whole play area. */
export function flyToOverview(): TourAction {
  return {
    name: 'flyToOverview',
    run: (ctx) => {
      ctx.mapRef.current?.flyTo({ center: [DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude], zoom: DEFAULT_VIEW.zoom, duration: 1500 });
    },
  };
}
```

- [ ] **Step 3: Write the failing steps test**

`src/components/tour/steps.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { TOUR_STEPS, TOUR_VERSION } from './steps';
import { TOUR_TARGET_IDS } from './targets';
import { stepsForPlatform, targetFor } from './resolve';

describe('TOUR_STEPS', () => {
  test('TOUR_VERSION is at least 1', () => {
    expect(TOUR_VERSION).toBeGreaterThanOrEqual(1);
  });

  test('step ids are unique', () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every step has a title and body', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim()).not.toBe('');
      expect(step.body.trim()).not.toBe('');
    }
  });

  test('every target is a known target id', () => {
    const known = new Set<string>(TOUR_TARGET_IDS);
    for (const platform of ['mobile', 'desktop'] as const) {
      for (const step of TOUR_STEPS) {
        const target = targetFor(step, platform);
        if (target !== null) expect(known.has(target)).toBe(true);
      }
    }
  });

  test('every action has a name', () => {
    for (const step of TOUR_STEPS) {
      for (const action of step.actions ?? []) expect(action.name).toBeTruthy();
    }
  });

  test('each platform gets a real tour that starts and ends with a centered card', () => {
    for (const platform of ['mobile', 'desktop'] as const) {
      const steps = stepsForPlatform(TOUR_STEPS, platform);
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(targetFor(steps[0], platform)).toBeNull();
      expect(targetFor(steps[steps.length - 1], platform)).toBeNull();
    }
  });

  test('first and last steps are not optional', () => {
    expect(TOUR_STEPS[0].optional).toBeFalsy();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].optional).toBeFalsy();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx --yes bun test src/components/tour/steps.test.ts`
Expected: FAIL. Module `./steps` not found.

- [ ] **Step 5: Write the steps**

`src/components/tour/steps.ts`:

```ts
import { flyToOverview, openHintBoard, openSection, openSettings, sheetSnap } from './actions';
import type { TourStep } from './types';

/**
 * Bump to show the tour again to every user once (e.g. after a big layout change).
 * Users whose stored tutorialVersion is lower get the tour automatically on their next visit.
 */
export const TOUR_VERSION = 1;

/**
 * The onboarding tour, in order. To add a step: add its target id to targets.ts, put {...tourTarget(id)}
 * on the element, and add an entry here. New UI interactions go in actions.ts.
 * On phones every sidebar step first pulls the sheet up so the section is visible.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welkom bij de Jotihunt Tracker!',
    body: 'In een paar stappen laten we zien hoe de app werkt. De rondleiding loopt vanzelf door; met de knoppen ga je sneller of terug.',
  },
  {
    id: 'map',
    target: 'map',
    title: 'De kaart',
    body: 'Hier zie je de deelnemende groepen, de vossen per deelgebied en waar onze hunters rijden. Tik of klik op de kaart om de coördinaten van die plek te zien.',
    actions: [sheetSnap('peek'), flyToOverview()],
  },
  {
    id: 'sidebar',
    target: 'sidebar.root',
    title: 'Het zijpaneel',
    body: 'Alles wat je nodig hebt staat in dit paneel. Elke kaart klapt open en dicht. Op je telefoon schuif je het paneel omhoog en omlaag.',
    actions: [sheetSnap('half')],
  },
  {
    id: 'foxes',
    target: 'sidebar.foxes',
    title: 'Vossen',
    body: 'De status van elk deelgebied: rood, oranje of groen. Tik op een letter om dat gebied op de kaart te verbergen of weer te tonen.',
    actions: [sheetSnap('full'), openSection('foxes')],
  },
  {
    id: 'hunts',
    target: 'sidebar.hunts',
    title: 'Hunts',
    body: 'Maak een foto van een hunt om hem te registreren. Hier zie je de laatste hunts en hun status.',
    actions: [sheetSnap('full'), openSection('hunts')],
  },
  {
    id: 'hints',
    target: 'sidebar.hints',
    title: 'Hints',
    body: 'De laatste hints per deelgebied in één oogopslag: groen is opgelost, oranje wordt aan gewerkt en grijs staat nog open.',
    actions: [sheetSnap('full'), openSection('hints')],
  },
  {
    id: 'hint-board',
    target: 'hintBoard.dialog',
    title: 'Het hintbord',
    body: 'Alle hints van de hele dag. Open een vakje om de hint te bekijken en de oplossing in te vullen.',
    actions: [openHintBoard()],
  },
  {
    id: 'hint-entry',
    target: 'sidebar.hintEntry',
    title: 'Hint registreren',
    body: 'Vul hier de oplossing van een hint in; de locatie verschijnt dan op de kaart.',
    actions: [sheetSnap('full'), openSection('hintEntry')],
  },
  {
    id: 'predictions',
    target: 'sidebar.predictions',
    title: 'Voorspelling',
    body: 'Een AI-voorspelling van waar de vossen waarschijnlijk zijn. Tik op een voorspelling om ernaartoe te gaan op de kaart.',
    actions: [sheetSnap('full'), openSection('predictions')],
    optional: true,
  },
  {
    id: 'counter-hunt',
    target: 'sidebar.counterHunt',
    title: 'Tegenhunt',
    body: 'Hulpmiddelen voor de tegenhunt: houd in de gaten wie er in de buurt van ons clubhuis komt.',
    actions: [sheetSnap('full'), openSection('counterHunt')],
    optional: true,
  },
  {
    id: 'tracker',
    target: 'sidebar.tracking',
    title: 'Mijn tracker',
    body: 'Koppel je telefoon als GPS-tracker, zodat iedereen ziet waar je rijdt. De uitleg staat achter de knop in deze kaart.',
    actions: [sheetSnap('full'), openSection('tracking')],
  },
  {
    id: 'hunters',
    target: 'sidebar.hunters',
    title: 'Actieve hunters',
    body: 'Wie er nu onderweg is. Tik op een hunter om naar die plek op de kaart te gaan.',
    actions: [sheetSnap('full'), openSection('hunters')],
  },
  {
    id: 'hunt-capture',
    target: 'huntCapture.button',
    title: 'Snel een hunt vastleggen',
    body: 'Met deze cameraknop maak je meteen een foto van een hunt, waar je ook bent in de app.',
    actions: [sheetSnap('peek')],
    only: 'mobile',
  },
  {
    id: 'map-tools',
    target: 'cards.topRight',
    title: 'Coördinaten en zoeken',
    body: 'Plak hier coördinaten om ze op de kaart te zien, of zoek een groep op naam.',
    only: 'desktop',
  },
  {
    id: 'settings',
    target: 'settings.replayItem',
    title: 'Instellingen',
    body: 'Kaartstijl, donkere modus, zichtbare lagen en meer. Hier kun je deze rondleiding ook altijd opnieuw bekijken.',
    actions: [sheetSnap('peek'), openSettings()],
  },
  {
    id: 'done',
    target: null,
    title: 'Klaar!',
    body: 'Je bent er klaar voor. Veel succes met hunten!',
  },
];
```

Before committing, check each body against the component it describes:
- `FoxPills`: does tapping a letter hide the area?
- `HintEntryCard`: what does it do?
- `CounterHuntCard`: what does it do?
- `PredictionList`: does tapping fly the map?
- `ActiveDevices`: does tapping fly the map?

If a sentence is inaccurate, fix the Dutch sentence. Don't change the structure.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx --yes bun test src/components/tour`
Expected: all pass. (A zustand `persist` warning about missing `localStorage` under bun is harmless.)

- [ ] **Step 7: Commit**

```bash
git add src/stores/settings-menu.store.ts src/lib/map-view.ts src/components/Map.tsx src/components/tour/actions.ts src/components/tour/steps.ts src/components/tour/steps.test.ts
git commit -m "feat(tour): tour actions and v1 steps"
```

---

### Task 6: Client: target attributes and close guards on existing components

**Files:**
- Modify: `src/types/User.ts`
- Modify: `src/components/Map.tsx:127` (the wrapper `div`)
- Modify: `src/components/sidebar/SidebarSection.tsx:25`
- Modify: `src/components/sidebar/Sidebar.tsx:23`
- Modify: `src/components/sidebar/MobileSheet.tsx:41-44`
- Modify: `src/components/hints/HintBoardDialog.tsx`
- Modify: `src/components/hunts/HuntCaptureButton.tsx:13`
- Modify: `src/pages/App.tsx:17`
- Modify: `src/components/Settings.tsx`

**Interfaces:**
- Consumes: `tourTarget`, `useTourStore`, `useSettingsMenuStore`
- Produces: DOM elements with `data-tour` for every id in `TOUR_TARGET_IDS`; `User.tutorialVersion?: number`; `Settings` accepts an `onReplayTour` callback prop (wired in Task 8)

- [ ] **Step 1: User type**

In `src/types/User.ts`, add after `requiresPasswordChange: boolean;`:

```ts
  /** Highest onboarding tour version seen; missing on sessions from before the tour existed (treat as 0) */
  tutorialVersion?: number;
```

- [ ] **Step 2: Target attributes**

Import `{ tourTarget } from '@/components/tour/targets'` in each file below and spread the attribute onto the element:

- `Map.tsx`: `<div className="w-dvw h-dvh" {...tourTarget('map')}>`
- `SidebarSection.tsx`: `<Collapsible {...tourTarget(`sidebar.${id}`)} open={open} …>`. Every section, including Hunts and Tracker, gets its target this way.
- `Sidebar.tsx` (desktop): `<div className="pointer-events-auto flex flex-col gap-1.5 pb-2" {...tourTarget('sidebar.root')}>`
- `MobileSheet.tsx`: add `{...tourTarget('sidebar.root')}` to `<Drawer.Content …>`
- `HuntCaptureButton.tsx`: add `{...tourTarget('huntCapture.button')}` to the `<Button …>`
- `App.tsx`: `<div className="absolute right-12 top-2 z-30 hidden gap-2 md:flex" {...tourTarget('cards.topRight')}>`
- `HintBoardDialog.tsx`: add `{...tourTarget('hintBoard.dialog')}` to both the mobile `<Drawer.Content …>` and the desktop `<DialogContent …>`.

- [ ] **Step 3: Hint board close guard**

In `HintBoardDialog.tsx`, import `useTourStore from '@/components/tour/tour.store'` and add inside the component:

```ts
  // While the tour shows the board, clicks on the tour card count as "outside"; the tour closes it itself
  function handleOpenChange(next: boolean) {
    if (!next && !useTourStore.getState().active) close();
  }
```

Replace both `onOpenChange={(next) => !next && close()}` with `onOpenChange={handleOpenChange}`.

- [ ] **Step 4: Settings: controlled menu, close guard, replay item**

In `src/components/Settings.tsx`:

1. Change the signature to `export default function Settings({ onReplayTour }: { onReplayTour?: () => void })`.
2. Add imports: `CompassIcon` from `lucide-react`, `useSettingsMenuStore from '@/stores/settings-menu.store'`, `useTourStore from '@/components/tour/tour.store'`, `{ tourTarget } from '@/components/tour/targets'`.
3. Inside the component:

```ts
    const menuOpen = useSettingsMenuStore((state) => state.open);
    const setMenuOpen = useSettingsMenuStore((state) => state.setOpen);

    // While the tour shows this menu, clicks on the tour card count as "outside"; the tour closes it itself
    function handleMenuOpenChange(open: boolean) {
        if (!open && useTourStore.getState().active) return;
        setMenuOpen(open);
    }
```

4. `<DropdownMenu modal={false}>` becomes `<DropdownMenu modal={false} open={menuOpen} onOpenChange={handleMenuOpenChange}>`.
5. Directly after the `Hint board` item (line ~253), add:

```tsx
                    {onReplayTour && (
                        <DropdownMenuItem {...tourTarget('settings.replayItem')} onClick={() => {
                            setMenuOpen(false);
                            onReplayTour();
                        }}>
                            <CompassIcon/>
                            Rondleiding opnieuw
                        </DropdownMenuItem>
                    )}
```

The replay item needs the tour hook, which comes in Task 8. Until then it doesn't render, because `onReplayTour` is undefined.

- [ ] **Step 5: Type check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/User.ts src/components/Map.tsx src/components/sidebar/SidebarSection.tsx src/components/sidebar/Sidebar.tsx src/components/sidebar/MobileSheet.tsx src/components/hints/HintBoardDialog.tsx src/components/hunts/HuntCaptureButton.tsx src/pages/App.tsx src/components/Settings.tsx
git commit -m "feat(tour): mark tour targets and let the tour hold open the hint board and settings menu"
```

---

### Task 7: Client: target tracking, card and overlay

**Files:**
- Create: `src/components/tour/useTargetRect.ts`
- Create: `src/components/tour/TourCard.tsx`
- Create: `src/components/tour/TourOverlay.tsx`
- Modify: `src/index.css` (append keyframes)

**Interfaces:**
- Consumes: `useTourStore`, `TOUR_STEPS`, `stepsForPlatform`, `targetFor`, `runActions`, `runUndos`, `placeCard`, `stepDuration`, `tourSelector`, `useIsMobile`, `useSidebarStore`
- Produces:
  - `useTargetRect(id: TourTargetId | null, enabled: boolean, resetKey: unknown): { status: 'pending' | 'found' | 'missing' | 'none'; rect: Rect | null; key: unknown }`. `key` is the `resetKey` the status belongs to, so callers can ignore a stale status from the previous step.
  - `<TourOverlay mapRef={mapRef} />`, mounted in Task 8

- [ ] **Step 1: Progress keyframes**

Append to `src/index.css`:

```css
/* Onboarding tour: the progress bar doubles as the auto-advance timer (animationend = next step) */
@keyframes tour-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
```

- [ ] **Step 2: `useTargetRect`**

`src/components/tour/useTargetRect.ts`:

```ts
import { useEffect, useState } from 'react';
import type { Rect } from './placement';
import { tourSelector, type TourTargetId } from './targets';

const FIND_TIMEOUT_MS = 1500;

type Status = 'pending' | 'found' | 'missing' | 'none';

function sameRect(a: Rect | null, b: Rect) {
  return !!a && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Find the element for a tour target and follow its position every frame (sections expand, the sheet slides,
 * the window resizes). Waits up to 1.5s for the element to appear; then reports 'missing'.
 * `enabled` is false until the step's actions have run; `resetKey` restarts the search for a new step.
 */
export function useTargetRect(id: TourTargetId | null, enabled: boolean, resetKey: unknown) {
  const [state, setState] = useState<{ status: Status; rect: Rect | null; key: unknown }>({ status: 'pending', rect: null, key: resetKey });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'pending', rect: null, key: resetKey });
      return;
    }
    if (id === null) {
      setState({ status: 'none', rect: null, key: resetKey });
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    let element: Element | null = null;

    function tick() {
      if (!element) {
        element = document.querySelector(tourSelector(id!));
        if (element) {
          element.scrollIntoView({ block: 'nearest' });
        } else if (performance.now() - startedAt > FIND_TIMEOUT_MS) {
          console.warn(`[tour] target not found: ${id}`);
          setState({ status: 'missing', rect: null, key: resetKey });
          return;
        }
      }
      if (element) {
        const { x, y, width, height } = element.getBoundingClientRect();
        const rect = { x, y, width, height };
        setState((prev) =>
          prev.status === 'found' && prev.key === resetKey && sameRect(prev.rect, rect) ? prev : { status: 'found', rect, key: resetKey },
        );
      }
      frame = requestAnimationFrame(tick);
    }

    setState({ status: 'pending', rect: null, key: resetKey });
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [id, enabled, resetKey]);

  return state;
}
```

- [ ] **Step 3: `TourCard`**

`src/components/tour/TourCard.tsx`:

```tsx
import { forwardRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TourCardProps {
  title: string;
  body: string;
  stepIndex: number;
  stepCount: number;
  /** Auto-advance time; undefined = no progress bar (last step, or still loading) */
  durationMs?: number;
  paused: boolean;
  position: { x: number; y: number };
  onPrev: () => void;
  onNext: () => void;
  onTogglePause: () => void;
  onSkip: () => void;
  /** Fired when the progress bar is full */
  onTimeUp: () => void;
}

/** The floating tour card. It glides to `position`; its progress bar is the auto-advance timer. */
const TourCard = forwardRef<HTMLDivElement, TourCardProps>(function TourCard(props, ref) {
  const { title, body, stepIndex, stepCount, durationMs, paused, position, onPrev, onNext, onTogglePause, onSkip, onTimeUp } = props;
  const [hovered, setHovered] = useState(false);
  const isLast = stepIndex === stepCount - 1;

  return (
    <Card
      ref={ref}
      role="dialog"
      aria-live="polite"
      aria-label={title}
      className="pointer-events-auto fixed left-0 top-0 z-[70] w-[min(340px,calc(100vw-24px))] gap-3 overflow-hidden py-4 shadow-2xl transition-transform duration-[350ms] ease-out motion-reduce:transition-none"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-muted">
        {durationMs !== undefined && (
          <div
            // Remount per step so the animation restarts
            key={stepIndex}
            className="h-full origin-left bg-primary"
            style={{
              animation: `tour-progress ${durationMs}ms linear forwards`,
              animationPlayState: paused || hovered ? 'paused' : 'running',
            }}
            onAnimationEnd={onTimeUp}
          />
        )}
      </div>
      <div className="flex flex-col gap-1 px-4">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="flex items-center gap-1 px-4">
        <span className="mr-auto text-xs text-muted-foreground tabular-nums">
          {stepIndex + 1}/{stepCount}
        </span>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Overslaan
        </Button>
        <Button variant="outline" size="icon" aria-label={paused ? 'Verder' : 'Pauzeren'} onClick={onTogglePause} disabled={durationMs === undefined}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </Button>
        <Button variant="outline" size="icon" aria-label="Vorige" onClick={onPrev} disabled={stepIndex === 0}>
          <ChevronLeftIcon />
        </Button>
        <Button size="sm" onClick={onNext} className={cn(isLast && 'px-4')}>
          {isLast ? 'Klaar' : 'Volgende'}
          {!isLast && <ChevronRightIcon data-icon="inline-end" />}
        </Button>
      </div>
    </Card>
  );
});

export default TourCard;
```

(`Card` in `src/components/ui/card.tsx` is a plain function component that spreads props onto a `div`. In React 19 `ref` is passed through props, so `ref={ref}` works. If `Card` drops `ref`, wrap it in a `<div ref={ref}>` carrying the positioning classes and style.)

- [ ] **Step 4: `TourOverlay`**

`src/components/tour/TourOverlay.tsx`:

```tsx
import { RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MapRef } from '@/components/Map';
import { useIsMobile } from '@/hooks/media.hook';
import useSidebarStore from '@/stores/sidebar.store';
import { stepDuration } from './duration';
import { placeCard, type Size } from './placement';
import { stepsForPlatform, targetFor } from './resolve';
import { runActions, runUndos } from './runner';
import { TOUR_STEPS } from './steps';
import TourCard from './TourCard';
import useTourStore from './tour.store';
import type { Undo } from './types';
import { useTargetRect } from './useTargetRect';

const SPOTLIGHT_PADDING = 8;

/**
 * Runs the onboarding tour: performs each step's actions, finds its target, dims everything except the target,
 * and floats the card next to it. Mounted once in Layout; renders nothing while the tour is inactive.
 */
export default function TourOverlay({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { active, stepIndex, stepCount, direction, paused, next, prev, togglePause, skip, stop } = useTourStore();
  const isMobile = useIsMobile();
  const platform = isMobile ? 'mobile' : 'desktop';
  const steps = stepsForPlatform(TOUR_STEPS, platform);
  const step = active ? steps[stepIndex] : undefined;
  const targetId = step ? targetFor(step, platform) : null;

  // Index of the step whose actions have finished; compared per step so a stale "done" never leaks into the next one
  const [actionsDoneFor, setActionsDoneFor] = useState<number | null>(null);
  const actionsDone = active && actionsDoneFor === stepIndex;
  const target = useTargetRect(targetId, actionsDone, stepIndex);
  // The hook's state lags one render behind a step change; treat a status from another step as still pending
  const targetStatus = target.key === stepIndex ? target.status : 'pending';

  // Run the step's actions; undo them when leaving the step (next, prev, skip, finish, unmount)
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let undos: Undo[] = [];
    void runActions(step.actions ?? [], { mapRef, isMobile }).then((result) => {
      if (cancelled) runUndos(result);
      else {
        undos = result;
        setActionsDoneFor(stepIndex);
      }
    });
    return () => {
      cancelled = true;
      runUndos(undos);
    };
    // Re-run per step only; isMobile changes mid-tour are rare and handled by the next step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  // Snapshot the sidebar when the tour starts, restore it when it ends
  useEffect(() => {
    if (!active) return;
    const { openSections, sheetSnap } = useSidebarStore.getState();
    return () => useSidebarStore.setState({ openSections, sheetSnap });
  }, [active]);

  // Leaving the layout (logout, expired session) ends the tour without marking it as seen
  useEffect(() => () => stop(), [stop]);

  // Optional step whose feature is off: skip it in the direction the user was going
  useEffect(() => {
    if (step?.optional && targetStatus === 'missing') {
      if (direction === 1) next();
      else if (stepIndex > 0) prev();
      else next();
    }
  }, [step, targetStatus, direction, stepIndex, next, prev]);

  // Keyboard: → next, ← previous, Esc skip. Capture phase so menus and dialogs don't act on these keys.
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      const action = { ArrowRight: next, ArrowLeft: prev, Escape: skip }[event.key];
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      action();
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, next, prev, skip]);

  // Measure the card and viewport for placement
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<Size>({ width: 340, height: 180 });
  const [viewport, setViewport] = useState<Size>(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el && (el.offsetWidth !== cardSize.width || el.offsetHeight !== cardSize.height)) {
      setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    }
  });
  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!step) return null;

  const rect = targetStatus === 'found' ? target.rect : null;
  const ready = actionsDone && targetStatus !== 'pending';
  const isLast = stepIndex === stepCount - 1;
  const position = placeCard({ target: rect, card: cardSize, viewport, placement: step.placement, isMobile });

  // No target: a zero-size hole in the middle, so the whole screen is dimmed
  const hole = rect
    ? {
        top: rect.y - SPOTLIGHT_PADDING,
        left: rect.x - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      }
    : { top: viewport.height / 2, left: viewport.width / 2, width: 0, height: 0 };

  return createPortal(
    // pointer-events-auto: Radix modals set pointer-events:none on <body> while open
    <div className="pointer-events-auto fixed inset-0 z-[60]">
      {/* Click shield: the tour drives the UI, the user only uses the card */}
      <div className="absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-xl shadow-[0_0_0_9999px_rgb(0_0_0/0.6)] transition-all duration-[350ms] ease-out motion-reduce:transition-none"
        style={hole}
      />
      <TourCard
        ref={cardRef}
        title={step.title}
        body={step.body}
        stepIndex={stepIndex}
        stepCount={stepCount}
        durationMs={ready && !isLast ? stepDuration(step) : undefined}
        paused={paused}
        position={position}
        onPrev={prev}
        onNext={next}
        onTogglePause={togglePause}
        onSkip={skip}
        onTimeUp={next}
      />
    </div>,
    document.body,
  );
}
```

- [ ] **Step 5: Type check, lint, tests**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: no errors, all tests pass. If lint flags `react-hooks/set-state-in-effect` for the `setState` resets in `useTargetRect`, keep the code and add a targeted `// eslint-disable-next-line` with a one-line reason. These are intentional resets per step.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/components/tour/useTargetRect.ts src/components/tour/TourCard.tsx src/components/tour/TourOverlay.tsx
git commit -m "feat(tour): spotlight overlay and floating card"
```

---

### Task 8: Client: auto start, completion, replay, PWA prompt hold

**Files:**
- Create: `src/components/tour/useTour.ts`
- Modify: `src/Layout.tsx`
- Modify: `src/components/sidebar/SidebarHeader.tsx:18`

**Interfaces:**
- Consumes: `useTourStore`, `TOUR_VERSION`, `TOUR_STEPS`, `stepsForPlatform`, `useAuth().updateUserState`, `useFetcher().fetch`, `useAuthUser<User>()`, `useHintBoardStore`, `useAdminStore`, `Settings({ onReplayTour })`
- Produces:
  - `useStartTour(): (mode: TourMode) => void`
  - `useTourAutoStart(): { pending: boolean }`: `pending` is true while the tour is due or running, and holds back the PWA prompt.

- [ ] **Step 1: `useTour.ts`**

`src/components/tour/useTour.ts`:

```ts
import { useEffect } from 'react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { useAuth } from '@/hooks/auth.hook';
import { useFetcher } from '@/hooks/utils/api.hook';
import { useIsMobile } from '@/hooks/media.hook';
import useHintBoardStore from '@/stores/hint-board.store';
import useAdminStore from '@/stores/admin.store';
import type { User } from '@/types/User';
import { stepsForPlatform } from './resolve';
import { TOUR_STEPS, TOUR_VERSION } from './steps';
import useTourStore, { type TourMode } from './tour.store';

/** Give the map and sidebar a moment to render before the first step. */
const AUTO_START_DELAY_MS = 1000;

/** Start the tour. 'auto' reports completion (finish or skip) to the server; 'replay' does not. */
export function useStartTour() {
  const isMobile = useIsMobile();
  const authUser = useAuthUser<User>();
  const { updateUserState } = useAuth();
  const { fetch } = useFetcher();

  async function markSeen() {
    // Local state first, so the auto start does not fire again while the request is in flight
    if (authUser) updateUserState({ ...authUser, tutorialVersion: TOUR_VERSION });
    try {
      await fetch('/auth/tutorial', 'POST', { version: TOUR_VERSION });
    } catch (error) {
      // Worst case the tour shows once more on the next login
      console.warn('[tour] could not save tour version', error);
    }
  }

  return (mode: TourMode) => {
    const stepCount = stepsForPlatform(TOUR_STEPS, isMobile ? 'mobile' : 'desktop').length;
    useTourStore.getState().start({ mode, stepCount, onEnd: mode === 'auto' ? () => void markSeen() : undefined });
  };
}

/** Start the tour automatically for users who have not seen this TOUR_VERSION yet, after the forced password change. */
export function useTourAutoStart() {
  const authUser = useAuthUser<User>();
  const active = useTourStore((state) => state.active);
  const hintBoardOpen = useHintBoardStore((state) => state.view !== null);
  const adminDialogOpen = useAdminStore((state) => state.dialog !== null);
  const startTour = useStartTour();

  const due = !!authUser && (authUser.tutorialVersion ?? 0) < TOUR_VERSION;
  const canStart = !!authUser && due && !authUser.requiresPasswordChange && !active && !hintBoardOpen && !adminDialogOpen;

  useEffect(() => {
    if (!canStart) return;
    const timeout = setTimeout(() => startTour('auto'), AUTO_START_DELAY_MS);
    return () => clearTimeout(timeout);
    // startTour is a new function every render; the conditions above are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canStart]);

  return { pending: due || active };
}
```

- [ ] **Step 2: Mount in `Layout.tsx`**

In `src/Layout.tsx`:
- Add imports: `TourOverlay from './components/tour/TourOverlay'` and `{ useTourAutoStart } from './components/tour/useTour'`.
- After `useTheme();`, add `const tour = useTourAutoStart();`.
- After `<UsersDialog/>`, add `<TourOverlay mapRef={mapRef}/>`.
- Wrap the `<PWAPrompt … />` element: `{!tour.pending && (<PWAPrompt … />)}`, with a comment above: `{/* Held back until the onboarding tour is done so they don't overlap */}`.

- [ ] **Step 3: Replay from Settings**

In `src/components/sidebar/SidebarHeader.tsx`, import `{ useStartTour } from '@/components/tour/useTour'`, add `const startTour = useStartTour();` inside the component, and change `<Settings />` to `<Settings onReplayTour={() => startTour('replay')} />`.

- [ ] **Step 4: Type check, lint, tests**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: no errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/tour/useTour.ts src/Layout.tsx src/components/sidebar/SidebarHeader.tsx
git commit -m "feat(tour): auto-start on first login, save completion, replay from settings"
```

---

### Task 9: Manual smoke test (mobile and desktop)

**Files:** none (fix bugs found in the files they belong to, then commit them)

Follow the dev-environment rules:
- Don't touch the docker stack.
- Run the server locally on another port against a throwaway DB, for example `MONGO_URI=mongodb://localhost:27017/jotihunt-tour-smoke PORT=3100 JOTIHUNT_API_URL=http://127.0.0.1:9`.
- Point the client dev server at it (`API_BASE_URL=http://localhost:3100`).
- Create a user with `src/scripts/create-user.ts`.
- Use the t3 preview browser, and `preview_evaluate` for DOM checks.

- [ ] **Step 1: Fresh user, desktop (1280×800)**
  1. Log in. The password dialog shows first. Change the password.
  2. About 1s later the tour starts at "Welkom". Let it auto-run to "Klaar" without touching anything. Check:
     - the card glides between targets
     - the spotlight follows each section as it expands
     - the hint board opens on step 7 and closes on the next step
     - the settings menu opens on "Instellingen" with the "Rondleiding opnieuw" item highlighted
     - the Voorspelling and Tegenhunt steps are skipped if those features are off
  - "Mijn tracker": `TrackerSection` has its own forced open state, so `openSection('tracking')` may not expand it. The spotlight must still land on the section. If it stays collapsed and that looks bad, note it for the user rather than changing `TrackerSection` logic.
  3. Click "Klaar". Check that the sidebar sections are back to how they were and that `POST /auth/tutorial` returned 200.
- [ ] **Step 2: No repeat.** Reload, then log out and in again. No tour. In Mongo, `tutorialVersion` is `1`.
- [ ] **Step 3: Controls.**
  1. Replay from Settings.
  2. Check that Volgende, Vorige, ←, → and Pause work, and that hovering the card freezes the progress bar.
  3. Esc closes the tour.
  4. Check that the network tab shows no `/auth/tutorial` call during the replay.
- [ ] **Step 4: Skip marks seen.** Set the user's `tutorialVersion` to 0 in Mongo and log in again. Click Overslaan at step 3. Log in again: no tour.
- [ ] **Step 5: Mobile (390×844).** Replay. Check that:
  - the sheet goes to half, then full for the sections
  - the card docks at the top or bottom, away from the target
  - the hint board drawer is highlighted
  - the camera button step shows with the sheet at peek
  - the settings menu opens at the end
  - the sheet goes back to peek after "Klaar"
- [ ] **Step 6: Missing target.** Temporarily remove `{...tourTarget('cards.topRight')}` in `App.tsx`. Replay on desktop. On that step the card centers with no hole, and the console shows `[tour] target not found: cards.topRight`. Restore the attribute.
- [ ] **Step 7: Bump version.** Temporarily set `TOUR_VERSION = 2`. Reload. The tour auto-starts again. Revert to `1`.
- [ ] **Step 8: Commit fixes (if any)**

```bash
git add <files changed>
git commit -m "fix(tour): <what was fixed>"
```

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Server `tutorialVersion`, login response, `POST /auth/tutorial`, never lowers | 1 |
| Typed target ids and the `tourTarget` helper | 2, 6 |
| Step shape with platform targets, `only`, `since`, `placement`, `durationMs` | 2 |
| Duration formula | 2 |
| Named reversible actions and undo stack | 3, 5 |
| Store: start/next/prev/pause/skip/finish, auto vs replay | 4 |
| v1 step list (15 steps, mobile and desktop variants) | 5 |
| Settings dropdown controlled plus "Rondleiding opnieuw" | 5, 6, 8 |
| Spotlight, click blocking, card glide, reduced motion | 7 |
| Auto-advance, progress bar, pause, hover pause, no auto-finish on the last step | 7 |
| Keyboard ← → Esc | 7 |
| Missing target: centered card and a warning | 7 |
| Sidebar snapshot restore | 7 |
| Logout mid-tour resets | 7 (unmount calls `stop`) |
| Auto start after the password change, waits for other dialogs | 8 |
| Completion persists; a failed request still closes the tour | 8 |
| Replay never calls the server | 8 |
| PWA prompt held back during the tour | 8 |
| Tests: steps integrity, store, undo order, duration, server | 1–5 |
| Manual smoke test on mobile and desktop | 9 |
