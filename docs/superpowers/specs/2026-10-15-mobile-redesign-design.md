# Mobile web redesign — design

Date: 2026-10-15. Scope: the website on viewports `< 768px` (`useIsMobile`). Not the Android app. Desktop is unchanged
except that dialogs render extracted `…Content` components.

Mockups (visual companion, project root): `.superpowers/brainstorm/2210665-1792076408/content/`
- `mobile-v2.html` — picked direction **B** ("Beheer-navigatie in de sheet").
- `camera-button.html` — picked camera button **2** ("Hunt-marker, groot").

## Problem

On phones the 320px desktop sidebar cards are stacked in a vaul drawer (`MobileSheet.tsx`, snaps `200px / 0.5 / 0.92`).
- Content only scrolls at `full`; at peek/half cards are cut off.
- The camera button (`HuntCaptureButton`, `bottom-[144px]`) hides under the 200px peek.
- `Teams.tsx` centres with a stale `MOBILE_CENTER_OFFSET [0,-65]`; no flyTo knows the sheet height (no map padding).
- Map popups (z-20) open under the sheet.
- Dialogs (Alle hunts, Beheer, Account, Meldingen, Tracker guide, Hunt registreren) open as second drawers / centred dialogs on top of the sheet. Intel is not available on mobile at all.
- No Back-button handling anywhere.
- Browsers with a bottom URL bar / toolbar (iOS Safari Compact/Bottom, Chrome Android bottom address bar, Samsung Internet, Firefox Android) must not cover the sheet.

## Decisions (user picks)

| Topic | Pick |
|---|---|
| Layout | **B**: one sheet; home = Beheer-style menu with live summaries; tapping a row pushes a page with D1 cards |
| Dialogs | All become **pages in the same sheet stack** (no stacked drawers) |
| Intel | In the menu, **read-only** (timeline, summaries, opdracht/nieuws, hint status; no solving) |
| Peek | **Tracker line + Vossen status bar** |
| AI chat | Own menu row **"Vraag de AI"**, full height, composer above the keyboard |
| Camera button | **Hunt marker, 60px**: teal tertiaryContainer cookie, rim, marker shadow, filled camera glyph |

## 1. Sheet shell

Replaces the vaul `MobileSheet` with an own component in motion/react (vaul is unmaintained and does not fit a nav stack).

- `position: fixed; left: 0; right: 0; bottom: 0`; moved only with `transform: translateY`. Never translate any part
  below `bottom: 0` (iOS 26 clips it). Height = full snap.
- Snaps, px measured from the bottom:
  - `peek` = grab (24) + tracker line + `FoxStatusBar` + legend ≈ 136 + `env(safe-area-inset-bottom)`, clamped to
    `[120, 0.22 × visibleH]` + safe area.
  - `half` = `0.5 × visibleH`.
  - `full` = `visibleH − env(safe-area-inset-top) − 12`.
- Gestures: drag from grab/header anywhere; drag from content only when its `scrollTop === 0` and pulling down.
  Velocity flick (|v| > 0.45 px/ms) moves one snap in that direction; rubber band past the ends (×0.25 above, ×0.4 below);
  spring `bounce: 0`. Pointer capture only after 6px movement so taps on content still click. Tapping the grab cycles snaps.
- Body (scroll area) height follows the settled snap, so content scrolls at every height. `overscroll-behavior: contain`.
- Background `--beheer-window`; top corners 24px. On iOS 26 this also becomes Safari's bottom toolbar tint (intended).
- `sheetSnap` stays in `sidebar.store` as the single source of truth (existing callers keep working).

### Bottom browser toolbars and the keyboard

Research (2026-10-15): all current browsers put `bottom: 0` **above** their own bottom toolbar (iOS 26 Safari — WebKit
bug 297779 comment 23; Chrome bottom browser controls; Firefox dynamic toolbar). `env(safe-area-inset-bottom)` does not
include the toolbar (WebKit 306465) — it covers only the home indicator / gesture bar. Therefore:

- Viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual`.
- `html, body { height: 100%; overflow: hidden; overscroll-behavior: none }`.
- Sheet gets `padding-bottom: env(safe-area-inset-bottom)` (inside, not an offset).
- New hook `useViewportInsets()`:
  - `visibleH = visualViewport.height` (fallback `innerHeight`).
  - `kb = innerHeight − (vv.height + vv.offsetTop)`; sets CSS var `--kb` only when `kb > 60` (ignore toolbar jitter).
  - Listens to `visualViewport` resize/scroll, window resize, `orientationchange` (+300ms recompute) and
    `focusout` (+350ms recompute, iOS 26 offsetTop bug).
  - Snap heights recompute when `visibleH` changes.
- When the keyboard opens inside the sheet, the sheet goes to `full`; inputs/composers sit above `--kb`.
- Debug overlay behind `?viewport-debug`: innerHeight, clientHeight, vv.height, vv.offsetTop, safe-area insets, `--kb`,
  current snap heights.

### Camera button

- Hunt marker look at 60px: 9-lobe cookie (depth .07, same generator as `marker-icons.ts`), fill tertiaryContainer
  (`#bcebf0` / `#1f4d52`), 2.5px rim in surfaceContainerLowest, marker shadow, filled Material `photo_camera` glyph in
  onTertiaryContainer.
- Rides 12px above the sheet's top edge (follows drag live), hidden with POP above `half`. Spring press feedback.
- Same `HuntPhotoInput` behaviour as today.

### Map

- `map.setPadding({ bottom: currentSheetHeight })` follows the sheet (settled snaps; not every drag frame), so every
  `flyTo`/`easeTo` lands in the visible area. Remove `MOBILE_CENTER_OFFSET` and the hardcoded `bottom-[144px]`.
- Marker tap on mobile (fox, hunt, hunter, group, Life360, picked location): `MapPopup` card docks full width
  (12px margins) just above the sheet; the map flies the marker into the visible area. Back closes it.
- "Toon op kaart" from any page: sheet → `peek`, flyTo, select marker (orange ring). The page stays on the stack.

## 2. Navigation stack

- New `mobile-nav.store`: stack of `{ page: MobilePageId, params? }`; `push`, `pop`, `replace`, `reset`.
  Lower pages stay mounted (scroll kept). Transition `PANE_SLIDE` (x ±24, 0.22s); fade with reduced motion.
- Pushing a page sets the sheet to `full`. Popping keeps the current snap. Dragging down never resets the stack.
- Back chain via `history.pushState` on every push and on every sheet expansion above peek. On `popstate`, in order:
  close marker popup → pop page → sheet to peek → let the browser go back. The page-header "‹" uses the same chain.
- Desktop ↔ mobile switch at runtime: clear the stack; desktop dialogs do not auto-open.

### Peek strip (top of the sheet, always visible)

1. Tracker line: 16px cookie check + "Verbonden · in de auto · 4 s" (from tracker data). No tracker: amber
   "Koppel je telefoon". Tap → push `tracker`.
2. `FoxStatusBar size="full"` + legend. Tap → push `vossen`.

### Home (menu)

Beheer look: `--beheer-window` background, D1 cards (24px radius, `--card`), segmented rows (2px gaps, radii 16/6,
`--beheer-row`), muted 18px icon per row, title 14/600, live summary 12px muted, chevron. No counts in colour.

- **Spel**: Vossen · Hunts ("Golf te versturen", "4 vandaag") · Jotihunt-berichten · Voorspelling · Hints ("31/36
  opgelost") · Tegenhunt (only with `HOME_TEAM_API_ID`).
- **Intel**: Intel · Vraag de AI.
- **Jij**: Mijn tracker · Life360 · Meldingen · Account · Instellingen.
- **Beheer** (admins only): Algemeen · Gebruikers · Invites · Hunters · Bericht versturen · Koppelingen.

### Page frame

"‹ {parent}" back button (40px), title 22/700, description 13px muted, then the page's D1 cards with 12px gaps —
identical to a Beheer pane.

### Entry points

`admin.store.openDialog`, `intel.store.openIntel`, `account-dialog.store`, `notifications-dialog.store`,
`hunt-capture.store.startCapture`, `HuntsSection.openAll`, `/users`, hint/news toasts and tour steps get a mobile adapter
that pushes the matching page (with params, e.g. `reportId`, `articleId`, `area`).

## 3. Pages

Rule: split content from frame; don't rebuild. Each section/dialog gets a `…Content` component. Desktop wraps it in its
existing card/dialog; mobile wraps it in the page frame.

| Page id | Contents | Source |
|---|---|---|
| `vossen` | D1 "Status" (bar + legend); per group (Actief/Onderweg/Cooldown/Inactief) a D1 card with one row per area: fox-spot marker lead, name, "status · laatste hunt · hints", expands (G3) to Toon op kaart · Navigeer · Hunt | new `FoxRows` on `sidebarFoxes` + `FoxStatusBar` |
| `hunts` | "Hunt registreren" primary button, then the Alle hunts list (row A, status as coloured text, expand in place) | `AllHuntsWindow` mobile list, extracted |
| `huntRegister` | Photo, area, code, time | `HuntRegistrationDialog` content, extracted from Radix Dialog |
| `berichten` | Telegram timeline + link panel | `TelegramSection` content |
| `voorspelling` | Prediction chips; tap → peek + fly | `PredictionList` |
| `hints` | Mini grid + "Hint registreren" form; cell → Intel item | `HintMiniGrid` + `HintEntryCard` |
| `tegenhunt` | | `CounterHuntSection` content |
| `intel`, `intelItem` | Timeline per day → item page: header, AI summary card, area chips with cookie checks (read-only), opdracht/nieuws; "Vraag de AI hierover" | mobile variant of `IntelWindow`: `IntelTimeline` + `IntelDetail` without HintPane inputs |
| `ai` | `ChatPanel` full height; article chip on top (default newest hint article, tap to switch); composer above `--kb` | `IntelChat` / `ChatPanel` (chat is per article: `useIntelChat(item.id)`) |
| `tracker`, `trackerGuide` | Cookie 72 + Verbonden + vehicle pill; guide steps as sub-page | `TrackerSection` content + `TrackerGuideDialog` steps |
| `life360` | | `Life360Section` content |
| `meldingen` | Groups as in dialog; saves on leave (`close → save`) | `NotificationsDialog` content, extracted |
| `account` | | `AccountDialog` content, extracted (incl. rename/confirm sub-dialogs as inline confirms) |
| `instellingen` | D1 cards: Thema, Kaartstijl, Zichtbare lagen (switches), Geluid | settings dropdown submenus |
| `beheer.<section>` | The pane itself | `AlgemeenPane`, `UsersPane`, … (skip `BeheerWindow`'s own list→pane on mobile) |

`QrConfirmDrawer` stays as is (route-driven, compact). `/hq`, login/invite/herstel pages unchanged. Toasts move to
`top-center` on mobile.

## 4. Tour, edge cases, tests

**Tour**: `tour/actions.ts` gets `pushPage(id)` / `resetToMenu`; mobile steps push their page and target
`mobile.page.<id>`; the settings step pushes `instellingen`; the tour snapshot saves/restores nav stack + snap
instead of `openSections`.

**Edge cases**
- Admin rights revoked on a Beheer page → `reset()`.
- Page whose data disappeared (deleted hunt/article) → empty state with "Terug".
- Rotation → recompute snaps; peek clamp keeps the map usable in landscape.
- Keyboard open → sheet `full`, inputs above `--kb`.

**Tests** (`bun test`, logic only — no DOM framework):
- Snap math: heights for given visibleH / safe areas; keyboard threshold.
- Nav store: push/pop/replace/reset; Back-chain order (popup → page → peek → browser).
- Tour action mapping for mobile steps.

**Manual device checklist** (with `?viewport-debug`): iOS 26 Safari Compact and Bottom tab layouts, iOS Home Screen
web app, Chrome Android with bottom address bar, Samsung Internet bottom bar, Firefox Android, gesture and 3-button
navigation. Verify: grab handle fully visible and tappable above each toolbar, drag to full, keyboard open/close,
scrolling inside the sheet (iOS toolbar collapse), rotation, toolbar tint.

## Build order (each step shippable)

1. Sheet shell + `useViewportInsets` + map padding + camera button + docked popups.
2. Nav store + peek strip + menu + Back chain.
3. Pages from sidebar cards (`…Content` extraction).
4. Dialog content extraction: Alle hunts, Hunt registreren, Account, Meldingen, Tracker guide, Beheer panes.
5. Intel read-only + Vraag de AI.
6. Tour + Instellingen page; remove vaul `MobileSheet` and mobile branch of `ResponsiveDialog` where unused.
