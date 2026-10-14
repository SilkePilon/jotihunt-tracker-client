# Intel window (hints, opdrachten & nieuws) — design

Date: 2026-10-14. Picked in the visual companion (mockups in
`.superpowers/brainstorm/1004222-1791989094/content/`: `intel-a-v4.html` A2, `intel-a-v5.html` T1 + S1,
`intel-hints-v6.html` H2 + O).

## Goal

Throw away the full-screen `/hints` page (built 2026-10-04, `dcd3b71`) and replace it with one desktop dialog in the
Beheer look for reading news, working on opdrachten and solving hints. Simpler than the page: no claims, no answer
checks, no hint notes, no presence, no overwrite guard, no "voor ons" summary points.

## Scope decisions

- **Desktop only.** Phones keep only the sidebar mini grid (unchanged phone behaviour: one-line detail, fly to a
  solved hint, "Oplossen kan alleen op een laptop").
- **Everyone** can open it (not admin-only).
- Kept features: AI summary (summary text only), "gelezen door" + unread dots, opdracht management (status, owner,
  notes, deadline).
- Hint solving is **answer only**: type an answer per deelgebied, save. A coordinate answer still creates/moves the
  hint marker on the map (existing `solveCell` → `syncHintMarker`); a text answer has no marker.

## Removal

Client (all removed, nothing copied over — the new window is written fresh):
- `/hints` route (`Routes.tsx`), `pages/Hints.tsx`, `components/intel/*`, `components/hints/detail/*`.
- Hooks `read-state.hook.ts`, `presence.hook.ts`, `assignments.hook.ts`, `guarded-write.hook.ts`,
  `hint-actions.hook.ts`; `lib/intel.ts` (+ test), `types/Intel.ts`.
- `Layout.tsx` `inert={pathname === '/hints'}` wrapper; tour copy "Open hints" (`tour/steps.ts`) reworded.
- `WriteFlags` import in `hints.hook.ts` and `selectionSearch` use in `HintMiniGrid.tsx` go with them.
- Still-shared pieces stay: `hints.hook.ts` (`useHintBoard`, `useRdPreview`), `articles.hook.ts`,
  `next-hint.hook.ts`, `lib/hints.ts` (unused helpers such as `hintStep` removed), `ImageLightbox`, `ConfirmDialog`.

Server:
- Remove `POST /hints/:articleId/:area/{claim,release,check,notes,status}` and their service functions.
- Remove presence (`routes/presence.route.ts`, controller, service).
- Remove the overwrite guard: `services/write-conflict.ts`, the `overwrite` flag and conflict 409s in
  `hint-board.service.ts` and `assignment.service.ts`. A write simply wins.
- Keep the marker 409 (`existingMarkerId` → resend with `replaceMarker: true`); the window asks with a confirm.
- Drop `summaryPoints` from the summary prompt, `Article` model and API output (summary text stays).
- Hint cells: stop exposing/maintaining `claimedBy`, `claimedAt`, `check`, `checkedBy`, `notes`; status `solving` no
  longer occurs. Android reads these as optional fields with defaults (`HintDto.kt`), so the app keeps working.
  `NoteSchema` stays (opdrachten use it).
- Keep: `GET /hints/board`, `GET /hints/parse-answer`, `POST …/solve`, `/assignments*`, `/articles/read`,
  `POST /articles/:id/read`, summaries cron.
- Mini grid: the amber "bezig" state disappears.

## Window

- `ResponsiveDialog`-style desktop `Dialog`, ~1160×720 (`max-h-[85dvh]`), `bg-beheer-window`, `rounded-[20px]`,
  no header (own top bar). Cards/rows reuse the Beheer building blocks (`BeheerCard`, `BeheerRows`, tonal rows,
  `Pill`/`Segmented`). Not rendered on phones.
- Top bar: "Intel", tabs **Alles / Hints / Opdrachten / Nieuws** (soft segmented look, orange dot on Nieuws when
  something is unread), next-hint countdown pill (amber), close button.
- State in a zustand store `intel.store.ts` (`open`, `item`, `area`, `tab`), like `admin.store.ts`. No URL state.

### Timeline (wide)

- Newest first, grouped per day with sticky day headers ("Vandaag · Zaterdag 17 okt", …, "Eerder").
- Left time column + rail with a dot in the type colour (hint orange, opdracht blue, nieuws purple).
- Cards (`bg-card`, 20px radius):
  - Hint: title, type tag, "n/m opgelost", summary line, area chips. Chip = area colour dot + name; **solved = green
    cookie check** (`CookieBadge tone="ok"`, pops in via `SuccessBadge` when it becomes solved); open = no badge;
    no hint for that area = dimmed, no dash. Chips are status only — no solving in the timeline.
  - Opdracht: title, deadline pill, summary, status / owner / points tags.
  - Nieuws: unread dot, title, two-line summary.
- Click a card → opens it (split view). Clicking the open item again closes it.

### Split view (A2)

- Timeline column shrinks to **one third**, a 1px separator, the item on the right two thirds on the window
  background (no sheet, no shadow), content max ~720px, close (×) top right, Esc closes.
- In the narrow column the cards become **compact rows**: type-colour bar, title + time; hints show a 9-block strip
  (filled = solved, outline = open, grey = no hint), opdrachten "deadline · status", nieuws one line. Selected row has
  the orange ring and scrolls into view.

### Transition (T1)

Open: wide cards fade out (~130ms) → column width animates 100% → 33.3% (~420ms, ease-out) while compact rows stagger
in from the right → separator draws top-to-bottom → right side parts (title, meta, cards) stagger in. Text never
re-wraps while the column resizes (content is swapped while hidden). Swap item: only the right side fades out/staggers
in. Close: right side + rows fade out, column grows back, wide cards stagger in. Tab change: list fades and staggers.
`motion/react` (`AnimatePresence`, layout width), `prefers-reduced-motion` respected.

### Right side: summary (S1)

`BeheerCard` titled "Samenvatting" (no icon), right-side muted "automatisch · kan fouten bevatten", summary text.
No "voor ons" list. Hidden when there is no summary yet.

### Right side: hint (H2)

- Title, tag, time, "n/m opgelost"; summary card; card "Deelgebieden"; card "Volledige hint" (sanitised HTML,
  images open in `ImageLightbox`).
- Deelgebieden = expandable rows, **one open at a time**; the first open area is expanded on open (or the area given
  by the mini grid). Row header: colour dot, name, status (answer + cookie when solved, "open" muted), chevron.
  "geen hint" rows are dimmed and not expandable.
- Expanded: the area's full hint text, answer field + "Opslaan" (Enter saves, Esc cancels an edit), live preview line
  from `useRdPreview`: "✓ RD x y · lat N, lon E", amber warning when outside the game area, "Tekst-antwoord, geen
  marker" for text.
- Solved and expanded: answer, cookie, map button (closes the window and flies to the marker), pencil to edit.
- After save: cookie pops in (row and timeline chip), row folds, the next open area unfolds.
- Marker already there for that area/hour (409 `existingMarkerId`): `ConfirmDialog` "Bestaande marker vervangen?" →
  resend with `replaceMarker`.

### Right side: opdracht and nieuws (O)

- Opdracht: title, tag, deadline pill, max points; summary; card with rows Status (segmented Open / Bezig / Klaar /
  Ingeleverd) and Eigenaar (picker from `/assignments/members`); card Notities (list + add field); card Volledige
  tekst.
- Nieuws: title, tag, time; summary; card Volledige tekst; card "Gelezen door · n" (name chips). Opening marks it read
  (`POST /articles/:id/read`), the unread dot animates away.

## Entry points

- Sidebar mini grid (desktop): a cell opens the window on that hint with that area expanded; "Open hints" opens the
  timeline (no item).
- New hint / news toast (`notification-feed.hook.ts`, types `hint` and `article`): desktop toasts get an "Openen"
  action that opens the window on that article (`data.articleId`).

## Animation rules

Everything animates (see the animations-everywhere rule): dialog open/close, tab swaps, split open/close/swap, row
expand/fold, cookie pop + check draw, unread dot out, new items arriving in the timeline fold in at the top.

## Testing

- Client unit tests (bun) for the pure helpers: timeline building (sort, day groups), chip/strip status per area,
  next open area, unread count.
- Server tests updated for removed endpoints/fields; solve still creates/moves/removes the marker; assignments write
  without conflicts; summaries without points.
- `tsc -b` / `bun x tsc --noEmit` and build clean.
- Browser check against a throwaway server + seeded DB (recipe from the intel page work: `.stress/intel/seed.ts`,
  `.stress/start-server.sh`).

## Order

1. Server cleanup (endpoints, guard, presence, summaryPoints, cell fields) — deploy together with 2–3.
2. Client removal of the old page + store + entry points rewired.
3. Client window: timeline, split + transition, hint/opdracht/nieuws panes.
