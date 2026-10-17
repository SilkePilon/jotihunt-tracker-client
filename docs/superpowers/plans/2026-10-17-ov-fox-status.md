# OV fox status (`blue`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept the Jotihunt API status `blue` (fox team travels by OV) end to end and show it in the sidebar Vossen card as an indigo "OV" block with a gliding train on a rail (mockup G).

**Architecture:** The server stores `blue` like the other statuses and names it "met OV" in notifications, AI chat and the prediction prompt. The client maps `blue` to a new fox group `'ov'` (not huntable, wins over cooldown), gives it indigo tokens, and renders that group in the Vossen card as an `OvBlock` (one row + rail per fox) instead of chips.

**Tech Stack:** Server: Bun + TypeScript + Mongoose, `bun test`. Client: React 19 + Vite + Tailwind v4 + motion/react + lucide-react, `bun test`.

Spec: `docs/superpowers/specs/2026-10-17-ov-fox-status-design.md`.

## Global Constraints

- `blue` counts as **not huntable** everywhere (`huntableNow` false, group `ov` not in the HQ tour).
- Dutch UI text exactly: group label `OV`, status text `met OV`, row text `<Name> · in het OV`, notification title `OV: <Area> reist met OV — niet hunten`.
- Every UI state change animates (motion/react); respect `prefers-reduced-motion`.
- Server repo: `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-server` (branch `main`). Client repo: `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client` (branch `main`). Use `npx bun` if `bun` is not on PATH.
- Server tests need the Docker Mongo the test helper uses (`src/test/db.ts`); it is running locally.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Server accepts `blue` and names it "met OV"

**Files:**
- Modify: `jotihunt-tracker-server/src/constants/areas.ts`
- Modify: `jotihunt-tracker-server/src/crons/jotihunt-areas.cron.ts`
- Modify: `jotihunt-tracker-server/src/services/notifier.helpers.ts`
- Modify: `jotihunt-tracker-server/src/services/intel-chat/tools/app-data.ts`
- Modify: `jotihunt-tracker-server/src/services/prediction/prompt.ts`
- Test: `jotihunt-tracker-server/src/crons/jotihunt-areas.cron.test.ts`, `jotihunt-tracker-server/src/services/notifier.helpers.test.ts`, `jotihunt-tracker-server/src/services/intel-chat/tools/app-data.test.ts`

**Interfaces:**
- Produces: `AREA_STATUSES = ["green", "orange", "red", "blue"]`; `parseAreasAnswer(...)` returns `{ areas, ignored, unknownStatuses: { area: string; status: string }[] } | null`.

- [ ] **Step 1: Failing tests**

In `jotihunt-areas.cron.test.ts`, inside `describe("parseAreasAnswer")` add:

```ts
  test("blue (OV) is a known status; unknown statuses are reported with their area", () => {
    const parsed = parseAreasAnswer([
      { name: "Oscar", status: "blue", updated_at: T },
      { name: "Hotel", status: "purple", updated_at: T },
    ]);
    expect(parsed?.areas).toEqual([{ name: "Oscar", status: "blue", updatedAt: new Date(T) }]);
    expect(parsed?.ignored).toBe(1);
    expect(parsed?.unknownStatuses).toEqual([{ area: "Hotel", status: "purple" }]);
  });
```

And in the existing test "unknown names, invalid statuses and null entries are dropped…" add after `expect(parsed?.ignored).toBe(3);`:

```ts
    expect(parsed?.unknownStatuses).toEqual([{ area: "Bravo", status: "<script>" }]);
```

In `notifier.helpers.test.ts`, inside `describe("builders")` add:

```ts
  test("to blue: travelling by OV, not urgent; from blue reads met OV", () => {
    expect(buildFoxStatusNotification({ area: "oscar", from: "red", to: "blue" })).toMatchObject({
      urgent: false,
      title: "OV: Oscar reist met OV — niet hunten",
      body: "Was rood.",
      data: { area: "oscar", status: "blue", previousStatus: "red" },
    });
    expect(buildFoxStatusNotification({ area: "Oscar", from: "blue", to: "red" })).toMatchObject({ title: "Oscar is nu rood", body: "Was met OV." });
  });
```

In `app-data.test.ts`, find the existing `areasOverview` test (it builds areas incl. `{ name: "Charlie", status: "orange", updatedAt: NOW }` around line 103). Add one more area doc `{ name: "Oscar", status: "blue", updatedAt: NOW }` to the inserted areas of that test (or a copy of it if Oscar is already used there), and assert:

```ts
    expect(byArea.oscar).toMatchObject({ status: "blue", statusText: "met OV", huntableNow: false });
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd jotihunt-tracker-server && bun test src/crons/jotihunt-areas.cron.test.ts src/services/notifier.helpers.test.ts src/services/intel-chat/tools/app-data.test.ts`
Expected: the new assertions fail (blue dropped, `unknownStatuses` undefined, title `Oscar is nu blue`, statusText `onbekend`).

- [ ] **Step 3: Implement**

`src/constants/areas.ts`:

```ts
/** Fox team statuses of the Jotihunt API: green (actief), orange (onderweg), red (inactief), blue (met OV, since 2026; not huntable). */
export const AREA_STATUSES = ["green", "orange", "red", "blue"] as const;
```

`src/crons/jotihunt-areas.cron.ts` — replace `parseAreasAnswer` and the warn line:

```ts
/**
 * The usable areas of one /areas answer: only known area names (stored as "Alpha" … "Oscar") with a known status.
 * Returns null when the whole answer looks broken (no usable area, or far more entries than there are areas):
 * then nothing is stored. Unknown names in an otherwise good answer are dropped; known areas with an unknown status
 * are dropped too and listed in `unknownStatuses`.
 */
export function parseAreasAnswer(apiAreas: ApiArea[]): { areas: AreaUpdate[]; ignored: number; unknownStatuses: { area: string; status: string }[] } | null {
  if (apiAreas.length > AREAS.length * 2) return null;
  const byName = new Map<string, AreaUpdate>();
  const unknownStatuses: { area: string; status: string }[] = [];
  for (const apiArea of apiAreas) {
    const area = knownAreaName(apiArea?.name);
    if (!area) continue;
    if (!(AREA_STATUSES as readonly string[]).includes(apiArea.status)) {
      unknownStatuses.push({ area: areaTitle(area), status: String(apiArea.status).slice(0, 40) });
      continue;
    }
    const updatedAt = new Date(apiArea.updated_at);
    byName.set(area, { name: areaTitle(area), status: apiArea.status, ...(Number.isNaN(updatedAt.getTime()) ? {} : { updatedAt }) });
  }
  if (byName.size === 0) return null;
  return { areas: [...byName.values()], ignored: apiAreas.length - byName.size, unknownStatuses };
}
```

Above `retrieveJotihuntAreas` add:

```ts
/** Unknown statuses already warned about ("Oscar:purple"), so a new status logs once instead of every run. */
const warnedStatuses = new Set<string>();
```

and in `retrieveJotihuntAreas` replace the `if (parsed.ignored > 0) logger.warn(...)` line with:

```ts
  for (const { area, status } of parsed.unknownStatuses) {
    const key = `${area}:${status}`;
    if (warnedStatuses.has(key)) continue;
    warnedStatuses.add(key);
    logger.warn(`(CRON) Unknown status "${status}" for ${area} in the /areas answer; not stored`);
  }
  const otherIgnored = parsed.ignored - parsed.unknownStatuses.length;
  if (otherIgnored > 0) logger.warn(`(CRON) Ignored ${otherIgnored} unknown or invalid entries in the /areas answer`);
```

`src/services/notifier.helpers.ts`:

```ts
const STATUS_NL: Record<string, string> = { green: "groen", orange: "oranje", red: "rood", blue: "met OV" };
```

and in `buildFoxStatusNotification`, after the `if (change.to === "green") {...}` block:

```ts
  if (change.to === "blue") {
    return { type: "fox-status", title: `OV: ${area} reist met OV — niet hunten`, body: `Was ${statusNl(change.from)}.`, urgent: false, data };
  }
```

`src/services/intel-chat/tools/app-data.ts`:

```ts
const STATUS_TEXT: Record<string, string> = { green: "actief", orange: "onderweg", red: "inactief", blue: "met OV" };
```

and change the tool description string (line ~335) to:

```ts
      description: "Alle vossenteams (deelgebieden) met status (green = actief, orange = onderweg, red = inactief, blue = reist met OV, niet hunten), ons eigen vossenteam en of we ze mogen hunten.",
```

`src/services/prediction/prompt.ts` — the status rule line becomes:

```ts
- Status: green = walking, huntable. orange = travelling with a movement budget (car/transit possible, faster than walking). blue = travelling by public transport (bus/train), not huntable; expect jumps along OV lines. red = inactive.
```

- [ ] **Step 4: Run, expect PASS; then full checks**

Run: `bun test src/crons/jotihunt-areas.cron.test.ts src/services/notifier.helpers.test.ts src/services/intel-chat/tools/app-data.test.ts` → PASS.
Run: `bun run typecheck && bun run lint && bun test` → all green (if a prompt snapshot test fails because of the changed rule line, update the expected text to the new line).

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(areas): accept the blue (met OV) fox status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Client `ov` fox group, tokens and existing views

**Files:**
- Modify: `jotihunt-tracker-client/src/lib/fox-status.ts`
- Modify: `jotihunt-tracker-client/src/index.css` (light block ~line 41-57, dark block ~91-107, `@theme inline` ~139-156)
- Modify: `jotihunt-tracker-client/src/components/sidebar/foxes/styles.ts`
- Modify: `jotihunt-tracker-client/src/components/sidebar/foxes/FoxChip.tsx:11`
- Modify: `jotihunt-tracker-client/src/components/sidebar/foxes/FoxesCard.tsx` (legend + sr-only text only)
- Modify: `jotihunt-tracker-client/src/components/mobile/PeekStrip.tsx`
- Modify: `jotihunt-tracker-client/src/lib/hq-director.ts:30-35`
- Test: `jotihunt-tracker-client/src/lib/fox-status.test.ts`

**Interfaces:**
- Produces (from `@/lib/fox-status`): `type FoxGroup = 'green' | 'orange' | 'ov' | 'red' | 'cooldown'`; `FOX_GROUP_ORDER = ['green','orange','ov','cooldown','red']`; `FOX_GROUP_LABEL.ov = 'OV'`; `FOX_STATUS_TEXT: Record<string,string>` (`green:'groen', orange:'oranje', red:'rood', blue:'met OV'`); `legendGroups(counts: Record<FoxGroup, number>): FoxGroup[]` (order without `ov` when its count is 0); `formatOvDuration(ms: number): string`. Tailwind classes `bg-fox-ov`, `bg-fox-ov-group`, `text-fox-on-ov`, `bg-fox-ov-container`, `text-fox-ov`.

- [ ] **Step 1: Failing tests** — append to `src/lib/fox-status.test.ts` (and add `formatOvDuration, legendGroups` to its import):

```ts
describe('ov (blue)', () => {
  test('blue is the ov group, also during a cooldown', () => {
    expect(foxGroup('blue', 0)).toBe('ov');
    expect(foxGroup('blue', 5000)).toBe('ov');
  });
  test('order and counts', () => {
    expect(FOX_GROUP_ORDER).toEqual(['green', 'orange', 'ov', 'cooldown', 'red']);
    const foxes = sidebarFoxes({ areas: [area('Oscar', 'blue'), area('Alpha', 'green'), area('Hotel', 'red')], now: Date.parse('2026-10-17T12:00:00Z') });
    expect(foxes.map((fox) => fox.key)).toEqual(['alpha', 'oscar', 'hotel']);
    expect(groupCounts(foxes)).toEqual({ green: 1, orange: 0, ov: 1, cooldown: 0, red: 1 });
  });
  test('legend hides ov when there is none', () => {
    expect(legendGroups({ green: 1, orange: 0, ov: 0, cooldown: 0, red: 1 })).toEqual(['green', 'orange', 'cooldown', 'red']);
    expect(legendGroups({ green: 1, orange: 0, ov: 1, cooldown: 0, red: 1 })).toEqual(['green', 'orange', 'ov', 'cooldown', 'red']);
  });
  test('formatOvDuration', () => {
    expect(formatOvDuration(-5)).toBe('< 1 min');
    expect(formatOvDuration(59_000)).toBe('< 1 min');
    expect(formatOvDuration(12 * 60_000 + 30_000)).toBe('12 min');
    expect(formatOvDuration(65 * 60_000)).toBe('1 u 5 min');
    expect(formatOvDuration(120 * 60_000)).toBe('2 u');
  });
});
```

Also update the existing `groupCounts` expectation(s) in that file, if any, to include `ov: 0`.

- [ ] **Step 2: Run, expect FAIL**

Run: `cd jotihunt-tracker-client && bun test src/lib/fox-status.test.ts` → FAIL (`legendGroups`/`formatOvDuration` missing, `foxGroup('blue')` is `red`).

- [ ] **Step 3: Implement `fox-status.ts`**

Replace the group section (from `/** Sidebar / HQ fox groups` to the end of `foxGroup`) with:

```ts
/** Sidebar / HQ fox groups: the area status (`blue` = ov), or `cooldown` while the fox can't be hunted yet. */
export type FoxGroup = 'green' | 'orange' | 'ov' | 'red' | 'cooldown';

/** Display order: huntable now, on the way, by OV (not huntable), free soon, inactive. */
export const FOX_GROUP_ORDER: readonly FoxGroup[] = ['green', 'orange', 'ov', 'cooldown', 'red'];

export const FOX_GROUP_LABEL: Record<FoxGroup, string> = { green: 'Actief', orange: 'Onderweg', ov: 'OV', red: 'Inactief', cooldown: 'Cooldown' };

/** Dutch status text for tooltips ("Oscar: met OV"). */
export const FOX_STATUS_TEXT: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood', blue: 'met OV' };

/**
 * `blue` (travelling by OV, not huntable) is its own group, also during a cooldown; otherwise a fox in its hunt
 * cooldown is listed under cooldown; an unknown status counts as inactive.
 */
export function foxGroup(status: string, cooldownMs: number): FoxGroup {
  if (status === 'blue') return 'ov';
  if (cooldownMs > 0) return 'cooldown';
  return status === 'green' || status === 'orange' ? status : 'red';
}

/** Legend items: every group, but `ov` only while a fox travels by OV (normally four items). */
export function legendGroups(counts: Record<FoxGroup, number>): FoxGroup[] {
  return FOX_GROUP_ORDER.filter((group) => group !== 'ov' || counts.ov > 0);
}

/** How long a fox has been on OV: "< 1 min", "12 min", "1 u 5 min", "2 u". */
export function formatOvDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} u ${rest} min` : `${hours} u`;
}
```

And in `groupCounts`: `const counts: Record<FoxGroup, number> = { green: 0, orange: 0, ov: 0, cooldown: 0, red: 0 };`

- [ ] **Step 4: Tokens in `src/index.css`**

Light block, after `--fox-on-error-container: #93000a;` add:

```css
  --fox-ov: #5b4fc4;
  --fox-ov-container: #e5deff;
  --fox-on-ov-container: #1a0f5c;
```

and after `--fox-error-group: …75%…;` add:

```css
  --fox-ov-group: color-mix(in oklab, var(--fox-ov-container) 75%, var(--card));
```

Dark block, after `--fox-on-error-container: #ffdad6;` add:

```css
  --fox-ov: #c5b8ff;
  --fox-ov-container: #3d2d8c;
  --fox-on-ov-container: #e5deff;
```

and after `--fox-error-group: …55%…;` add:

```css
  --fox-ov-group: color-mix(in oklab, var(--fox-ov-container) 60%, var(--card));
```

`@theme inline`, next to the other fox lines add:

```css
  --color-fox-ov: var(--fox-ov);
  --color-fox-on-ov: var(--fox-on-ov-container);
  --color-fox-ov-group: var(--fox-ov-group);
  --color-fox-ov-container: var(--fox-ov-container);
```

- [ ] **Step 5: Wire existing views**

`styles.ts` — add to `GROUP_CLASS`:

```ts
  ov: { bar: 'bg-fox-ov', block: 'bg-fox-ov-group', on: 'text-fox-on-ov' },
```

`FoxChip.tsx` — delete the local `STATUS_LABEL` const; import `FOX_STATUS_TEXT` from `@/lib/fox-status` (merge with the existing `type SidebarFox` import) and use `FOX_STATUS_TEXT[area.status] ?? area.status` in `title`.

`FoxesCard.tsx` — import `legendGroups`; legend map becomes `{legendGroups(counts).map((group) => (` (same JSX inside). In `FoxesSummary`, sr-only text becomes:

```tsx
<span className="sr-only">{`${counts.green} actief, ${counts.orange} onderweg, ${counts.ov ? `${counts.ov} met OV, ` : ''}${counts.cooldown} cooldown, ${counts.red} inactief`}</span>
```

`PeekStrip.tsx` — remove the local `GROUP_ORDER` const, import `legendGroups` from `@/lib/fox-status`, and map `legendGroups(counts)` instead of `GROUP_ORDER`.

`hq-director.ts` — add to `GROUP_TEXT_CLASS`:

```ts
  ov: 'text-indigo-700 dark:text-indigo-300',
```

- [ ] **Step 6: Run, expect PASS; full checks**

Run: `bun test && bun run lint && npx tsc -b` → all green (tsc catches any other `Record<FoxGroup,…>` missing `ov`; add an indigo/`'OV'` entry there if found).

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat(foxes): ov group for the blue (met OV) fox status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: OV block with rail in the Vossen card (mockup G)

**Files:**
- Create: `jotihunt-tracker-client/src/components/sidebar/foxes/OvBlock.tsx`
- Modify: `jotihunt-tracker-client/src/components/sidebar/foxes/FoxesCard.tsx` (group block rendering)
- Modify: `jotihunt-tracker-client/src/index.css` (rail keyframes)

**Interfaces:**
- Consumes: `SidebarFox`, `formatOvDuration`, `FOX_STATUS_TEXT` from `@/lib/fox-status`; `useNow` from `@/hooks/now.hook` (`useNow(true)` ticks every second, returns ms); `POP`, `POP_SPRING`, `LAYOUT_SPRING` from `@/lib/motion`; `getColorFromArea`, `cn` from `@/lib/utils`; `FORBIDDEN_AREA_NOTE` from `@/lib/huntable-areas`.
- Produces: `default function OvBlock({ foxes, isHidden, isForbidden, popIn, onToggle }: { foxes: SidebarFox[]; isHidden: (area: string) => boolean; isForbidden: (area: string) => boolean; popIn: boolean; onToggle: (area: string) => void })`.

- [ ] **Step 1: Rail keyframes in `src/index.css`** (append at the end of the file):

```css
/* Vossen card OV block: the train glides between the two stations */
@keyframes ov-ride {
  from { left: 0; }
  to { left: calc(100% - 22px); }
}
.ov-train {
  animation: ov-ride 6s ease-in-out infinite alternate;
}
@media (prefers-reduced-motion: reduce) {
  .ov-train {
    animation: none;
    left: calc(50% - 11px);
  }
}
```

- [ ] **Step 2: Create `OvBlock.tsx`**

```tsx
import { AnimatePresence, motion } from 'motion/react';
import { LockIcon, TrainFrontIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useNow } from '@/hooks/now.hook';
import { formatOvDuration, type SidebarFox } from '@/lib/fox-status';
import { FORBIDDEN_AREA_NOTE } from '@/lib/huntable-areas';
import { LAYOUT_SPRING, POP, POP_SPRING } from '@/lib/motion';
import { cn, getColorFromArea } from '@/lib/utils';

/** Pop in only after the fox has popped out of its previous group (same as FoxChip). */
const POP_IN = { ...POP_SPRING, delay: 0.15 };

interface OvBlockProps {
  foxes: SidebarFox[];
  isHidden: (area: string) => boolean;
  isForbidden: (area: string) => boolean;
  /** Pop rows in on mount (a status change moved the fox here); false on the card's first render */
  popIn: boolean;
  onToggle: (area: string) => void;
}

/** One OV fox: name + time on OV (click hides/shows it on the map), and a rail with a gliding train. */
function OvRow({ fox, hidden, forbidden, popIn, now, onToggle }: { fox: SidebarFox; hidden: boolean; forbidden: boolean; popIn: boolean; now: number; onToggle: () => void }) {
  const since = new Date(fox.area.updatedAt);
  const duration = formatOvDuration(now - since.getTime());
  const title =
    `${fox.name}: met OV sinds ${formatDistanceToNow(since, { locale: nl, addSuffix: true })} · niet hunten` +
    (forbidden ? ` · ${FORBIDDEN_AREA_NOTE}` : '') +
    (hidden ? ' · verborgen' : '');
  return (
    <motion.button
      layout="position"
      initial={popIn ? POP.initial : false}
      animate={POP.animate}
      exit={POP.exit}
      transition={{ default: POP_IN, layout: LAYOUT_SPRING }}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!hidden}
      onClick={onToggle}
      className="block w-full cursor-pointer rounded-xl text-left focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className={cn('block px-0.5 transition-opacity duration-200 motion-reduce:transition-none', hidden ? 'opacity-40' : forbidden && 'opacity-45')}>
        <span className="flex items-center justify-between gap-2 text-xs font-bold">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="relative grid size-2.5 shrink-0 place-items-center">
              <AnimatePresence initial={false}>
                {forbidden ? (
                  <motion.span key="lock" className="absolute inset-0 grid place-items-center" initial={POP.initial} animate={POP.animate} exit={POP.exit} transition={POP.transition}>
                    <LockIcon aria-hidden className="size-2.5" strokeWidth={2.75} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="dot"
                    className="size-[7px] rounded-full"
                    style={{ backgroundColor: getColorFromArea(fox.area.name) }}
                    initial={POP.initial}
                    animate={POP.animate}
                    exit={POP.exit}
                    transition={POP.transition}
                  />
                )}
              </AnimatePresence>
            </span>
            <span className="truncate">{fox.name} · in het OV</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums opacity-80">{duration}</span>
        </span>
        {/* Rail: dashed track between two stations, the train glides back and forth (still with reduced motion) */}
        <span aria-hidden className="relative mt-1.5 block h-[18px]">
          <span className="absolute inset-x-0 top-2 border-t-2 border-dashed border-fox-ov/55" />
          <span className="absolute top-1 left-0 size-2.5 rounded-full border-2 border-fox-ov bg-card" />
          <span className="absolute top-1 right-0 size-2.5 rounded-full border-2 border-fox-ov bg-card" />
          <span className="ov-train absolute top-0 grid h-[18px] w-[22px] place-items-center rounded-md bg-fox-ov text-fox-ov-group">
            <TrainFrontIcon className="size-3" strokeWidth={2.5} />
          </span>
        </span>
      </span>
    </motion.button>
  );
}

/** The Vossen card's OV group (mockup G): one row with a rail per fox travelling by OV (API status `blue`). */
export default function OvBlock({ foxes, isHidden, isForbidden, popIn, onToggle }: OvBlockProps) {
  const now = useNow(true);
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {foxes.map((fox) => (
          <OvRow key={fox.key} fox={fox} hidden={isHidden(fox.area.name)} forbidden={isForbidden(fox.area.name)} popIn={popIn} now={now} onToggle={() => onToggle(fox.area.name)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Render it in `FoxesCard.tsx`**

Import `OvBlock from './OvBlock'`. Inside the group block `<div className={cn('rounded-2xl px-2 pt-[7px] pb-2 …', GROUP_CLASS[group].block, GROUP_CLASS[group].on)}>`, replace its children with:

```tsx
                {group === 'ov' ? (
                  <OvBlock
                    foxes={foxes.filter((fox) => fox.group === 'ov')}
                    isHidden={isHidden}
                    isForbidden={isForbidden}
                    popIn={mounted}
                    onToggle={toggleHidden}
                  />
                ) : (
                  <>
                    {/* existing header div (label + Count) and chips div, unchanged */}
                  </>
                )}
```

The fragment holds the two existing children (the `mx-0.5 mb-1.5 …` header div and the `flex flex-wrap gap-1` chips div) moved verbatim — do not change them. The OV block has no header: each row already says "in het OV".

- [ ] **Step 4: Checks**

Run: `bun test && bun run lint && npx tsc -b` → all green.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(foxes): OV block with a gliding train in the Vossen card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 (controller): browser check + deploy

- [ ] Run client dev against local or prod-like server; fake `/areas` with Oscar `blue` (axios interceptor trick from the Vossen card redesign: import `/node_modules/.vite/deps/axios.js?v=…` in `preview_evaluate`, keep each evaluate < 15 s). Check light + dark, collapsed header mini bar, legend with/without ov, row click hides on map, reduced motion, mobile peek strip.
- [ ] Push server + client `main`; homelab PR bumping both image tags; after merge confirm Argo synced and prod `/areas` shows Oscar `blue` in the DB.
