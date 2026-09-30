# Onboarding Tour — Design

Date: 2026-09-30
Status: approved; plan in `docs/superpowers/plans/2026-09-30-onboarding-tour.md` (see its "Deviations from spec" section: box-shadow spotlight, rAF target tracking, `optional` steps, `flyTo` default view, `sheetSnap` without undo)
Repos: `jotihunt-tracker-client` (tour engine, steps, UI), `jotihunt-tracker-server` (user field + endpoint)

## Goal

When a user logs in for the first time they get a guided tour of the app. A floating card glides
between parts of the UI, highlights them with a spotlight, and drives the real UI (opens sidebar
sections, the hint board, the settings menu, moves the map) so the user sees the full app. The card
has Previous / Next buttons and auto-advances. The tour can be replayed from the settings menu.

The layout and features will change over time, so the main design goal is that steps are cheap to
add, remove, reorder and repair.

## Scope

In scope: tour engine, spotlight overlay, floating card, v1 step list (core map + sidebar, hints
flow, hunting tools), server-side "seen" tracking via a version number, replay from Settings.

Out of scope: admin-only steps, steps that create/edit/delete data or show fake demo data,
"what's new" filtering by `since` (field exists, filtering not built), new dependencies (no
driver.js / react-joyride / framer-motion).

## Decisions

- **Seen tracking:** server-side, per account (works across devices).
- **Actions:** visual only. The tour opens/closes UI and moves the map; it never mutates data.
- **Auto-advance:** per-step timer with progress bar; Next/Prev resets the timer; Pause/Play
  button; hover/touch on the card pauses.
- **Skip:** "Overslaan" closes the tour and marks it as seen. Replay stays available in Settings.
- **Existing users:** see the tour once too (everyone starts at version 0).
- **Engine:** custom (React + zustand + CSS transitions), no library.

## Server

- `src/models/user.model.ts`: add `tutorialVersion: { type: Number, default: 0 }`.
- `auth.controller.ts` login response: include `tutorialVersion` in the user object (next to
  `requiresPasswordChange`).
- New route `POST /auth/tutorial` with `[verifyToken, validate(tutorialValidator)]`, body
  `{ version: number }` (integer ≥ 0). Sets `user.tutorialVersion = max(current, version)`.
  Idempotent. Returns `{ tutorialVersion }`.

## Client: file layout

All tour code in `src/components/tour/`:

| File | Purpose |
|---|---|
| `targets.ts` | `TourTargetId` string-literal union of all target ids + `tourTarget(id)` helper returning `{ 'data-tour': id }` |
| `actions.ts` | Library of named, typed, reversible actions |
| `steps.ts` | `TOUR_VERSION` and the `TOUR_STEPS` array — the only file edited to change tour content |
| `types.ts` | `TourStep`, `TourAction`, `TourContext` |
| `tour.store.ts` | zustand store (not persisted): `active`, `stepIndex`, `paused`, `start()`, `next()`, `prev()`, `pause()`, `resume()`, `skip()`, `finish()` |
| `useTourRunner.ts` | Runs a step's actions, keeps an undo stack, handles the timer |
| `useTargetRect.ts` | Resolves a target id to a live `DOMRect` |
| `TourOverlay.tsx` | Portal: SVG spotlight mask + `TourCard`; mounted once in `Layout.tsx` |
| `TourCard.tsx` | The floating card (shadcn `Card`) |
| `duration.ts` | Step duration formula |
| `*.test.ts` | Tests (see Testing) |

### Targets

Components mark themselves with `<div {...tourTarget('sidebar.hints')}>`. All ids live in the
`TourTargetId` union in `targets.ts`, so a typo in a step or component fails to compile. When a
component moves, its attribute moves with it and the step keeps working.

Initial ids: `map`, `sidebar.root`, `sidebar.foxes`, `sidebar.hunts`, `sidebar.hints`,
`sidebar.hintEntry`, `sidebar.predictions`, `sidebar.counterHunt`, `sidebar.tracking`,
`sidebar.hunters`, `hintBoard.dialog`, `huntCapture.button`, `cards.topRight`,
`settings.replayItem`.

On mobile the sidebar sections are rendered inside `MobileSheet`; the same section components carry
the same ids, so one id serves both platforms where the element is shared.

### Actions

Each action is a factory returning `TourAction = { run(ctx): void | Promise<void>; undo?(ctx): void }`.
Steps use actions only through this library, never raw store calls, so a layout change is fixed in
one place.

v1 actions:

- `openSection(id: SidebarSectionId)`: `useSidebarStore.openSection`; undo restores the previous
  open state of that section.
- `sheetSnap(snap: 'peek' | 'half' | 'full')`: mobile only, no-op on desktop; undo restores the
  previous snap.
- `openHintBoard()` / undo closes it (`useHintBoardStore`).
- `openSettings()` / undo closes it (needs the settings open-state store, below).
- `flyTo(lng, lat, zoom)` via `ctx.mapRef`; no undo.

The runner keeps an undo stack per step. Moving to another step (next, prev, skip, finish) runs the
current step's undos in reverse order before running the next step's actions. So steps never need
hand-written cleanup and the UI never stays half-open.

### Step shape

```ts
type Platform = 'mobile' | 'desktop';

interface TourStep {
  id: string;                                   // unique
  target: TourTargetId | null                   // null = centered card, no cutout
        | Partial<Record<Platform, TourTargetId | null>>;
  title: string;                                // Dutch
  body: string;                                 // Dutch
  actions?: TourAction[];
  durationMs?: number;                          // overrides formula
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';  // default 'auto'
  only?: Platform;
  since?: number;                               // tour version that introduced it (unused in v1)
}
```

`TOUR_STEPS` is filtered by platform (`useIsMobile()`) when the tour starts.

### Settings dropdown

`Settings.tsx` uses an uncontrolled Radix `DropdownMenu`. Its open state moves into a small zustand
store (`settings-menu.store.ts`: `open`, `setOpen`) so the `openSettings()` action can open it. Add
menu item **"Rondleiding opnieuw"** ("Replay tour") carrying `tourTarget('settings.replayItem')`. It
closes the menu and calls `tour.start()`.

## Start and completion flow

1. `Layout.tsx` reads the user via `useAuthUser`. If
   `(user.tutorialVersion ?? 0) < TOUR_VERSION` and the password-change dialog is not required
   or open, and no other dialog is open, call `tour.start({ mode: 'auto' })`.
2. On `finish()` or `skip()` in `auto` mode: `POST /auth/tutorial { version: TOUR_VERSION }`, then
   `useAuth().updateUserState({ tutorialVersion: TOUR_VERSION })`. If the request fails, still
   update local user state (the tour closes). Worst case the tour shows once more on the next login.
3. Replay from Settings uses `mode: 'replay'` and never calls the server.
4. Bumping `TOUR_VERSION` in `steps.ts` makes every user see the tour again once.

Stale sessions (logged in before this ships) have no `tutorialVersion` in their stored state;
`undefined` is treated as 0, so they see the tour once. There is no `/auth/me` endpoint, so no
extra refresh.

## v1 steps (Dutch copy written during implementation)

| # | id | Target | Actions | Only |
|---|---|---|---|---|
| 1 | welcome | null | – | |
| 2 | map | `map` | `flyTo` overview of all areas | |
| 3 | sidebar | `sidebar.root` | `sheetSnap('half')` | |
| 4 | foxes | `sidebar.foxes` | `openSection('foxes')` | |
| 5 | hunts | `sidebar.hunts` | `openSection('hunts')` | |
| 6 | hints | `sidebar.hints` | `openSection('hints')` | |
| 7 | hint-board | `hintBoard.dialog` | `openHintBoard()` | |
| 8 | hint-entry | `sidebar.hintEntry` | `openSection('hintEntry')` | |
| 9 | predictions | `sidebar.predictions` | `openSection('predictions')` | |
| 10 | counter-hunt | `sidebar.counterHunt` | `openSection('counterHunt')` | |
| 11 | tracker | `sidebar.tracking` | `openSection('tracking')` | |
| 12 | hunters | `sidebar.hunters` | `openSection('hunters')` | |
| 13a | hunt-capture | `huntCapture.button` | `sheetSnap('peek')` | mobile |
| 13b | map-tools | `cards.topRight` | – | desktop |
| 14 | settings | `settings.replayItem` | `openSettings()` | |
| 15 | done | null | – | |

The `flyTo` overview uses the bounds of the loaded areas. It falls back to the map's current view if
no areas are loaded.

## Overlay and card

- **Spotlight:** full-screen fixed SVG with a mask. The dimmed backdrop (`bg-black/60`) has a
  rounded rect cutout, 8px padding around the target rect. The cutout animates between steps with a
  CSS transition (~350ms ease). With a null target, the whole screen is dimmed and there is no
  cutout.
- **Click blocking:** the overlay captures all pointer events except on the card. The target is
  highlighted but not clickable.
- **Card:** shadcn `Card`, max-width ~340px. It contains:
  - a thin progress bar across the top
  - the title
  - the body text
  - a footer with the step counter `3/15`, Vorige (Previous, disabled on step 1), a Pause/Play icon
    button, Volgende (Next, "Klaar" (Done) on the last step), and an Overslaan (Skip) text button.
- **Positioning:** the card sits on the `placement` side of the target. `auto` picks the side with
  the most room. The position is clamped to the viewport with a 12px margin. On mobile, when the
  target is in the bottom half (the sheet), the card docks to the top of the screen. The card moves
  via `transform: translate(...)` with a CSS transition, which gives the gliding effect.
- **Reduced motion:** with `prefers-reduced-motion`, transitions are off and the card jumps.
- **Keyboard:** `→` goes to the next step, `←` to the previous one, `Esc` skips.

## Timing

- Duration is `step.durationMs ?? clamp(4000 + 40 * (title.length + body.length), 4000, 10000)`.
- The timer starts after the step's actions have resolved and the target rect is found or has
  timed out.
- Next or Prev resets the timer. Pause/Play toggles it. `pointerenter` or `touchstart` on the card
  pauses it, and `pointerleave` resumes it unless the user paused it manually.
- The progress bar is a CSS width animation that is paused along with the timer.
- On the last step, auto-advance stops. It never auto-finishes.

## Edge cases

- **Missing target:** `useTargetRect` polls up to 1.5s after the actions. If the target is not
  found, the card is centered with no cutout and a `console.warn('[tour] target not found: <id>')`
  is logged. The tour continues.
- **Resize, rotate or scroll:** the rect is re-measured via ResizeObserver on the target plus window
  `resize` and `scroll` (capture) listeners, and the card and cutout follow.
- **Scrolled out of view:** before measuring, call `el.scrollIntoView({ block: 'nearest' })`, since
  sidebar sections can be below the fold.
- **State restore:** undo stacks restore sections, sheet snap, hint board and settings. On `start()`
  the full sidebar state (`openSections`, `sheetSnap`) is snapshotted and restored on finish or skip
  as a safety net.
- **Other dialogs:** the auto start waits until the password dialog and any other open dialog are
  closed. The PWA install prompt is suppressed while `tour.active`.
- **Logout during the tour:** the store resets.
- **Replay from Settings:** the dropdown closes first, then the tour starts at step 0.

## Testing

Unit tests (`bun test`):

- `steps.test.ts`
  - step ids are unique
  - every target id is a known `TourTargetId`, checked at runtime too
  - every step has a non-empty title and body
  - after the platform filter, each platform has at least 3 steps
  - `TOUR_VERSION` ≥ 1
- `tour.store.test.ts`
  - next and prev stop at the bounds
  - `skip` and `finish` call the completion callback in auto mode only
  - `start` resets the index
- `useTourRunner` undo logic (pure function extracted): undos run in reverse order and run on
  next, prev and skip.
- `duration.test.ts`: the formula, including the clamps.

Server:

- `POST /auth/tutorial` sets the version, never lowers it, rejects requests without auth, and
  rejects invalid bodies.

Manual smoke test (preview browser, mobile and desktop viewports):

- A fresh user logs in, changes the password, and the tour auto-runs to the end.
- Log out and back in: no tour.
- Skip mid-way, then log in again: no tour.
- Replay from Settings.
- Bump `TOUR_VERSION` locally: the tour shows again.
- Remove one target temporarily: the card centers and a warning is logged.

## How to change the tour later

- **Add a step:** add the target id to `targets.ts`, put `{...tourTarget(id)}` on the element, and
  add an entry to `TOUR_STEPS`.
- **New kind of UI interaction:** add an action factory to `actions.ts`.
- **Moved component:** usually nothing to do, because the attribute travels with it.
- **Everyone should see the tour again:** bump `TOUR_VERSION`.
