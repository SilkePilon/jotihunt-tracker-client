# Fox history in the Vossen card

Date: 2026-10-21. Feature 5 of 5 from the GitHub scan (fox status history + "rood sinds" on chips; feature 4, the
tegenhunt search mode, was skipped). Mockups: `.superpowers/brainstorm/54124-1792580411/content/` —
`vos-historie-mini-uiarc.html` (option **U3**, the four-lane layout) and `vos-historie-u3-kleuren.html` (palette
**P4** for the status lane). Look and animations taken from uiarc's agent timeline
(https://uiarc.dev/components/agent-timeline; notes in `/tmp/uiarc/report.md` at design time).

## Goal

See at a glance how long each fox has been in its status, and on a tap what happened to that fox in the last three
hours: status changes, hints (published → solved), sightings and our hunts with their cooldown.

## Behaviour

### Chips (`FoxChip`)

- Every chip shows the time since the area's last status change after the name: `Alpha 1u05m` (`formatElapsed`
  style: `45m`, `1u05m`). In the cooldown group the chip keeps today's `nog 32m` countdown instead. Ticks every
  minute.
- A tap opens the history panel for that fox (no longer hides it). One fox open at a time per card: tapping another
  chip folds the open panel away first, then opens the new one; tapping the open chip folds it away. The open chip
  gets a 1.5 px ring in the group's text colour.
- A hidden fox stays dimmed as today; hiding moves to the panel's button.
- The panel lives under the chips of the group the fox is in; when the fox changes group while open, the panel moves
  with it (folds out of the old group, into the new one).
- OV group (`OvBlock`): same behaviour for its chips.

### Panel

- Card-coloured box inside the tonal group block (rounded 16 px, `bg-card`), opens/closes with a height spring
  (grid-rows 0fr → 1fr, ~0.32 s, `cubic-bezier(.22,1,.36,1)`) plus fade.
- Header: area dot + name, right "laatste 3 uur". Status line (12 px, muted, tabular): `Rood · 2u05m · 2 hunts ·
  4/4 hints`; the status word has the uiarc shimmer (1.8 s sweep + pause, linear, infinite) and swaps with a
  fade/blur-up (0.24 s) when the status changes. "x/y hints" = solved / published cells of this area in the window.
- Timeline, fixed window `[now − 3 h, now]`, moving with the clock:
  - Left column 20 px with lane icons (lucide): status `FlagIcon`, hints `LightbulbIcon`, spots `EyeIcon`, hunts
    `CrosshairIcon`.
  - Rows 22 px, blocks 12 px high, radius 4 px, 1.5 px gap between neighbours; faint hourly grid lines.
  - **Status lane (P4):** green `#22c55e`, orange `#f97316`, OV `#6366f1` solid; red hatched (−45°, 1 px line every
    4 px in `#ef4444` at 75 %, 10 % red tint, 1 px red inset ring). Same colours in light and dark.
  - **Hints lane (grey, `muted-foreground`):** per hint cell of this area with `publishAt` in or overlapping the
    window: a pastel block ("puzzelen", grey at 26 %/34 % dark over the card) from `publishAt` to `solvedAt` (to now
    while open), then a solid 5-minute block ("spot gezet"). Status `none` cells (geen hint) are skipped. A branch
    line leaves the status lane at `publishAt` and returns at the end of the solid block.
  - **Spots lane (primary orange):** per `spot` marker of the area: a solid 8-minute block, branch out at the marker
    time, back right after.
  - **Hunts lane (cooldown blue, `--fox-cooldown`):** per synced hunt of the area (tegenhunts excluded, same rule as
    the cooldown push): approved/pending = solid 7-minute block with a check icon, then the cooldown hatched in the
    same blue until `huntTime + 60 min`, line back up at that moment (= weer huntbaar). Rejected = red-tinted block
    with ⊗ icon (11 minutes), no cooldown, line back right after.
  - Branch lines: 1.5 px in the lane colour, 5 px rounded corner, from the status lane's bottom edge down to the
    lane and back up; a 6 px dot (1.5 px card-coloured ring) on the status lane where a line leaves/returns.
  - Blocks that started before the window are cut at its left edge (their branch line is not drawn).
  - Axis below (20 px): first tick time, middle time, "nu". A 1 px playhead at now (45 % opacity) with a 7 px knob.
  - Running block (contains now): right corners square, 2 px cap on the leading edge, light band sweeping across
    (1.5 s, ease-in-out, infinite, pause at 70 %).
  - Legend under it (10.5 px): groen, oranje, rood, OV swatches + puzzelen, cooldown, spot.
- Interaction: hover (desktop) or tap (touch) on a block shows a small raised card (200 px, radius 14 px) under it
  with title / time / note, e.g. "Cooldown loopt · Nog 32m · Weer huntbaar 19:12"; it slides between blocks with a
  spring (0.26 s) instead of remounting. Tap on a lane (not a block) dims the other lanes to 28 % and their lines/dots
  to 16 %; tap again to undo.
- Button row under the legend, right: "Verberg op kaart" / "Toon op kaart" (small tonal button), toggles the
  existing hidden-area state.

### Animations (uiarc values)

- Opening: after the height spring, the window plays in over 1.6 s (ease-out cubic): one CSS variable (`--t`, minutes)
  drives every block width and the playhead (no React re-render per frame; state syncs at most every ~50 ms).
- Branch lines draw with a stroke-dashoffset wipe (0.36 s, `cubic-bezier(.22,1,.36,1)`) when the playhead passes
  their start; the departure dot pops (scale 0.4 → 1, 0.16 s, `cubic-bezier(.16,1,.3,1)`), the return dot 260 ms after
  its line.
- Live: the window moves on with the clock (re-layout each minute, no replay).
- `prefers-reduced-motion`: no play-in, no shimmer/shine, no draw animation; everything shows at once.

## Data

New endpoint `GET /areas/:area/history?minutes=180` (`verifyToken`), area name case-insensitive, `minutes` 10–600
(default 180):

```ts
interface AreaHistory {
  area: string;            // lowercase
  from: string; to: string; // ISO window (to = server now)
  status: { status: 'green' | 'orange' | 'red' | 'blue'; from: string; to: string | null }[]; // null = still running
  hints: { articleId: number; publishAt: string; solvedAt: string | null; title: string }[];
  spots: { id: string; at: string }[];
  hunts: { id: string; at: string; result: 'approved' | 'pending' | 'rejected' }[];
}
```

- Status periods: the newest `AreaStatusEvent` at or before `from` (clipped to `from`) plus every event in the
  window, consecutive equal statuses merged, the last one running (`to: null`). No event at or before `from`
  (events are only stored since 2026-10-20): when the area's `updatedAt` is at or before `from`, one period of the
  area's current status from `from`; otherwise the lane is empty until the first event in the window (or, with no
  events at all, until `updatedAt`, from where the current status runs).
- Hints: `HintCell` of the area with `status !== 'none'` and `publishAt < to` and (`solvedAt` missing or `>= from`
  or still open); title from the article (`Hint 14:00` fallback from `slotTime`).
- Spots: `Marker` with `type: 'spot'`, area match, `time` in `[from − 10 min, to]`.
- Hunts: `Hunt` of the area with a `huntTime` in `[from − 60 min, to]` (so a running cooldown shows), excluding
  tegenhunts (`statusText`/`status` contains "tegenhunt"); `result` from `statusClass` (`unknown`/missing →
  `pending`).
- Archive editions: works the same on the shown edition's database (read-only).

Client: SWR hook `useAreaHistory(area | null)`, fetched only while a panel is open, refresh every 60 s and on focus;
the elapsed time on the chips needs no fetch (`area.updatedAt`).

## Structure

Server (`jotihunt-tracker-server`):
- `src/services/area-history.service.ts`: pure `statusPeriods(events, before, from, to)` + the queries.
- `src/controllers/areas.controller.ts`: `getAreaHistory`; route in `src/routes/areas.route.ts` with validation.

Client (`jotihunt-tracker-client`):
- `src/lib/fox-history.ts` (pure, tested): window maths, block list per lane (start/end/kind/label), branch line
  paths, status-line text, chip elapsed text.
- `src/hooks/area-history.hook.ts` (SWR).
- `src/components/sidebar/foxes/FoxHistory.tsx` (panel shell, header, status line, button) and
  `FoxHistoryTimeline.tsx` (lanes, SVG lines, dots, playhead, card).
- `FoxesCard.tsx` / `OvBlock.tsx` / `FoxChip.tsx`: open state (one per card), chip tap, elapsed text, panel slot per
  group.

## Error handling

- History fetch fails: the panel shows the status line from local data and "Historie niet geladen" in muted text
  with a retry on tap; chips keep working.
- Unknown area: 404. Bad `minutes`: 400.
- Empty lanes stay as empty rows (no placeholder text).

## Testing

- Server unit: `statusPeriods` (event before window, merge equal, no event, still running), endpoint filters (none
  cells, tegenhunt, window bounds, result mapping), 404/400.
- Client unit: block building per lane (clip at window start, running block, rejected hunt, open hint), elapsed
  text, status line text.
- Browser: fake API fixture with history; desktop + phone drawer, light + dark; open/close/switch fox, hover card,
  lane dim, hide button, reduced motion.

## Out of scope

HQ screen, Android app, scrolling back further than 3 hours, editing anything from the panel.
