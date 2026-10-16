# Intel window redesign — design

Date: 2026-10-16. Mockups: `.superpowers/brainstorm/258856-1792148239/content/` (timeline-status, status-bottom,
detail-back, motion).

## Goal

The Intel dialog (desktop only) gets the same shell as the Account and Meldingen dialogs, loses the "Volgende hint"
badge, gains a status card next to the timeline, aligns the detail view's cards, and gets one new motion language
(push) in place of the current shared-element morph.

User picks: **B4** status card (2×2 tiles + oplos-tempo chart), **D1** back button in the top bar, **M2** push
animations, server field **`solvedAt`**.

## 1. Shell

- Shared constant `DIALOG_SHELL` (new, e.g. `src/lib/dialog-shell.ts`): 28px corners, `border-0`, shadow
  `0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/0.35)`, built-in close X restyled as a 34×32 tonal button with 12px
  corners (`bg-beheer-row`, hover `bg-beheer-row-high`) at top-4/right-4.
- AccountDialog and NotificationsDialog use it (they each carry a copy today). Their own extras (`sm:max-w-*`,
  `bg-card`, `p-5`) are added next to it.
- IntelDialog: `DIALOG_SHELL` + `bg-beheer-window p-0 gap-0 overflow-hidden h-[720px] max-h-[85dvh] sm:max-w-[1160px]`.
  The window stays grey with white cards.

## 2. Top bar

Order: back button · "Intel" · tabs · flexible space · (room for the close button).

- Back button: 34×32 tonal, 12px corners, `ArrowLeftIcon`, title "Terug naar de tijdlijn (Esc)". On the timeline it
  has zero width and no opacity; in the detail it grows in (width + margin + opacity). Hidden from the tab order when
  collapsed.
- Tabs unchanged in behaviour; clicking a tab while a detail is open goes back to the timeline with that tab.
- The "Volgende hint over …" badge is removed from the top bar.
- Escape keeps working: first back to the timeline, then close.

## 3. Timeline view

Two columns inside the body (padding 0 16px 16px):

- Left: the timeline (day headers, time rail, wide cards) at full column width. The current `pr-[200px] pl-[150px]`
  goes. Cards, tags, area chips, deadline tags stay as they are.
- Right: status card, ~340px wide, `bg-card`, 24px corners, padding 16, own scroll if too short.

### Status card

Top: 2×2 tiles (`bg-beheer-row`, 18px corners). Each tile: small uppercase label, big number (24px, 800,
tabular-nums), muted sub line.

| Tile | Big | Sub | Click |
|---|---|---|---|
| Volgende hint | countdown (`useNextHint`) | "om 21:00" | none |
| Hints | ring + "65%" | "34 van 52 opgelost" | tab Hints |
| Opdrachten | "5/9" | "ingeleverd · 230 pt" | tab Opdrachten |
| Ongelezen | "2" | "nieuws · 1 opdracht" | tab Nieuws (or Opdrachten when only opdrachten are unread) |

- Volgende hint tile is orange tonal (`primary-container`). States from `useNextHint`: countdown; urgent (< 5 min,
  red-ish tone); "Nieuwe hint!" for 1 minute; "Geen hints meer" after the last slot; "…"/"Fout" while loading/error.
  The sub line is the slot time, hidden when not a countdown.
- Hints: solved / total over all hint cells with status ≠ none. 0 total → "—" and sub "nog geen hints".
- Opdrachten: submitted / total assignment articles; points = sum of `maxPoints` of submitted ones (omitted when 0).
- Ongelezen: `unreadCount` for news + assignments; sub names both kinds, "alles gelezen" when 0.

Below: **Oplos-tempo** group (`bg-beheer-row`, fills the remaining height):

- One stacked bar per hint slot, last 8 slots (by `slotTime`), oldest left. Green = solved cells, orange = open cells;
  `none` cells are not counted. Bar height relative to the slot with the most cells. Label under each bar: slot hour
  ("18"); the newest slot's label in foreground colour.
- Header right: "gem. X min per gebied" = mean of (`solvedAt` − `publishAt`) over solved cells in those slots that
  have a `solvedAt`; hidden when none have one. Over 90 min shown as "1 u 05".
- Legend under the chart: opgelost / open dots.
- No hints yet: empty-state text "Nog geen hints" in the group.
- Bars have a `title` ("18:00 · 3 van 9 opgelost").

Pure function `intelStats({ items, cells, now })` in `src/lib/intel-window.ts` returns all of the above (tested).

## 4. Detail view

- Two columns, both starting at the top of the body: item column (flex 1.25) and AI chat card (flex 1). The floating
  "Tijdlijn" pill and its gradient are removed, so the title card and the AI card are on one line.
- Item content (summary card, full text, hint/opdracht/news panes) and the chat are unchanged.

## 5. Motion (M2 push)

All existing Intel-window choreography is replaced. Constants live in `src/lib/intel-window.ts` (or `lib/motion.ts`
when shared): `PUSH_TRANSITION = { duration: 0.36, ease: EASE_OUT }`.

- **Timeline → detail:** both views stacked (absolute). Timeline: x 0 → −35%, opacity 1 → 0. Detail: x 35% → 0,
  opacity 0 → 1. Same 0.36 s. Back = mirror (detail to +35%, timeline from −35%). The timeline's scroll position is
  restored on return (keep `timelineScroll` memory). Implemented with `AnimatePresence` + `custom={direction}`
  (`PANE_SLIDE`-style variants with a 35% distance).
- **Tab switch:** list leaves towards the opposite side of the new tab (x ∓30px, fade, 0.16 s ease-in), new list
  enters from the tab's side (x ±30px → 0, 0.28 s EASE_OUT). Direction = sign of tab index change. In detail mode a
  tab click runs the back push with the new tab's list.
- **Item swap in detail** (toast "Openen", mini grid): push by chronology: newer item enters from the right, older from
  the left. AI chat card swaps with it (part of the pushed view).
- **Window open:** dialog rises 18px + fades in (0.38 s EASE_OUT); timeline cards slide up 8px staggered (30 ms),
  status card slides in from x 14px; tile numbers count up (0.7 s, ease-out cubic); chart bars grow from scaleY 0
  (spring, 45 ms stagger).
- **Live updates:** tile numbers roll to new values; bars animate height (LAYOUT_SPRING); countdown tile colour
  transitions between states; new timeline items unfold (existing `Fold`); back button width/opacity as in §2.
- **Reduced motion:** every push/rise becomes a plain cross-fade, no count-up (final value), bars at final height.

Removed: `morph.ts`, all card/title `layoutId`s, `INTEL_MORPH`, `DETAIL_HEAD`, the returning-card `settle` / `lifted`
logic, `RETURN_BASE`, `CHAT_CARD_ENTER`, the floating pill. `DETAIL_SWAP` / `DETAIL_PART` are replaced by the push.

## 6. Server: `solvedAt`

- `HintCell.solvedAt?: Date`. Set in the solve update only when the cell was not solved before (open/none → solved);
  re-answering a solved cell keeps the first time. `reopenImportedCell` (Jotiboard undo) unsets it.
- Board API returns it (ISO). Client `HintCell.solvedAt?: string`.
- Old solved cells without `solvedAt`: when they have a `markerId`, the board fills `solvedAt` from the marker
  ObjectId's timestamp (computed when serving, not migrated). Text answers without a marker stay without and are left
  out of the average.
- Jotiboard import solves go through the same path and get `solvedAt` too.
- Deploy server before client; the client tolerates a missing `solvedAt` (average hidden).

## 7. Testing

- Client unit tests (`intel-window.test.ts`) for `intelStats`: percentages, `none` excluded, opdracht points, unread
  split, last-8-slots bars (order, cap, empty), average (mixed with/without `solvedAt`, hour formatting), no hints.
- Server tests: `solvedAt` set on first solve, unchanged on re-answer, filled from marker id for old cells, absent for
  old text answers.
- `tsc -b`, lint, existing intel tests green.
- Visual check with Playwright on the smoke server (timeline, tiles, chart, detail alignment, back button, tab push,
  dark mode).

## Out of scope

Phone layout (dialog stays desktop only), chat internals, hint solving UI, server stats endpoint.
