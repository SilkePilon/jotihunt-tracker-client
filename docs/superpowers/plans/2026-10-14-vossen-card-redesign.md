# Vossen Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sidebar "Vossen" card (`FoxPills`) with direction C2: a 9-segment status bar, a count legend, tonal per-status groups (only non-empty ones) holding area-dot chips, and a mini status bar as the collapsed header summary — all state changes animated.

**Architecture:** Pure grouping/sorting in `src/lib/fox-status.ts` (unit tested). New CSS tokens (M3 status roles + cooldown blue) in `src/index.css`. Small components in `src/components/sidebar/foxes/` sharing one hook. `motion/react` for layout/presence animations (global `MotionConfig reducedMotion="user"` already in `main.tsx`).

**Tech Stack:** React 19, TypeScript, Tailwind v4 (`@theme inline`), motion v14 (`motion/react`), bun test.

**Spec:** `docs/superpowers/specs/2026-10-14-vossen-card-redesign-design.md`

## Global Constraints

- Group order everywhere (bar, groups): **green (Actief) → orange (Onderweg) → cooldown (Cooldown) → red (Inactief)**; within cooldown by remaining ms ascending; otherwise by lowercase area name (alpha … oscar).
- Unknown area status counts as red; a fox with cooldown > 0 is always in cooldown.
- Dutch UI copy: "Actief", "Onderweg", "Cooldown", "Inactief", legend lowercase ("2 actief"), empty: "Nog geen vossen".
- Colours (light container / on / fg — dark container / on / fg): ok `#b7f2ae/#0b3a0e/#2f6b2c` — `#1e5120/#b7f2ae/#9bd893`; warn `#ffddb8/#4a2800/#8b5000` — `#693c00/#ffddb8/#ffb870`; cooldown `#cfe5ff/#001d32/#0b5d95` — `#0f4a73/#cfe5ff/#93ccff`; error `#ffdad6/#93000a/#ba1a1a` — `#93000a/#ffdad6/#ffb4ab`. Group block = container mixed into `--card` (light 75 %, dark 55 %). Chip bg light `rgb(255 255 255 / 0.7)`, dark `rgb(0 0 0 / 0.28)`.
- Every state change animates (enter/exit/move/colour); respect reduced motion (global MotionConfig does it for motion; add `motion-reduce:transition-none` on CSS transitions).
- Tools: `bun` is not on PATH — use `npx --yes bun test`, `npx tsc -b`, `npm run lint`. Never restart the docker stack.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

- Modify `src/lib/fox-status.ts` — gains `FoxGroup`, `FOX_GROUP_ORDER`, `FOX_GROUP_LABEL`, `foxGroup`, `SidebarFox`, `sidebarFoxes`, `groupCounts`; loses `statusSummary`.
- Modify `src/lib/fox-status.test.ts` — tests for the above; drop `statusSummary` test.
- Modify `src/lib/hq-director.ts` — re-export `foxGroup`/`FoxGroup`/`GROUP_LABEL` from fox-status (HQ code and tests unchanged otherwise); fix the FoxPills comment.
- Modify `src/index.css` — fox tokens + Tailwind colours.
- Create `src/components/sidebar/foxes/useSidebarFoxes.ts` — hook: areas + hunts + reports + ticking clock → `SidebarFox[] | undefined`.
- Create `src/components/sidebar/foxes/styles.ts` — per-group Tailwind class map.
- Create `src/components/sidebar/foxes/FoxStatusBar.tsx` — the segmented bar (`full` / `mini`).
- Create `src/components/sidebar/foxes/FoxChip.tsx` — one fox chip (toggle visibility).
- Create `src/components/sidebar/foxes/FoxesCard.tsx` — card body: bar, legend, groups; exports `FoxesSummary` too.
- Modify `src/components/sidebar/SidebarSections.tsx` — use `FoxesCard` / `FoxesSummary`.
- Delete `src/components/sidebar/FoxPills.tsx`.

---

### Task 1: Grouping helpers in fox-status

**Files:**
- Modify: `src/lib/fox-status.ts`
- Modify: `src/lib/fox-status.test.ts`
- Modify: `src/lib/hq-director.ts:26-35,50-54`

**Interfaces:**
- Produces:
  - `type FoxGroup = 'green' | 'orange' | 'red' | 'cooldown'`
  - `const FOX_GROUP_ORDER: readonly FoxGroup[]` = `['green','orange','cooldown','red']`
  - `const FOX_GROUP_LABEL: Record<FoxGroup, string>`
  - `foxGroup(status: string, cooldownMs: number): FoxGroup`
  - `interface SidebarFox { area: Area; key: string; name: string; group: FoxGroup; cooldownMs: number; lastHunt: Date | string | undefined }`
  - `sidebarFoxes(input: { areas: Area[]; hunts?: Hunt[]; reports?: HuntReport[]; now: number }): SidebarFox[]` (sorted per Global Constraints)
  - `groupCounts(foxes: SidebarFox[]): Record<FoxGroup, number>`

- [ ] **Step 1: Write the failing tests**

In `src/lib/fox-status.test.ts` change the import line to:

```ts
import { FOX_GROUP_ORDER, foxGroup, groupCounts, huntCooldownMs, HUNT_COOLDOWN_MS, lastHuntTimeFor, sidebarFoxes, statusPillClass } from './fox-status';
```

Replace the `describe('statusPillClass / statusSummary', …)` block with:

```ts
describe('statusPillClass', () => {
  test('maps statuses', () => {
    expect(statusPillClass('green')).toContain('green');
    expect(statusPillClass('orange')).toContain('orange');
    expect(statusPillClass('red')).toContain('red');
    expect(statusPillClass('unknown')).toContain('gray');
  });
});

describe('foxGroup', () => {
  test('cooldown wins over the status', () => expect(foxGroup('green', 1000)).toBe('cooldown'));
  test('green / orange stay, anything else is red', () => {
    expect(foxGroup('green', 0)).toBe('green');
    expect(foxGroup('orange', 0)).toBe('orange');
    expect(foxGroup('red', 0)).toBe('red');
    expect(foxGroup('', 0)).toBe('red');
  });
});

describe('sidebarFoxes', () => {
  const now = new Date('2026-10-17T14:00:00Z').getTime();
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

  test('orders green, orange, cooldown (soonest free first), red; then by area name', () => {
    const areas = [area('Oscar', 'red'), area('Bravo', 'green'), area('Alpha', 'green'), area('Delta', 'orange'), area('Echo', 'green'), area('Golf', 'purple'), area('Hotel', 'red')];
    const hunts = [hunt('echo', 'Goedgekeurd', minutesAgo(10)), hunt('bravo', 'Goedgekeurd', minutesAgo(50))];
    const foxes = sidebarFoxes({ areas, hunts, now });
    expect(foxes.map((fox) => fox.key)).toEqual(['alpha', 'delta', 'bravo', 'echo', 'golf', 'hotel', 'oscar']);
    expect(foxes.map((fox) => fox.group)).toEqual(['green', 'orange', 'cooldown', 'cooldown', 'red', 'red', 'red']);
    expect(foxes[2].cooldownMs).toBe(10 * 60_000);
    expect(foxes[2].name).toBe('Bravo');
    expect(foxes[2].area.name).toBe('Bravo');
    expect(foxes[0].lastHunt).toBeUndefined();
  });

  test('empty input', () => expect(sidebarFoxes({ areas: [], now })).toEqual([]));

  test('group order constant', () => expect(FOX_GROUP_ORDER).toEqual(['green', 'orange', 'cooldown', 'red']));
});

describe('groupCounts', () => {
  test('counts every group, zero included', () => {
    const now = Date.now();
    const foxes = sidebarFoxes({ areas: [area('Alpha', 'green'), area('Bravo', 'red'), area('Charlie', 'green')], now });
    expect(groupCounts(foxes)).toEqual({ green: 2, orange: 0, cooldown: 0, red: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --yes bun test src/lib/fox-status.test.ts`
Expected: FAIL — `foxGroup` / `sidebarFoxes` / `groupCounts` / `FOX_GROUP_ORDER` not exported.

- [ ] **Step 3: Implement**

In `src/lib/fox-status.ts`:
1. Add `import { capitalizeFirstLetter } from './utils';` below the type imports.
2. Delete the whole `statusSummary` function and its doc comment.
3. Append:

```ts
/** Sidebar / HQ fox groups: the area status, or `cooldown` while the fox can't be hunted yet. */
export type FoxGroup = 'green' | 'orange' | 'red' | 'cooldown';

/** Display order: huntable now, on the way, free soon, inactive. */
export const FOX_GROUP_ORDER: readonly FoxGroup[] = ['green', 'orange', 'cooldown', 'red'];

export const FOX_GROUP_LABEL: Record<FoxGroup, string> = { green: 'Actief', orange: 'Onderweg', red: 'Inactief', cooldown: 'Cooldown' };

/** A fox in its hunt cooldown is listed under cooldown; an unknown status counts as inactive. */
export function foxGroup(status: string, cooldownMs: number): FoxGroup {
  if (cooldownMs > 0) return 'cooldown';
  return status === 'green' || status === 'orange' ? status : 'red';
}

/** One area's fox in the sidebar "Vossen" card. `key` is the lowercase area name. */
export interface SidebarFox {
  area: Area;
  key: string;
  name: string;
  group: FoxGroup;
  cooldownMs: number;
  lastHunt: Date | string | undefined;
}

/** Every area as a fox, in {@link FOX_GROUP_ORDER}; cooldowns soonest-free first, the rest by area name. */
export function sidebarFoxes({ areas, hunts, reports, now }: { areas: Area[]; hunts?: Hunt[]; reports?: HuntReport[]; now: number }): SidebarFox[] {
  return areas
    .map((area) => {
      const lastHunt = lastHuntTimeFor(hunts, area.name, reports);
      const cooldownMs = huntCooldownMs(lastHunt, now);
      return { area, key: area.name.toLowerCase(), name: capitalizeFirstLetter(area.name), group: foxGroup(area.status, cooldownMs), cooldownMs, lastHunt };
    })
    .sort(
      (a, b) =>
        FOX_GROUP_ORDER.indexOf(a.group) - FOX_GROUP_ORDER.indexOf(b.group) ||
        (a.group === 'cooldown' ? a.cooldownMs - b.cooldownMs : 0) ||
        a.key.localeCompare(b.key),
    );
}

export function groupCounts(foxes: SidebarFox[]): Record<FoxGroup, number> {
  const counts: Record<FoxGroup, number> = { green: 0, orange: 0, cooldown: 0, red: 0 };
  for (const fox of foxes) counts[fox.group] += 1;
  return counts;
}
```

Check `capitalizeFirstLetter` exists in `src/lib/utils.ts` (it does; `hq-director.ts` imports it) and that `utils.ts` doesn't import `fox-status` (no cycle).

In `src/lib/hq-director.ts`:
- Change `import { huntCooldownMs, lastHuntTimeFor } from './fox-status';` to `import { FOX_GROUP_LABEL, foxGroup, huntCooldownMs, lastHuntTimeFor, type FoxGroup } from './fox-status';`
- Replace `export type FoxGroup = 'green' | 'orange' | 'red' | 'cooldown';` with `export { foxGroup, type FoxGroup };`
- Replace the `GROUP_LABEL` line with `export const GROUP_LABEL = FOX_GROUP_LABEL;`
- Change the comment `/** Same colours as the sidebar's fox groups (FoxPills). */` to `/** Text colour per fox group on the HQ screen. */`
- Delete the local `foxGroup` function and its doc comment (lines ~50-54).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx --yes bun test src/lib/fox-status.test.ts src/lib/hq-director.test.ts`
Expected: all PASS.
Run: `npx tsc -b`
Expected: one error in `src/components/sidebar/SidebarSections.tsx` (`statusSummary` no longer exported) — fixed in Task 2. No other errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fox-status.ts src/lib/fox-status.test.ts src/lib/hq-director.ts
git commit -m "feat(foxes): sidebar fox grouping and ordering helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tokens, hook, status bar, collapsed summary

**Files:**
- Modify: `src/index.css`
- Create: `src/components/sidebar/foxes/styles.ts`
- Create: `src/components/sidebar/foxes/useSidebarFoxes.ts`
- Create: `src/components/sidebar/foxes/FoxStatusBar.tsx`
- Create: `src/components/sidebar/foxes/FoxesCard.tsx` (only `FoxesSummary` for now)
- Modify: `src/components/sidebar/SidebarSections.tsx`

**Interfaces:**
- Consumes: `SidebarFox`, `FoxGroup`, `sidebarFoxes` (Task 1).
- Produces:
  - `useSidebarFoxes(): SidebarFox[] | undefined`
  - `GROUP_CLASS: Record<FoxGroup, { bar: string; block: string; on: string }>` in `styles.ts`
  - `<FoxStatusBar foxes={SidebarFox[]} size="full" | "mini" />`
  - `export function FoxesSummary()` in `FoxesCard.tsx`

- [ ] **Step 1: CSS tokens**

In `src/index.css`, inside the `:root { … }` block (after `--border`/chart vars, before the closing brace) add:

```css
  /* Vossen card: M3 status roles of the map markers (marker-style.ts) + a cooldown blue */
  --fox-ok: #2f6b2c;
  --fox-ok-container: #b7f2ae;
  --fox-on-ok-container: #0b3a0e;
  --fox-warn: #8b5000;
  --fox-warn-container: #ffddb8;
  --fox-on-warn-container: #4a2800;
  --fox-cooldown: #0b5d95;
  --fox-cooldown-container: #cfe5ff;
  --fox-on-cooldown-container: #001d32;
  --fox-error: #ba1a1a;
  --fox-error-container: #ffdad6;
  --fox-on-error-container: #93000a;
  --fox-ok-group: color-mix(in oklab, var(--fox-ok-container) 75%, var(--card));
  --fox-warn-group: color-mix(in oklab, var(--fox-warn-container) 75%, var(--card));
  --fox-cooldown-group: color-mix(in oklab, var(--fox-cooldown-container) 75%, var(--card));
  --fox-error-group: color-mix(in oklab, var(--fox-error-container) 75%, var(--card));
  --fox-chip: rgb(255 255 255 / 0.7);
```

Inside the `.dark { … }` block add:

```css
  --fox-ok: #9bd893;
  --fox-ok-container: #1e5120;
  --fox-on-ok-container: #b7f2ae;
  --fox-warn: #ffb870;
  --fox-warn-container: #693c00;
  --fox-on-warn-container: #ffddb8;
  --fox-cooldown: #93ccff;
  --fox-cooldown-container: #0f4a73;
  --fox-on-cooldown-container: #cfe5ff;
  --fox-error: #ffb4ab;
  --fox-error-container: #93000a;
  --fox-on-error-container: #ffdad6;
  --fox-ok-group: color-mix(in oklab, var(--fox-ok-container) 55%, var(--card));
  --fox-warn-group: color-mix(in oklab, var(--fox-warn-container) 55%, var(--card));
  --fox-cooldown-group: color-mix(in oklab, var(--fox-cooldown-container) 55%, var(--card));
  --fox-error-group: color-mix(in oklab, var(--fox-error-container) 55%, var(--card));
  --fox-chip: rgb(0 0 0 / 0.28);
```

(The `-group` vars are redeclared in `.dark` so they resolve against the dark `--card`.)

Inside `@theme inline { … }` (next to the other `--color-*` lines) add:

```css
  --color-fox-ok: var(--fox-ok);
  --color-fox-warn: var(--fox-warn);
  --color-fox-cooldown: var(--fox-cooldown);
  --color-fox-error: var(--fox-error);
  --color-fox-on-ok: var(--fox-on-ok-container);
  --color-fox-on-warn: var(--fox-on-warn-container);
  --color-fox-on-cooldown: var(--fox-on-cooldown-container);
  --color-fox-on-error: var(--fox-on-error-container);
  --color-fox-ok-group: var(--fox-ok-group);
  --color-fox-warn-group: var(--fox-warn-group);
  --color-fox-cooldown-group: var(--fox-cooldown-group);
  --color-fox-error-group: var(--fox-error-group);
  --color-fox-chip: var(--fox-chip);
```

- [ ] **Step 2: Class map**

Create `src/components/sidebar/foxes/styles.ts`:

```ts
import type { FoxGroup } from '@/lib/fox-status';

/** Tailwind classes per fox group: status-bar segment, tonal group block, text on the block. */
export const GROUP_CLASS: Record<FoxGroup, { bar: string; block: string; on: string }> = {
  green: { bar: 'bg-fox-ok', block: 'bg-fox-ok-group', on: 'text-fox-on-ok' },
  orange: { bar: 'bg-fox-warn', block: 'bg-fox-warn-group', on: 'text-fox-on-warn' },
  cooldown: { bar: 'bg-fox-cooldown', block: 'bg-fox-cooldown-group', on: 'text-fox-on-cooldown' },
  red: { bar: 'bg-fox-error', block: 'bg-fox-error-group', on: 'text-fox-on-error' },
};
```

- [ ] **Step 3: Hook**

Create `src/components/sidebar/foxes/useSidebarFoxes.ts`:

```ts
import { useMemo } from 'react';
import { useAreas } from '@/hooks/areas.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useNow } from '@/hooks/now.hook';
import { sidebarFoxes, type SidebarFox } from '@/lib/fox-status';

/** The sidebar's foxes, re-sorted every second (cooldowns tick); undefined while the areas load. */
export function useSidebarFoxes(): SidebarFox[] | undefined {
  const { areas } = useAreas();
  const { hunts } = useHunts();
  const { reports } = useHuntReports();
  const now = useNow(true);
  return useMemo(() => (areas ? sidebarFoxes({ areas, hunts, reports, now }) : undefined), [areas, hunts, reports, now]);
}
```

(Confirm `useNow` is exported from `src/hooks/now.hook.ts` — it is, used by `Life360Linked.tsx`.)

- [ ] **Step 4: Status bar**

Create `src/components/sidebar/foxes/FoxStatusBar.tsx`:

```tsx
import { motion } from 'motion/react';
import type { SidebarFox } from '@/lib/fox-status';
import { cn } from '@/lib/utils';
import { GROUP_CLASS } from './styles';

const LAYOUT_TRANSITION = { type: 'spring', stiffness: 380, damping: 34 } as const;

/** One segment per fox in group order; segments slide to their new place and fade to the new colour. */
export default function FoxStatusBar({ foxes, size }: { foxes: SidebarFox[]; size: 'full' | 'mini' }) {
  const mini = size === 'mini';
  return (
    <span aria-hidden className={cn('flex', mini ? 'h-2 w-[90px] gap-0.5' : 'h-2.5 w-full gap-[3px]')}>
      {foxes.map((fox) => (
        <motion.span
          key={fox.key}
          layout="position"
          transition={LAYOUT_TRANSITION}
          className={cn(
            'flex-1 rounded-[3px] transition-colors duration-300 first:rounded-l-md last:rounded-r-md motion-reduce:transition-none',
            GROUP_CLASS[fox.group].bar,
          )}
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 5: Collapsed summary + wiring**

Create `src/components/sidebar/foxes/FoxesCard.tsx` with (FoxesCard body added in Task 3):

```tsx
import FoxStatusBar from './FoxStatusBar';
import { useSidebarFoxes } from './useSidebarFoxes';

/** Collapsed "Vossen" header: the mini status bar. */
export function FoxesSummary() {
  const foxes = useSidebarFoxes();
  if (!foxes || foxes.length === 0) return null;
  return <FoxStatusBar foxes={foxes} size="mini" />;
}
```

In `src/components/sidebar/SidebarSections.tsx`:
- Remove `import { statusSummary } from '@/lib/fox-status';`.
- Add `import { FoxesSummary } from './foxes/FoxesCard';`.
- Change the foxes section to `<SidebarSection id="foxes" title="Vossen" summary={<FoxesSummary />}>` (keep `<FoxPills />` inside for now).
- `useAreas`'s `areas` is still used? After this change it isn't — remove `const { areas } = useAreas();` and the `useAreas` import if nothing else uses it.

Note: `SidebarSection` renders `summary` only while collapsed, and wraps it in `<span className="truncate">` — the bar has fixed width so it fits.

- [ ] **Step 6: Verify**

Run: `npx tsc -b && npm run lint`
Expected: no errors.
Run: `npx --yes bun test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/components/sidebar/foxes src/components/sidebar/SidebarSections.tsx
git commit -m "feat(foxes): status tokens, fox status bar, mini bar in collapsed Vossen header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Card body — legend, tonal groups, chips (replaces FoxPills)

**Files:**
- Create: `src/components/sidebar/foxes/FoxChip.tsx`
- Modify: `src/components/sidebar/foxes/FoxesCard.tsx`
- Modify: `src/components/sidebar/SidebarSections.tsx`
- Delete: `src/components/sidebar/FoxPills.tsx`

**Interfaces:**
- Consumes: `useSidebarFoxes`, `FoxStatusBar`, `GROUP_CLASS` (Task 2); `SidebarFox`, `FOX_GROUP_ORDER`, `FOX_GROUP_LABEL`, `groupCounts` (Task 1); `useAreas().toggleHidden / isHidden`.
- Produces: `export default function FoxesCard()`.

- [ ] **Step 1: Chip**

Create `src/components/sidebar/foxes/FoxChip.tsx`:

```tsx
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { formatCountdown } from '@/lib/format';
import type { SidebarFox } from '@/lib/fox-status';
import { getColorFromArea } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood' };
const ago = (time: Date | string) => formatDistanceToNow(new Date(time), { locale: nl, addSuffix: true });

interface FoxChipProps {
  fox: SidebarFox;
  hidden: boolean;
  onToggle: () => void;
}

/** Area dot + name (+ cooldown); a click hides/shows the area on the map. Shares a layoutId so it slides between groups. */
export default function FoxChip({ fox, hidden, onToggle }: FoxChipProps) {
  const { area, lastHunt, cooldownMs } = fox;
  const title =
    `${fox.name}: ${STATUS_LABEL[area.status] ?? area.status} (bijgewerkt ${ago(area.updatedAt)})` +
    ` · laatste hunt: ${lastHunt ? ago(lastHunt) : 'nog geen'}` +
    (cooldownMs > 0 ? ` · weer te hunten over ${formatCountdown(cooldownMs)}` : '') +
    (hidden ? ' · verborgen' : '');
  return (
    <motion.button
      layoutId={`fox-chip-${fox.key}`}
      layout="position"
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      initial={false}
      animate={{ opacity: hidden ? 0.4 : 1 }}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!hidden}
      onClick={onToggle}
      className="inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full bg-fox-chip px-2.5 text-xs font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area.name) }} />
      {fox.name}
      {cooldownMs > 0 && <span className="tabular-nums opacity-80">{formatCountdown(cooldownMs)}</span>}
    </motion.button>
  );
}
```

- [ ] **Step 2: Card body**

Replace `src/components/sidebar/foxes/FoxesCard.tsx` with:

```tsx
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreas } from '@/hooks/areas.hook';
import { FOX_GROUP_LABEL, FOX_GROUP_ORDER, groupCounts } from '@/lib/fox-status';
import { REVEAL_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import FoxChip from './FoxChip';
import FoxStatusBar from './FoxStatusBar';
import { GROUP_CLASS } from './styles';
import { useSidebarFoxes } from './useSidebarFoxes';

/** A number that swaps with a short vertical fade when it changes. */
function Count({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('relative inline-grid tabular-nums', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** "Vossen" card (mockup C2): status bar, count legend, one tonal block per non-empty group with area chips. */
export default function FoxesCard() {
  const foxes = useSidebarFoxes();
  const { toggleHidden, isHidden } = useAreas();

  if (!foxes) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-2.5 w-full rounded-md" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }
  if (foxes.length === 0) return <p className="text-xs text-muted-foreground">Nog geen vossen</p>;

  const counts = groupCounts(foxes);
  return (
    <div className="flex flex-col">
      <FoxStatusBar foxes={foxes} size="full" />
      <div className="mt-1.5 mb-2.5 flex justify-between text-[11px] text-muted-foreground">
        {FOX_GROUP_ORDER.map((group) => (
          <span key={group} className="inline-flex items-baseline gap-1">
            <Count value={counts[group]} className="font-semibold text-foreground" />
            {FOX_GROUP_LABEL[group].toLowerCase()}
          </span>
        ))}
      </div>
      <LayoutGroup id="sidebar-foxes">
        <AnimatePresence initial={false}>
          {FOX_GROUP_ORDER.filter((group) => counts[group] > 0).map((group) => (
            <motion.div
              key={group}
              layout="position"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={REVEAL_TRANSITION}
              className="overflow-hidden"
            >
              {/* pb on the wrapper instead of a gap, so a folding group takes no space */}
              <div className="pb-1.5">
                <div className={cn('rounded-2xl px-2 pt-[7px] pb-2 transition-colors duration-300 motion-reduce:transition-none', GROUP_CLASS[group].block, GROUP_CLASS[group].on)}>
                  <div className="mx-0.5 mb-1.5 flex justify-between text-xs font-bold">
                    <span>{FOX_GROUP_LABEL[group]}</span>
                    <Count value={counts[group]} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {foxes
                      .filter((fox) => fox.group === group)
                      .map((fox) => (
                        <FoxChip key={fox.key} fox={fox} hidden={isHidden(fox.area.name)} onToggle={() => toggleHidden(fox.area.name)} />
                      ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}

/** Collapsed "Vossen" header: the mini status bar. */
export function FoxesSummary() {
  const foxes = useSidebarFoxes();
  if (!foxes || foxes.length === 0) return null;
  return <FoxStatusBar foxes={foxes} size="mini" />;
}
```

Note: the last group's `pb-1.5` leaves 6px under the card body; if it looks off in the browser, move the bottom padding to `[&:not(:last-child)]` — decide during Task 4.

- [ ] **Step 3: Wire up, delete FoxPills**

In `src/components/sidebar/SidebarSections.tsx`:
- Replace `import FoxPills from './FoxPills';` with `import FoxesCard from './foxes/FoxesCard';` and merge with the `FoxesSummary` import: `import FoxesCard, { FoxesSummary } from './foxes/FoxesCard';`
- Replace `<FoxPills />` with `<FoxesCard />`.

Run: `git rm src/components/sidebar/FoxPills.tsx`
Run: `grep -rn "FoxPills" src` — expected: no matches.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: no errors, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/sidebar
git commit -m "feat(foxes): Vossen card with status bar, legend and tonal groups (C2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Browser verification

**Files:** none unless fixes are needed (commit fixes as `fix(foxes): …`).

- [ ] **Step 1: Start vite against the prod API** (check `package.json`/`.env*` for how earlier sessions ran vite on :5174 against prod; do not touch the docker stack). Example: `npx vite --port 5174` in the background.
- [ ] **Step 2: Check open card in dark + light theme** (theme toggle in the sidebar header): bar, legend, only non-empty groups, chips with area dots, pre-game state = full red bar + "Inactief 9".
- [ ] **Step 3: Collapse the section** → mini bar visible in the header, fits, no truncation ellipsis.
- [ ] **Step 4: Click a chip** → fades to 40 %, area hidden on the map; click again → back.
- [ ] **Step 5: Animations** — simulate status changes via the react-query cache in devtools (`preview_evaluate`), e.g. set one area to `green` and another to `orange`: the chip slides to the new group, a new group unfolds, an emptied group folds away, bar segments move and recolour, counts swap. Check `prefers-reduced-motion` emulation: no motion, instant changes.
- [ ] **Step 6: Fix anything off, rerun `npx tsc -b && npm run lint && npx --yes bun test`, commit.**
