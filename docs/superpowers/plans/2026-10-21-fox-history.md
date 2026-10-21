# Fox History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fox chips show the time since their last status change; tapping a chip folds open a small uiarc-style timeline of that fox's last 3 hours (status, hints, spots, hunts) inside the Vossen card.

**Architecture:** Server gets `GET /areas/:area/history` built from data it already stores (`AreaStatusEvent`, `HintCell`, `Marker` spots, `Hunt`). The client turns that response into lane blocks and branch lines in a pure, tested module (`src/lib/fox-history.ts`), renders them in `FoxHistoryTimeline` (one CSS variable drives growth, SVG lines draw via dashoffset), and `FoxesCard` keeps one open fox and slots the panel under that fox's group.

**Tech Stack:** Server: Bun, Express 5, Mongoose, express-validator, `bun test` (docker Mongo). Client: React 19, TS, Vite, Tailwind v4 tokens, motion/react, SWR (`useAuthSWR`), lucide-react, `bun test`.

Spec: `jotihunt-tracker-client/docs/superpowers/specs/2026-10-21-fox-history-design.md` (read it; it is the source of the visual values). Mockup to match: `jotihunt-tracker-client/.superpowers/brainstorm/54124-1792580411/content/vos-historie-u3-kleuren.html`, option **P4** (open it in a browser; its CSS/JS is a working reference for sizes, colours, paths and animation timings).

## Global Constraints

- Window: fixed last 180 minutes (`HISTORY_WINDOW_MIN = 180`), moving with the clock.
- Status lane (P4), same in light and dark: green `#22c55e`, orange `#f97316`, OV `#6366f1` solid; red hatched: `repeating-linear-gradient(-45deg, color-mix(in oklab, #ef4444 75%, transparent) 0 1px, transparent 1px 4px), color-mix(in oklab, #ef4444 10%, var(--card))` + `inset 0 0 0 1px #ef4444`.
- Lane colours: hints `var(--muted-foreground)` (pastel = `color-mix(in oklab, <c> 26%, var(--card))`, 34 % in dark), spots `var(--primary)`, hunts `var(--fox-cooldown)`; rejected hunt red tint + ring + ⊗.
- Sizes: label column 20 px, rows 22 px, blocks 12 px high, radius 4 px, 1.5 px gap; branch lines 1.5 px with 5 px corner; dots 6 px with 1.5 px `var(--card)` ring; axis 20 px; playhead 1 px at 45 % opacity, knob 7 px.
- Animations: play-in 1.6 s ease-out cubic via one CSS variable `--t` (minutes); line draw 0.36 s `cubic-bezier(.22,1,.36,1)`; dot pop scale 0.4→1 0.16 s `cubic-bezier(.16,1,.3,1)`, return dot +260 ms; shimmer 1.8 s sweep + pause; running-block shine 1.5 s ease-in-out, pause at 70 %; panel open/close height spring ~0.32 s; hover card slide 0.26 s. All off under `prefers-reduced-motion`.
- Durations text: `45m`, `1u05m` (chips and panel).
- Dutch UI copy exactly: `laatste 3 uur`, `Verberg op kaart`, `Toon op kaart`, `Historie niet geladen`, `puzzelen`, `cooldown`, `spot`, `groen`, `oranje`, `rood`, `OV`.
- Tegenhunts never count as hunts (status text contains "tegenhunt", case-insensitive).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git stash`, never `pkill -f`.
- Server lint in a worktree: `npx eslint --parser-options tsconfigRootDir:"$PWD" src`; client lint the same; client types `npx tsc -b`.

---

### Task 1: Server endpoint `GET /areas/:area/history`

**Files:**
- Create: `src/services/area-history.service.ts`
- Create: `src/services/area-history.service.test.ts`
- Modify: `src/controllers/areas.controller.ts`, `src/routes/areas.route.ts`
- Test: `src/routes/areas.route.test.ts` (create; copy the server/app setup from `src/routes/hunts.route.test.ts`)

**Interfaces:**
- Produces (response JSON):
  ```ts
  interface AreaHistory {
    area: string;             // lowercase
    from: string; to: string; // ISO
    status: { status: 'green' | 'orange' | 'red' | 'blue'; from: string; to: string | null }[];
    hints: { articleId: number; publishAt: string; solvedAt: string | null; title: string }[];
    spots: { id: string; at: string }[];
    hunts: { id: string; at: string; result: 'approved' | 'pending' | 'rejected' }[];
  }
  ```
- `export function statusPeriods(input: { before: { status: string; at: Date } | null; events: { status: string; at: Date }[]; current: { status: string; updatedAt: Date } | null; from: Date; to: Date }): { status: string; from: Date; to: Date | null }[]`
- `export async function areaHistory(area: AreaName, minutes: number, now?: Date): Promise<AreaHistory | null>` (null = unknown area)

- [ ] **Step 1: Write failing unit tests for `statusPeriods`** in `area-history.service.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { statusPeriods } from "./area-history.service";

const at = (hhmm: string) => new Date(`2026-10-17T${hhmm}:00Z`);
const from = at("15:00"), to = at("18:00");

describe("statusPeriods", () => {
  test("event before the window is clipped to from; equal statuses merge; last runs", () => {
    expect(statusPeriods({ before: { status: "green", at: at("12:00") }, events: [{ status: "green", at: at("15:30") }, { status: "red", at: at("16:00") }], current: null, from, to })).toEqual([
      { status: "green", from, to: at("16:00") },
      { status: "red", from: at("16:00"), to: null },
    ]);
  });
  test("no events at all, area unchanged since before the window: one period of the current status", () => {
    expect(statusPeriods({ before: null, events: [], current: { status: "orange", updatedAt: at("10:00") }, from, to })).toEqual([{ status: "orange", from, to: null }]);
  });
  test("no event before the window: lane starts at the first event", () => {
    expect(statusPeriods({ before: null, events: [{ status: "red", at: at("16:00") }], current: { status: "red", updatedAt: at("16:00") }, from, to })).toEqual([{ status: "red", from: at("16:00"), to: null }]);
  });
  test("no events, area changed inside the window: current status from updatedAt", () => {
    expect(statusPeriods({ before: null, events: [], current: { status: "green", updatedAt: at("17:00") }, from, to })).toEqual([{ status: "green", from: at("17:00"), to: null }]);
  });
  test("unknown statuses are skipped", () => {
    expect(statusPeriods({ before: { status: "weird", at: at("12:00") }, events: [{ status: "green", at: at("16:00") }], current: null, from, to })).toEqual([{ status: "green", from: at("16:00"), to: null }]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** `npx bun test src/services/area-history.service.test.ts`

- [ ] **Step 3: Implement `area-history.service.ts`**

```ts
import { AREA_STATUSES, type AreaName, areaTitle } from "../constants/areas";
import { Area } from "../models/area.model";
import { AreaStatusEvent } from "../models/area-status-event.model";
import { Article } from "../models/article.model";
import { HintCell, HintCellStatus } from "../models/hint-cell.model";
import { Hunt } from "../models/hunt.model";
import { Marker, MarkerType } from "../models/marker.model";

export const HISTORY_DEFAULT_MINUTES = 180;
const SPOT_LEAD_MS = 10 * 60_000;
const HUNT_COOLDOWN_MS = 60 * 60_000;
const TEGENHUNT = /tegenhunt/i;

interface StatusPoint { status: string; at: Date }
const known = (status: string) => (AREA_STATUSES as readonly string[]).includes(status);

/**
 * Status periods inside [from, to]: the last change at or before `from` (clipped to `from`) plus the changes inside,
 * equal neighbours merged, the last one still running (to: null). Without a change at or before `from` (events are
 * only stored since 2026-10-20) the area's current status counts from `from` when it has not changed since, else the
 * lane starts at the first change (or at `updatedAt` when there are no changes at all).
 */
export function statusPeriods(input: { before: StatusPoint | null; events: StatusPoint[]; current: { status: string; updatedAt: Date } | null; from: Date; to: Date }) {
  const { before, events, current, from } = input;
  const points: StatusPoint[] = [];
  if (before) points.push({ status: before.status, at: from });
  else if (current && events.length === 0) points.push({ status: current.status, at: current.updatedAt <= from ? from : current.updatedAt });
  points.push(...events.filter((event) => event.at > from || !before));
  const periods: { status: string; from: Date; to: Date | null }[] = [];
  for (const point of points.filter((p) => known(p.status)).sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const last = periods[periods.length - 1];
    if (last?.status === point.status) continue;
    if (last) last.to = point.at;
    periods.push({ status: point.status, from: point.at < from ? from : point.at, to: null });
  }
  return periods;
}
```

Then `areaHistory(area, minutes, now = new Date())`:
- `to = now`, `from = now - minutes`.
- Area doc: `Area.findOne({ name: areaTitle(area) }).lean()`; missing → `null`.
- In parallel:
  - `AreaStatusEvent.findOne({ area: <same name format the areas cron writes — check jotihunt-areas.cron.ts>, at: { $lte: from } }).sort({ at: -1 }).lean()` and `.find({ area, at: { $gt: from, $lte: to } }).sort({ at: 1 }).lean()`.
  - `HintCell.find({ area, status: { $ne: HintCellStatus.None }, publishAt: { $lt: to }, $or: [{ solvedAt: { $exists: false } }, { solvedAt: null }, { solvedAt: { $gte: from } }, { status: HintCellStatus.Open }] }).lean()`; titles from `Article.find({ id: { $in: articleIds } }, { id: 1, title: 1 })`; fallback title `Hint ${HH:MM of slotTime, Europe/Amsterdam}`. Only cells whose `publishAt >= from - 180 min` (ignore stale old cells). Sort by `publishAt`.
  - `Marker.find({ type: MarkerType.Spot, area: <case-insensitive match: check how markers store area, e.g. "Alpha" or "alpha">, time: { $gte: from - SPOT_LEAD_MS, $lte: to } }).sort({ time: 1 }).lean()`.
  - `Hunt.find({ area: <case-insensitive regex ^area$>, huntTime: { $gte: from - HUNT_COOLDOWN_MS, $lte: to }, statusText: { $not: TEGENHUNT }, status: { $not: TEGENHUNT } }).sort({ huntTime: 1 }).lean()`; `result`: `statusClass === "approved" | "rejected"` as is, else `"pending"`.
- Map to the `AreaHistory` JSON (ISO strings, `solvedAt` null when open/missing).

Check the stored case of `area` in each collection before writing the queries (AreaStatusEvent uses `Area.name`, HintCell is lowercase, Markers/Hunts: look at a fixture or the code that writes them) and use an anchored case-insensitive regex where unsure.

- [ ] **Step 4: Route + controller**

`areas.route.ts`:
```ts
import { param, query } from "express-validator";
import { validate } from "../middleware/validate.middleware";
// …
router.get(
  "/:area/history",
  [verifyToken, validate([param("area").isString().isLength({ min: 1, max: 20 }), query("minutes").optional().isInt({ min: 10, max: 600 })])],
  areasController.getAreaHistory,
);
```
`areas.controller.ts`:
```ts
export async function getAreaHistory(req: Request, res: Response) {
  const area = knownAreaName(String(req.params.area).toLowerCase());
  if (!area) return res.status(404).json({ message: "Onbekend deelgebied." });
  const minutes = req.query.minutes ? Number(req.query.minutes) : HISTORY_DEFAULT_MINUTES;
  const history = await areaHistory(area, minutes);
  if (!history) return res.status(404).json({ message: "Onbekend deelgebied." });
  return res.status(200).json(history);
}
```
(Check `knownAreaName`'s exact behaviour in `src/constants/areas.ts` and the existing 404 message style in other controllers.)

- [ ] **Step 5: Route tests** `src/routes/areas.route.test.ts` (auth like `hunts.route.test.ts`): seed an Area `Alpha` red since 16:00, an `AreaStatusEvent` green at 12:00 + red at 16:00, a `HintCell` open (publishAt 17:00) and one with status `none`, a `spot` marker at 17:30, hunts approved at 16:30, rejected at 17:10 and a tegenhunt at 17:20; call `/areas/alpha/history?minutes=180` with a fixed clock — inject `now` by testing `areaHistory(area, 180, now)` directly in the service test for exact values and keep the route test to: 200 + shape + tegenhunt/none excluded, `/areas/zulu/history` → 404, `?minutes=5` → 400, no token → 401.

- [ ] **Step 6: Run, expect PASS.** `npx bun test src/services/area-history.service.test.ts src/routes/areas.route.test.ts && npx tsc --noEmit && npx eslint --parser-options tsconfigRootDir:"$PWD" src`

- [ ] **Step 7: Commit** `feat(areas): GET /areas/:area/history for the fox history panel`

---

### Task 2: Client model `src/lib/fox-history.ts` + hook

**Files:**
- Create: `src/lib/fox-history.ts`, `src/lib/fox-history.test.ts`, `src/hooks/area-history.hook.ts`

**Interfaces:**
- Consumes: `AreaHistory` JSON from Task 1 (copy the interface into `fox-history.ts`).
- Produces:
  ```ts
  export const HISTORY_WINDOW_MIN = 180;
  export type LaneKey = 'status' | 'hint' | 'spot' | 'hunt';
  export const LANES: LaneKey[] = ['status', 'hint', 'spot', 'hunt'];
  export type BlockKind = 'green' | 'orange' | 'red' | 'blue' | 'think' | 'solid' | 'wait' | 'fail';
  export interface HistoryBlock { id: string; lane: LaneKey; kind: BlockKind; start: number; end: number | null; icon?: 'check' | 'x'; card: { title: string; meta: string; note?: string } }
  export interface HistoryLink { id: string; lane: LaneKey; out: number; back: number | null }
  export interface HistoryModel { from: number; to: number; blocks: HistoryBlock[]; links: HistoryLink[] }
  // start/end/out/back are minutes after `from` (0…180); end null = still running
  export function historyModel(history: AreaHistory, now: number): HistoryModel;
  export function formatSince(ms: number): string;            // "45m", "1u05m"
  export function chipSinceText(fox: SidebarFox, now: number): string; // cooldown → `nog ${formatCountdown}` as today, else formatSince(now - updatedAt)
  export function historyStatusLine(history: AreaHistory, now: number): { status: 'green'|'orange'|'red'|'blue'|null; word: string; rest: string };
  // word "Rood · 2u05m"; rest "2 hunts · 4/4 hints" (hunts = approved+pending in window, hints solved/published in window)
  export function axisTicks(from: number): [string, string, string]; // ["15:40", "17:10", "nu"] (Europe/Amsterdam clock via formatClock)
  ```
- `useAreaHistory(area: string | null): { history: AreaHistory | undefined; error: unknown; mutate }` — `useAuthSWR(area ? `/areas/${area}/history?minutes=180` : null, { refreshInterval: 60_000, revalidateOnFocus: true })`.

Block rules (minutes relative to `from`, clipped to `[0, 180]`; blocks entirely before 0 dropped; links whose `out` < 0 dropped):
- status: one block per period, kind = status (`red` hatched is a render concern), card `{ title: 'Rood: niet hunten' | 'Groen: jagen mag' | 'Oranje: jagen mag' | 'Reist met OV', meta: '16:35 – nu · 2u05m' }`.
- hint: `think` block publishAt → solvedAt (null end while open, card "Hint: nog puzzelen" / "Hint opgelost", meta "In 23m" / "38m bezig", note title); when solved a `solid` block solvedAt → +5 ("Spot gezet"); link out = publishAt, back = solvedAt + 5 (null while open).
- spot: `solid` block at → +8 ("Vos gezien", meta clock); link out = at, back = at + 9.
- hunt: rejected → `fail` block at → +11, icon `x` ("Hunt afgekeurd", note "Geen cooldown"), link back = at + 12; else `solid` at → +7 icon `check` ("Hunt goedgekeurd"/"Hunt ingediend" for pending) then `wait` at+7 → at+60 ("Cooldown loopt · Nog 32m" while running, else "Cooldown 16:30 – 17:30", note "Weer huntbaar 17:30"), link back = at + 60.

- [ ] **Step 1: Write failing tests** covering: status clip at window start + running end null; hint open (end null, back null) and solved (two blocks + link); none of a hint before the window; spot; approved hunt with cooldown running past now (`wait.end` = at+60, may exceed now — the renderer caps by `--t`); rejected hunt; `formatSince` (59 999 ms → "0m"? use floor minutes: 45 min → "45m", 65 min → "1u05m"); `chipSinceText` cooldown vs normal; `historyStatusLine`.
- [ ] **Step 2: Run, expect FAIL.** `npx bun test src/lib/fox-history.test.ts`
- [ ] **Step 3: Implement** `fox-history.ts` and `area-history.hook.ts` (pattern: `src/hooks/reach.hook.ts`).
- [ ] **Step 4: Run, expect PASS.** `npx bun test src/lib/fox-history.test.ts && npx tsc -b && npx eslint --parser-options tsconfigRootDir:"$PWD" src`
- [ ] **Step 5: Commit** `feat(foxes): fox history model + hook`

---

### Task 3: `FoxHistoryTimeline` component

**Files:**
- Create: `src/components/sidebar/foxes/FoxHistoryTimeline.tsx` (+ any CSS in `src/index.css` under a clearly named block: keyframes `fox-history-shimmer`, `fox-history-shine`)

**Interfaces:**
- Consumes: `HistoryModel`, `LANES`, `axisTicks` from Task 2.
- Produces: `export default function FoxHistoryTimeline({ model, playKey }: { model: HistoryModel; playKey: string })` — `playKey` changes (fox opened) replay the 1.6 s play-in; a new `model` for the same key just re-lays out (no replay).

Requirements (values in Global Constraints; reference implementation: `mini()` in the mockup file):
- Measure the plot width with a `ResizeObserver`; `ppm = (width - 8) / 180`; x(m) = 4 + m·ppm.
- One wrapper style variable `--t` (minutes, 0…180) set from a `requestAnimationFrame` loop during play-in (ease-out cubic over 1.6 s) and to 180 afterwards; block widths `max(0px, calc((max(start, min(var(--t), end ?? var(--t))) - start) * ppm px - 1.5px))`, playhead/knob `left` from the same value. React state only for "passed" sets (links/dots on) throttled to ~50 ms.
- Lanes: left 20 px column with lucide icons `FlagIcon`, `LightbulbIcon`, `EyeIcon`, `CrosshairIcon` (size 13, muted); rows 22 px; faint hourly grid lines.
- Block styles per kind (status colours P4, hint/spot/hunt colours, hatch for `red` and `wait`, `fail` red tint + ring + ⊗ via lucide `CircleXIcon` size 9, `check` via `CheckIcon` size 9 in white).
- Running block (end null or end > now inside the window, and `--t` reached 180): square right corners, 2 px cap, shine sweep.
- SVG overlay: for each link an out path `M x(out) top V y−5 Q x(out) y x(out)+5 y H x(out)+6` and a back path `M x(back)−6 y H x(back)−5 Q x(back) y x(back) y−5 V top` (`top` = status row bottom edge, `y` = lane centre), `pathLength=1`, dash draw when `--t` passes; dots at the status lane bottom edge, pop in, return dot 260 ms later.
- Axis: three labels from `axisTicks` at 0, 90 and 180 (first left-aligned, last right-aligned), 10.5 px muted.
- Hover (pointer) / tap (touch) on a block → a 200 px raised card (`bg-popover`, ring + soft shadow, radius 14) under the block, clamped inside the plot; moves with a 0.26 s spring between blocks (motion `layout` or animate `left/top`), fades out on leave; tap elsewhere closes on touch.
- Tap on a lane row (not a block) → other lanes 28 % opacity, their links/dots 16 %; tap again resets.
- Legend row under the axis: swatches groen / oranje / rood (hatched) / OV / puzzelen / cooldown (hatched blue) / spot, 10.5 px.
- `useReducedMotion()` from motion/react: no play-in (start at 180), no draw/pop transitions, no shimmer/shine.
- Accessibility: wrapper `role="img"` with an `aria-label` summarising the status line; blocks are buttons only for the card (keyboard focus shows the same card).

- [ ] **Step 1:** Build the component against a fixture `HistoryModel` (add `src/components/sidebar/foxes/fox-history.fixture.ts` with the mockup's Alpha data converted via `historyModel`; keep it for Task 5's fake API too).
- [ ] **Step 2:** `npx tsc -b && npx eslint --parser-options tsconfigRootDir:"$PWD" src`; run the client tests (`npx bun test`) to make sure nothing else broke.
- [ ] **Step 3: Commit** `feat(foxes): fox history timeline (uiarc look)`

---

### Task 4: Panel + Vossen card integration

**Files:**
- Create: `src/components/sidebar/foxes/FoxHistory.tsx`
- Modify: `FoxesCard.tsx`, `FoxChip.tsx`, `OvBlock.tsx`

**Interfaces:**
- Consumes: `useAreaHistory`, `historyModel`, `historyStatusLine`, `chipSinceText` (Task 2), `FoxHistoryTimeline` (Task 3), `useAreas().toggleHidden/isHidden`.
- Produces: `FoxHistory({ fox, hidden, onToggleHidden })`.

Requirements:
- `FoxesCard` holds `openArea: string | null` (one per card). Chip / OV row `onClick` → `setOpenArea(open === key ? null : key)` (no longer `toggleHidden`); `aria-expanded` on the chip; chip `title`/`aria-label` keep the status text but drop "klik = verbergen" wording if present.
- Under each group's chips (and under the OV block rows), render the panel slot: `AnimatePresence` + a `motion.div` with `initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}` (spring ~0.32 s, `EASE_OUT` for opacity) that holds `<FoxHistory>` when the open fox is in that group. Switching foxes: the old panel exits before the new one enters (`mode="wait"` per group, or delay the new open by the exit duration when groups differ). When the open fox moves to another group, the panel moves with it (it follows `fox.group`).
- Open chip: 1.5 px ring in `currentColor` (`ring-[1.5px] ring-current`), animated.
- `FoxChip` shows `chipSinceText(fox, now)` instead of only the cooldown countdown (`useNow` with a 60 s tick; cooldown keeps `formatCountdown` ticking as today). Same for the OV row (already shows its own OV duration — keep that).
- `FoxHistory`: rounded-2xl `bg-card` box, `mt-2 p-2.5`, `text-foreground`; header (dot + name, right "laatste 3 uur" 11 px muted); status line (12 px muted tabular) with the word in a shimmer span that swaps with fade + blur-up (motion `AnimatePresence mode="popLayout"`, 0.24 s) when the status changes; then `FoxHistoryTimeline` (`playKey` = area key); then a right-aligned small tonal button `Verberg op kaart` / `Toon op kaart` calling `onToggleHidden`.
- Loading: skeleton rows (4 × 22 px) in the timeline's place; error: `Historie niet geladen` muted + tap to `mutate()`.
- Keep every existing chip animation (pop in/out between groups, layout springs) working.

- [ ] **Step 1:** Implement; keep `FoxesCard` readable (extract a `GroupBlock` if it grows).
- [ ] **Step 2:** `npx tsc -b && npx eslint --parser-options tsconfigRootDir:"$PWD" src && npx bun test`
- [ ] **Step 3: Commit** `feat(foxes): open a fox's history from its chip`

---

### Task 5: Browser check (controller)

- Fake API (`/tmp/jh-fake/server.ts`, rebuild via a subagent if missing) gains `GET /api/areas/:area/history` returning the fixture shape for every area, with times relative to "now".
- Playwright: desktop 1440×900 and phone 390×844 (sidebar drawer), light + dark: chips show `1u05m`-style times; open Alpha → play-in; hover a cooldown block → card; tap hints lane → dim; switch to another fox in another group; hide button toggles the map area; reduced motion → no play-in. Console clean.
- Fix findings through a fix subagent; then the final whole-branch review.
