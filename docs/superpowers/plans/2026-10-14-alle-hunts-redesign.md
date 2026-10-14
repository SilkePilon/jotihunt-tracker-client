# Alle hunts Window Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "Alle hunts" into a Beheer-style window (nav left, segmented rows right) where each hunt row shows the map's hunt marker, its status as coloured text in the meta line, and unfolds in place to the photo, facts and actions — replacing the separate hunt detail view.

**Architecture:** Pure list logic (filters, counts, area totals, row status text/tone, review flag) moves to a new `src/lib/hunt-list.ts` with bun tests. Beheer's layout primitives get two small extensions (controlled open row, custom unfold body) and its nav item moves to a shared `WindowNav.tsx`. New components `HuntMarkerIcon`, `HuntListRow` and `HuntRowDetails` build the rows; `AllHuntsDialog` is rewritten on `ResponsiveDialog` like `BeheerDialog`. `HuntDetail.tsx` and `HuntStatusBadge.tsx` are deleted.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, `motion/react`, lucide-react, sonner, bun test (`bun:test`).

**Spec:** `docs/superpowers/specs/2026-10-14-alle-hunts-redesign-design.md`. Mockups: `.superpowers/brainstorm/1124167-1791997191/content/` (`hunts-lijst.html` L4, `hunts-rij.html` A, `hunts-status.html` S2).

## Global Constraints

- Work on branch `feat/alle-hunts-redesign` off local `main` in `jotihunt-tracker-client` (create it before Task 1: `git switch -c feat/alle-hunts-redesign`). Never deploy; never touch the docker stack.
- `bun` is not on PATH: run tests with `npx --yes bun test <file>`. Type check with `npx tsc -b`. Lint with `npx eslint <files> --max-warnings 0`.
- All UI copy is Dutch, exactly as written in this plan.
- No coloured status pills in rows: status is coloured text in the meta line (spec "Status S2").
- Buttons/icon buttons use Beheer `Pill` / `IconPill` (12px corners), no shadcn `Button` in the new window.
- Every state change animates (enter/exit/swap) with `motion/react`; respect `prefers-reduced-motion` (`motion-safe:` for CSS animations).
- No avatar circles; no icons in card titles.
- Comments: short, explain why; match the surrounding code's density.

---

### Task 1: List logic in `lib/hunt-list.ts`

**Files:**
- Create: `src/lib/hunt-list.ts`
- Test: `src/lib/hunt-list.test.ts`

**Interfaces:**
- Consumes: `currentHuntStatus`, `isReading` from `src/lib/hunt-reports.ts`; `formatCountdown` from `src/lib/format.ts`; `areaOptions` from `src/lib/utils.ts`; types `Hunt`, `HuntListItem`, `HuntReport`.
- Produces:
  - `type HuntFilter = 'all' | 'pending' | 'submitted' | 'judged'`
  - `HUNT_FILTERS: HuntFilter[]`, `HUNT_FILTER_LABELS: Record<HuntFilter, string>`
  - `matchesHuntFilter(item: HuntListItem, filter: HuntFilter): boolean`
  - `huntItemKey(item): string` (report `_id`, or `site-<hunt._id>`), `huntItemArea(item): string` (lowercase), `huntItemPoints(item): number`
  - `huntFilterCounts(items): Record<HuntFilter, number>`
  - `interface HuntAreaTotal { area: string; label: string; count: number; points: number }`, `huntAreaTotals(items): HuntAreaTotal[]`
  - `type HuntRowTone = 'to_submit' | 'overdue' | 'submitted' | 'judged' | 'rejected'`
  - `interface HuntRowStatus { tone: HuntRowTone; text: string; urgent: boolean }`
  - `huntRowStatus(report: HuntReport, now: number): HuntRowStatus | null` (null while reading)
  - `websiteHuntStatus(hunt: Hunt): HuntRowStatus`
  - `huntRowFlag(report: HuntReport): 'controleren' | 'dubbel?' | null`
  - `HUNT_ROW_TONE_CLASS: Record<HuntRowTone, string>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/hunt-list.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import type { Hunt } from '@/types/Hunt';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';
import { huntAreaTotals, huntFilterCounts, huntItemKey, huntRowFlag, huntRowStatus, matchesHuntFilter, websiteHuntStatus } from './hunt-list';

function report(overrides: Partial<HuntReport> = {}): HuntReport {
  return {
    _id: 'r1',
    area: 'alpha',
    huntCode: 'AB12CD',
    huntTime: '2026-10-17T12:00:00.000Z',
    huntTimeKnown: true,
    huntCodeSource: 'ocr',
    huntTimeSource: 'ocr',
    reportedBy: 'u1',
    reportedByName: 'Merida',
    submittedAt: null,
    submittedByName: null,
    site: null,
    createdAt: '2026-10-17T12:05:00.000Z',
    status: 'to_submit',
    deadline: '2026-10-17T12:30:00.000Z',
    photoUrl: '/hunt-reports/r1/photo',
    ocrStatus: 'done',
    ocrError: null,
    codeConfidence: 0.95,
    timeConfidence: 0.92,
    stickerBox: null,
    needsReview: false,
    duplicateOf: null,
    ...overrides,
  };
}

function hunt(overrides: Partial<Hunt> = {}): Hunt {
  return {
    _id: 'h1',
    area: 'Bravo',
    huntCode: 'XY99',
    status: 'Goedgekeurd',
    points: 10,
    huntTime: new Date('2026-10-17T11:00:00.000Z'),
    updatedAt: new Date('2026-10-17T11:30:00.000Z'),
    ...overrides,
  };
}

const app = (overrides: Partial<HuntReport> = {}): HuntListItem => ({ source: 'app', report: report(overrides) });
const site = (overrides: Partial<Hunt> = {}): HuntListItem => ({ source: 'website', hunt: hunt(overrides) });
const judged = { status: 'judged' as const, submittedAt: '2026-10-17T12:10:00.000Z', site: { status: 'Goedgekeurd', points: 10, seenAt: '2026-10-17T12:40:00.000Z' } };
// 8 min 42 s before the deadline of report()
const BEFORE = Date.parse('2026-10-17T12:21:18.000Z');

describe('matchesHuntFilter', () => {
  test('Te versturen holds to_submit and overdue reports', () => {
    expect(matchesHuntFilter(app(), 'pending')).toBe(true);
    expect(matchesHuntFilter(app({ status: 'overdue' }), 'pending')).toBe(true);
    expect(matchesHuntFilter(app({ status: 'submitted' }), 'pending')).toBe(false);
  });

  test('website-only hunts only count as judged', () => {
    expect(matchesHuntFilter(site(), 'judged')).toBe(true);
    expect(matchesHuntFilter(site(), 'pending')).toBe(false);
    expect(matchesHuntFilter(site(), 'all')).toBe(true);
  });
});

test('huntItemKey: report id, or site- plus the hunt id', () => {
  expect(huntItemKey(app())).toBe('r1');
  expect(huntItemKey(site())).toBe('site-h1');
});

test('huntFilterCounts counts every filter', () => {
  const items = [app(), app({ _id: 'r2', status: 'overdue' }), app({ _id: 'r3', status: 'submitted' }), app({ _id: 'r4', ...judged }), site()];
  expect(huntFilterCounts(items)).toEqual({ all: 5, pending: 2, submitted: 1, judged: 2 });
});

test('huntAreaTotals: areas with hunts in area order, with their points', () => {
  const items = [site(), app({ ...judged }), app({ _id: 'r2' })];
  expect(huntAreaTotals(items)).toEqual([
    { area: 'alpha', label: 'Alpha', count: 2, points: 10 },
    { area: 'bravo', label: 'Bravo', count: 1, points: 10 },
  ]);
});

describe('huntRowStatus', () => {
  test('nothing while the photo is being read (the title shows the spinner)', () => {
    expect(huntRowStatus(report({ ocrStatus: 'reading' }), BEFORE)).toBeNull();
  });

  test('to submit: countdown, urgent in the last 5 minutes', () => {
    expect(huntRowStatus(report(), BEFORE)).toEqual({ tone: 'to_submit', text: 'Te versturen · 8:42', urgent: false });
    expect(huntRowStatus(report(), Date.parse('2026-10-17T12:26:00.000Z'))).toEqual({ tone: 'to_submit', text: 'Te versturen · 4:00', urgent: true });
  });

  test('turns overdue locally once the deadline passed', () => {
    expect(huntRowStatus(report(), Date.parse('2026-10-17T12:31:00.000Z'))).toEqual({ tone: 'overdue', text: 'Te laat!', urgent: false });
  });

  test('submitted and judged', () => {
    expect(huntRowStatus(report({ status: 'submitted' }), BEFORE)).toEqual({ tone: 'submitted', text: 'Ingestuurd', urgent: false });
    expect(huntRowStatus(report(judged), BEFORE)).toEqual({ tone: 'judged', text: 'Goedgekeurd', urgent: false });
    expect(huntRowStatus(report({ ...judged, site: { status: 'Afgekeurd', points: 0, seenAt: '' } }), BEFORE)).toEqual({ tone: 'rejected', text: 'Afgekeurd', urgent: false });
    expect(huntRowStatus(report({ ...judged, site: { status: '', points: 5, seenAt: '' } }), BEFORE)?.text).toBe('Beoordeeld');
  });
});

test('websiteHuntStatus: the site status, red without points', () => {
  expect(websiteHuntStatus(hunt())).toEqual({ tone: 'judged', text: 'Goedgekeurd', urgent: false });
  expect(websiteHuntStatus(hunt({ status: 'Afgekeurd', points: 0 }))).toEqual({ tone: 'rejected', text: 'Afgekeurd', urgent: false });
});

test('huntRowFlag: review first, then duplicate, nothing while reading', () => {
  expect(huntRowFlag(report())).toBeNull();
  expect(huntRowFlag(report({ needsReview: true }))).toBe('controleren');
  expect(huntRowFlag(report({ duplicateOf: { id: 'r0', reportedByName: 'Jesse' } }))).toBe('dubbel?');
  expect(huntRowFlag(report({ needsReview: true, ocrStatus: 'reading' }))).toBeNull();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx --yes bun test src/lib/hunt-list.test.ts`
Expected: FAIL — `Cannot find module './hunt-list'` (or similar).

- [ ] **Step 3: Implement `src/lib/hunt-list.ts`**

```ts
import { formatCountdown } from '@/lib/format';
import { currentHuntStatus, isReading } from '@/lib/hunt-reports';
import { areaOptions } from '@/lib/utils';
import type { Hunt } from '@/types/Hunt';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';

/** The status filters of "Alle hunts" (nav items, in order). */
export type HuntFilter = 'all' | 'pending' | 'submitted' | 'judged';
export const HUNT_FILTERS: HuntFilter[] = ['all', 'pending', 'submitted', 'judged'];
export const HUNT_FILTER_LABELS: Record<HuntFilter, string> = { all: 'Alles', pending: 'Te versturen', submitted: 'Ingestuurd', judged: 'Beoordeeld' };

/** Website-only hunts are already judged on jotihunt.nl, so they only show under Alles and Beoordeeld. */
export function matchesHuntFilter(item: HuntListItem, filter: HuntFilter): boolean {
  if (filter === 'all') return true;
  if (item.source === 'website') return filter === 'judged';
  const status = item.report.status;
  if (filter === 'pending') return status === 'to_submit' || status === 'overdue';
  return status === filter;
}

export const huntItemKey = (item: HuntListItem) => (item.source === 'app' ? item.report._id : `site-${item.hunt._id}`);
export const huntItemArea = (item: HuntListItem) => (item.source === 'app' ? item.report.area : item.hunt.area).trim().toLowerCase();
export const huntItemPoints = (item: HuntListItem) => (item.source === 'app' ? (item.report.site?.points ?? 0) : item.hunt.points);

export function huntFilterCounts(items: HuntListItem[]): Record<HuntFilter, number> {
  return Object.fromEntries(HUNT_FILTERS.map((filter) => [filter, items.filter((item) => matchesHuntFilter(item, filter)).length])) as Record<HuntFilter, number>;
}

export interface HuntAreaTotal {
  /** Lowercase area name, e.g. "alpha" */
  area: string;
  label: string;
  count: number;
  points: number;
}

/** Hunts and points per area, in area order; areas without hunts are left out. */
export function huntAreaTotals(items: HuntListItem[]): HuntAreaTotal[] {
  return areaOptions
    .map((option) => {
      const inArea = items.filter((item) => huntItemArea(item) === option.value);
      return { area: option.value, label: option.label, count: inArea.length, points: inArea.reduce((sum, item) => sum + huntItemPoints(item), 0) };
    })
    .filter((total) => total.count > 0);
}

/** Colour of the status text in a row's meta line; `rejected` = judged without points. */
export type HuntRowTone = 'to_submit' | 'overdue' | 'submitted' | 'judged' | 'rejected';

export interface HuntRowStatus {
  tone: HuntRowTone;
  /** "Te versturen · 8:42", "Te laat!", "Ingestuurd", or the jotihunt.nl status ("Goedgekeurd") */
  text: string;
  /** Less than 5 minutes left to submit: the text pulses */
  urgent: boolean;
}

const URGENT_MS = 5 * 60_000;

/** Status at the start of a row's meta line; null while the photo is being read (the title shows "Wordt gelezen…"). */
export function huntRowStatus(report: HuntReport, now: number): HuntRowStatus | null {
  if (isReading(report)) return null;
  switch (currentHuntStatus(report, now)) {
    case 'to_submit': {
      const left = new Date(report.deadline).getTime() - now;
      return { tone: 'to_submit', text: `Te versturen · ${formatCountdown(left)}`, urgent: left < URGENT_MS };
    }
    case 'overdue':
      return { tone: 'overdue', text: 'Te laat!', urgent: false };
    case 'submitted':
      return { tone: 'submitted', text: 'Ingestuurd', urgent: false };
    case 'judged':
      return { tone: report.site?.points ? 'judged' : 'rejected', text: report.site?.status || 'Beoordeeld', urgent: false };
  }
}

export function websiteHuntStatus(hunt: Hunt): HuntRowStatus {
  return { tone: hunt.points ? 'judged' : 'rejected', text: hunt.status || 'Beoordeeld', urgent: false };
}

/** Amber word at the end of the meta line: HQ should check this report. */
export function huntRowFlag(report: HuntReport): 'controleren' | 'dubbel?' | null {
  if (report.needsReview && !isReading(report)) return 'controleren';
  if (report.duplicateOf) return 'dubbel?';
  return null;
}

export const HUNT_ROW_TONE_CLASS: Record<HuntRowTone, string> = {
  to_submit: 'text-amber-700 dark:text-amber-300',
  overdue: 'text-red-700 dark:text-red-300',
  submitted: 'text-blue-700 dark:text-blue-300',
  judged: 'text-green-700 dark:text-green-400',
  rejected: 'text-red-700 dark:text-red-300',
};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx --yes bun test src/lib/hunt-list.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/lib/hunt-list.ts src/lib/hunt-list.test.ts --max-warnings 0
git add src/lib/hunt-list.ts src/lib/hunt-list.test.ts
git commit -m "feat(hunts): list logic for the Alle hunts window (filters, area totals, row status text)"
```

---

### Task 2: Shared Beheer pieces (controlled rows, unfold body, nav item, slide)

**Files:**
- Create: `src/components/beheer/WindowNav.tsx`
- Modify: `src/components/beheer/BeheerLayout.tsx` (`BeheerRows`, `BeheerExpandableRow`)
- Modify: `src/components/beheer/controls/Pill.tsx` (IconPill variant)
- Modify: `src/components/beheer/BeheerDialog.tsx` (use the extracted pieces)
- Modify: `src/lib/motion.ts` (slide variants)

**Interfaces:**
- Produces:
  - `BeheerRows` props gain `openId?: string | null` and `onOpenIdChange?: (id: string | null) => void` (controlled when `openId !== undefined`).
  - `BeheerExpandableRow` prop `bodyClassName?: string` — replaces the unfolded part's default classes.
  - `IconPill` variant `'danger-soft'`.
  - `src/components/beheer/WindowNav.tsx`: `export type NavIcon = ComponentType<{ className?: string }>`; `export function NavItem(props: { icon?: NavIcon; leading?: ReactNode; title: string; active?: boolean; trailing?: ReactNode; indicatorId?: string; onClick: () => void; className?: string })`.
  - `src/lib/motion.ts`: `PANE_SLIDE` (variants with `enter`/`center`/`exit`, custom = direction) and `PANE_SLIDE_TRANSITION`.

- [ ] **Step 1: Controlled `BeheerRows` and `bodyClassName`**

In `src/components/beheer/BeheerLayout.tsx` replace `BeheerRows` with:

```tsx
/**
 * A card's rows: separate tonal blocks 2px apart, outer corners 16px and inner 6px (M3 segmented list). Rows fold in
 * and out (children must be keyed rows); at most one BeheerExpandableRow inside is open. Pass `openId` +
 * `onOpenIdChange` to control which one (e.g. a window that opens on a given row).
 */
export function BeheerRows({ children, className, openId: controlledOpenId, onOpenIdChange }: { children: ReactNode; className?: string; openId?: string | null; onOpenIdChange?: (id: string | null) => void }) {
  const [ownOpenId, setOwnOpenId] = useState<string | null>(null);
  const openId = controlledOpenId !== undefined ? controlledOpenId : ownOpenId;
  const setOpenId = onOpenIdChange ?? setOwnOpenId;
  return (
    <RowsContext.Provider value={{ openId, setOpenId }}>
      <div className={cn('flex flex-col gap-0.5', className)}>
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </div>
    </RowsContext.Provider>
  );
}
```

In `BeheerExpandableRowProps` add after `indentClassName`:

```tsx
  /** Replaces the unfolded part's classes (default: a wrapping row of pills), e.g. a column of photo, facts and actions */
  bodyClassName?: string;
```

Add `bodyClassName` to the destructured props of `BeheerExpandableRow`, and change the unfolded line to:

```tsx
              <Reveal>{open && <div className={bodyClassName ?? cn('flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-3', indentClassName)}>{children}</div>}</Reveal>
```

- [ ] **Step 2: `danger-soft` IconPill**

In `src/components/beheer/controls/Pill.tsx`, in the `iconPill` cva `variant` map, add after `active`:

```ts
        'danger-soft': 'bg-destructive/15 text-destructive hover:bg-destructive/20 dark:text-red-300',
```

- [ ] **Step 3: Move the phone slide into `lib/motion.ts`**

Append to `src/lib/motion.ts`:

```ts
/** Phone windows (Beheer, Alle hunts): the list slides out one way and the pane in from the other (and back); custom = direction */
export const PANE_SLIDE = {
  enter: (direction: number) => ({ opacity: 0, x: 24 * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: -24 * direction }),
};
export const PANE_SLIDE_TRANSITION: Transition = { duration: 0.22, ease: EASE_OUT };
```

- [ ] **Step 4: Extract the nav item to `WindowNav.tsx`**

Create `src/components/beheer/WindowNav.tsx` (moved from `BeheerDialog.tsx`, plus `leading` for items without an icon, e.g. an area dot):

```tsx
import type { ComponentType, ReactNode } from 'react';
import { motion } from 'motion/react';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type NavIcon = ComponentType<{ className?: string }>;

interface NavItemProps {
  icon?: NavIcon;
  /** Instead of an icon, e.g. an area dot; give it the icon's 18px box so titles line up */
  leading?: ReactNode;
  title: string;
  active?: boolean;
  trailing?: ReactNode;
  /** layoutId of the soft fill behind the active item, so it slides to a newly picked item */
  indicatorId?: string;
  onClick: () => void;
  className?: string;
}

/** N1 item of a window's nav: icon + name, 40px, rounded-xl; active = soft grey fill + semibold (no pill, no orange). */
export function NavItem({ icon: ItemIcon, leading, title, active, trailing, indicatorId, onClick, className }: NavItemProps) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'relative flex h-10 items-center rounded-xl px-3 text-left text-[13.5px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:bg-beheer-row-high/50 hover:text-foreground active:bg-beheer-row-high',
        className,
      )}
    >
      {active && indicatorId && <motion.span layoutId={indicatorId} aria-hidden className="absolute inset-0 rounded-xl bg-beheer-row-high" transition={SWAP_TRANSITION} />}
      <span className="relative flex min-w-0 flex-1 items-center gap-3">
        {ItemIcon ? <ItemIcon className="size-[18px] shrink-0" /> : leading}
        <span className="truncate">{title}</span>
        {trailing}
      </span>
    </button>
  );
}
```

In `src/components/beheer/BeheerDialog.tsx`:
- Delete the local `type Icon`, `SLIDE`, `SLIDE_TRANSITION`, `NavItemProps` and `NavItem` definitions.
- Add imports: `import { NavItem, type NavIcon } from './WindowNav';` and add `PANE_SLIDE, PANE_SLIDE_TRANSITION` to the `@/lib/motion` import (drop `EASE_OUT` if no longer used; drop `ComponentType` from the react import if unused).
- `SECTIONS` type becomes `{ id: AdminDialogId; title: string; icon: NavIcon }[]`.
- Replace `variants={SLIDE}` with `variants={PANE_SLIDE}` and `transition={SLIDE_TRANSITION}` with `transition={PANE_SLIDE_TRANSITION}` (both motion.divs).
- Remove `motion`/`SWAP_TRANSITION`/`cn` imports only if the type checker/linter reports them unused.

- [ ] **Step 5: Type check, lint, existing tests**

Run: `npx tsc -b && npx eslint src/components/beheer src/lib/motion.ts --max-warnings 0 && npx --yes bun test`
Expected: no type errors, no lint output, all tests pass. Beheer looks and behaves the same (no visual change).

- [ ] **Step 6: Commit**

```bash
git add src/components/beheer src/lib/motion.ts
git commit -m "refactor(beheer): shareable nav item + pane slide, controlled open row, custom unfold body"
```

---

### Task 3: `HuntMarkerIcon` (the map's hunt marker as a row icon)

**Files:**
- Create: `src/components/hunts/HuntMarkerIcon.tsx`

**Interfaces:**
- Consumes: `useMarkerPalette` (`@/components/layers/marker-icons`), `MarkerGlyph` (`@/components/map/popup/MarkerGlyph`), `cookiePath`, `MARKER_COOKIE_DEPTH` (`@/lib/cookie-shape`), `areaKey`, `areaLetter` (`@/lib/marker-style`), `getColorFromArea` (`@/lib/utils`).
- Produces: `default function HuntMarkerIcon({ area, website }: { area: string; website?: boolean })` — 48×48, `aria-hidden`.

- [ ] **Step 1: Write the component**

```tsx
import { useMemo } from 'react';
import { GlobeIcon } from 'lucide-react';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import MarkerGlyph from '@/components/map/popup/MarkerGlyph';
import { cookiePath, MARKER_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { areaKey, areaLetter } from '@/lib/marker-style';
import { getColorFromArea } from '@/lib/utils';

const SIZE = 48;

/**
 * The map's hunt marker as a list icon: camera on the tertiary-container cookie with the area letter in a badge
 * (bottom right). Website-only hunts (no photo): a globe on the neutral cookie.
 */
export default function HuntMarkerIcon({ area, website = false }: { area: string; website?: boolean }) {
  const palette = useMarkerPalette();
  const path = useMemo(() => cookiePath(SIZE, MARKER_COOKIE_DEPTH), []);
  const key = areaKey(area);
  const letter = key ? areaLetter(key) : '';
  const fill = website ? palette.surfaceContainerHighest : palette.tertiaryContainer;
  const on = website ? palette.onSurfaceVariant : palette.onTertiaryContainer;

  return (
    <span aria-hidden className="relative grid size-12 shrink-0 place-items-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 overflow-visible drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)]">
        <path d={path} fill={fill} />
      </svg>
      <span className="relative grid place-items-center [&_svg]:size-6" style={{ color: on }}>
        {website ? <GlobeIcon /> : <MarkerGlyph name="photo_camera" />}
      </span>
      {letter && (
        <span
          className="absolute -right-[3px] -bottom-[3px] grid size-[18px] place-items-center rounded-full text-[10.5px] font-extrabold"
          style={{ background: palette.surfaceContainerLowest, color: getColorFromArea(area) }}
        >
          {letter}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Type check + lint**

Run: `npx tsc -b && npx eslint src/components/hunts/HuntMarkerIcon.tsx --max-warnings 0`
Expected: clean. (`photo_camera` is a `GlyphName`; if tsc says otherwise, check `GlyphName` in `src/lib/marker-style.ts` for the exact name used by the map's hunt marker in `marker-icons.ts` → `p.glyph('photo_camera', …)`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/hunts/HuntMarkerIcon.tsx
git commit -m "feat(hunts): HuntMarkerIcon, the map's hunt marker as a row icon"
```

---

### Task 4: Hunt rows — closed row + unfolded details

**Files:**
- Create: `src/components/hunts/HuntListRow.tsx`
- Create: `src/components/hunts/HuntRowDetails.tsx`
- Modify: `src/components/hunts/HuntInlineEdit.tsx` (`RereadButton` → `IconPill`)

**Interfaces:**
- Consumes: Task 1 (`huntRowStatus`, `websiteHuntStatus`, `huntRowFlag`, `HUNT_ROW_TONE_CLASS`, `type HuntRowStatus`), Task 2 (`BeheerExpandableRow` `bodyClassName`, `IconPill` `danger-soft`), Task 3 (`HuntMarkerIcon`); existing `BeheerRow`, `InlineConfirm`, `Pill`, `IconPill`, `HuntCodeText`, `HuntTimeText`, `EditCode`, `EditTime`, `StickerHero`, `ImageLightbox`, `Reveal`, `useAuthImage`, `useHuntReports` (`setSubmitted`, `deleteReport`), `useInterval`.
- Produces:
  - `default HuntListRow({ item }: { item: HuntListItem })` — memoised; renders a `RowFrame`-based row (put it directly inside `BeheerRows` with `key={huntItemKey(item)}`). App reports expand (row id = `report._id`); website-only hunts are a plain `BeheerRow`.
  - `default HuntRowDetails({ report, onDelete }: { report: HuntReport; onDelete: () => void })`.
  - `RereadButton({ report }: { report: HuntReport })` (the `size` prop is removed).

- [ ] **Step 1: `RereadButton` as an `IconPill`**

In `src/components/hunts/HuntInlineEdit.tsx`, replace `RereadButton` with (and add `import { IconPill } from '@/components/beheer/controls/Pill';`; `IconAction` stays imported for `SaveCancel`/pencils):

```tsx
/** Refresh button: the AI reads the photo again (code and time, also values entered by hand). Admins only. */
export function RereadButton({ report }: { report: HuntReport }) {
  const { rereadReport } = useHuntReports();
  const [busy, setBusy] = useState(false);
  const reading = isReading(report);
  const label = reading ? 'Wordt gelezen…' : 'Opnieuw laten lezen door AI';

  async function reread() {
    setBusy(true);
    try {
      await rereadReport(report._id);
      toast('De foto wordt opnieuw gelezen');
    } catch (error) {
      toast.error('Opnieuw lezen is mislukt', { description: apiErrorMessage(error, 'Probeer het opnieuw.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <IconPill variant="soft" aria-label={label} title={label} onClick={() => void reread()} disabled={busy || reading}>
      <RefreshCwIcon className={reading || busy ? 'animate-spin' : undefined} />
    </IconPill>
  );
}
```

(`HuntDetail.tsx` still passes `size="icon-sm"`; it is deleted in Task 5. Until then remove that prop there so tsc passes: change `<RereadButton report={report} size="icon-sm" />` to `<RereadButton report={report} />`.)

- [ ] **Step 2: `HuntRowDetails.tsx` (the unfolded part)**

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DownloadIcon, Loader2Icon, PencilIcon, SendIcon, Trash2Icon, TriangleAlertIcon, Undo2Icon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { toast } from 'sonner';
import { IconPill, Pill } from '@/components/beheer/controls/Pill';
import ImageLightbox from '@/components/ImageLightbox';
import Reveal from '@/components/motion/Reveal';
import { useAuthImage } from '@/hooks/auth-image.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { formatClock } from '@/lib/format';
import { huntSourceLabel, isReading, readFailed } from '@/lib/hunt-reports';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import type { User } from '@/types/User';
import HuntCodeText, { HuntTimeText } from './HuntCodeText';
import { EditCode, EditTime, RereadButton } from './HuntInlineEdit';
import StickerHero from './StickerHero';

/** The parent column's gap (gap-2.5), so the edit box folding away leaves no gap behind */
const GAP = 10;

/** One fact tile: small uppercase label, one truncated line. */
function Fact({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-black/5 px-3 py-2 dark:bg-black/15">
      <div className="text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className={cn('truncate text-[13px] font-semibold', className)}>{children}</div>
    </div>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-amber-500/12 px-3 py-2 text-[12.5px] font-medium text-amber-700 dark:text-amber-300">
      <TriangleAlertIcon className="size-4 shrink-0" />
      {children}
    </p>
  );
}

/** A hunt row's unfolded part: the photo zoomed on the sticker, facts, warnings and the actions (admins: edit, re-read, delete, submit). */
export default function HuntRowDetails({ report, onDelete }: { report: HuntReport; onDelete: () => void }) {
  const user = useAuthUser<User>();
  const { setSubmitted } = useHuntReports();
  const photo = useAuthImage(report.photoUrl);
  const ref = useRef<HTMLDivElement>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  /** Which field is being edited inline */
  const [editing, setEditing] = useState<'code' | 'time' | null>(null);
  const [busy, setBusy] = useState(false);
  // Status changes, edits and deleting are HQ work: admins only (the server enforces this too)
  const isAdmin = !!user?.admin;
  const canDelete = isAdmin && !report.submittedAt && !report.site;
  const codeLabel = report.huntCode ?? 'zonder code';
  // Once submitted, who sent it in matters more than where the code came from
  const showSubmitter = report.status === 'submitted' || report.status === 'judged';
  const sourceLabel = huntSourceLabel(report, isAdmin);

  // Bring the row into view once it has unfolded (also when the window opens on this hunt)
  useEffect(() => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' }), 250);
    return () => clearTimeout(timer);
  }, []);

  async function changeSubmitted(submitted: boolean) {
    setBusy(true);
    try {
      await setSubmitted(report._id, submitted);
      toast.success(submitted ? 'Gemarkeerd als ingestuurd' : 'Teruggezet naar te versturen');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opslaan is mislukt'));
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!photo) return;
    const link = document.createElement('a');
    link.href = photo;
    link.download = `hunt-${report.huntCode ?? report._id}.jpg`;
    link.click();
  }

  const submitAction = !report.submittedAt ? 'submit' : report.status !== 'judged' ? 'undo' : null;

  return (
    <div ref={ref} className="flex flex-col gap-2.5">
      {photo ? (
        <button
          type="button"
          className="block w-full cursor-zoom-in overflow-hidden rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => setZoomOpen(true)}
          aria-label="Foto vergroten"
        >
          <StickerHero src={photo} box={report.stickerBox} alt={`Foto van hunt ${codeLabel}`} className="h-[190px] max-md:h-[170px]" />
        </button>
      ) : (
        <div className="flex h-[190px] items-center justify-center rounded-2xl bg-black/5 text-sm text-muted-foreground max-md:h-[170px] dark:bg-black/15">Foto laden…</div>
      )}

      {isAdmin && (
        <Reveal gap={GAP}>
          {editOpen && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-primary/8 px-3 py-2 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Code</span>
                {editing !== 'code' && <HuntCodeText report={report} />}
                <EditCode report={report} editing={editing === 'code'} onEditingChange={(on) => setEditing(on ? 'code' : null)} />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Tijd</span>
                {editing !== 'time' && <HuntTimeText report={report} className="font-mono" />}
                <EditTime report={report} editing={editing === 'time'} onEditingChange={(on) => setEditing(on ? 'time' : null)} />
              </span>
            </div>
          )}
        </Reveal>
      )}

      <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-[14px] max-md:grid-cols-1">
        <Fact label="Gemeld door">
          {report.reportedByName} · {formatClock(report.createdAt)}
        </Fact>
        {showSubmitter ? (
          <Fact label="Ingestuurd door">{report.submittedAt ? `${report.submittedByName ?? 'Onbekend'} · ${formatClock(report.submittedAt)}` : '–'}</Fact>
        ) : (
          <Fact label="Bron" className={readFailed(report) ? 'text-destructive dark:text-red-300' : 'font-medium text-muted-foreground'}>
            <span title={sourceLabel}>{sourceLabel}</span>
          </Fact>
        )}
        <Fact
          label="jotihunt.nl"
          className={report.site ? (report.site.points > 0 ? 'text-green-700 dark:text-green-400' : 'text-destructive dark:text-red-300') : 'font-medium text-muted-foreground'}
        >
          {report.site ? `${report.site.status} · ${report.site.points} pt` : 'Nog niet beoordeeld'}
        </Fact>
      </div>

      {report.duplicateOf && <Warning>Zelfde code als hunt van {report.duplicateOf.reportedByName}</Warning>}
      {report.needsReview && !isReading(report) && <Warning>Controleer de code en tijd met de foto.</Warning>}

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill variant="secondary" disabled={!photo} onClick={download}>
          <DownloadIcon />
          Foto
        </Pill>
        {isAdmin && (
          <Pill
            variant="secondary"
            aria-pressed={editOpen}
            className={cn(editOpen && 'bg-primary/20 text-orange-700 hover:bg-primary/25 dark:text-orange-300')}
            onClick={() => {
              setEditOpen(!editOpen);
              setEditing(null);
            }}
          >
            <PencilIcon />
            Bewerken
          </Pill>
        )}
        {isAdmin && <RereadButton report={report} />}
        {canDelete && (
          <IconPill variant="danger-soft" aria-label="Verwijderen" title="Verwijderen" onClick={onDelete}>
            <Trash2Icon />
          </IconPill>
        )}
        {isAdmin && submitAction && (
          <span className="ml-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={submitAction} className="inline-flex" {...SWAP}>
                {submitAction === 'submit' ? (
                  <Pill variant="primary" size="md" disabled={busy} morphKey={busy ? 'busy' : 'idle'} onClick={() => void changeSubmitted(true)}>
                    {busy ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                    Ingestuurd
                  </Pill>
                ) : (
                  <Pill variant="secondary" disabled={busy} morphKey={busy ? 'busy' : 'idle'} onClick={() => void changeSubmitted(false)}>
                    {busy ? <Loader2Icon className="animate-spin" /> : <Undo2Icon />}
                    Terugzetten
                  </Pill>
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </div>

      {photo && <ImageLightbox src={photo} alt={`Foto van hunt ${codeLabel}`} open={zoomOpen} onOpenChange={setZoomOpen} />}
    </div>
  );
}
```

- [ ] **Step 3: `HuntListRow.tsx` (the closed row)**

```tsx
import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { BeheerExpandableRow, BeheerRow, InlineConfirm } from '@/components/beheer/BeheerLayout';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { HUNT_ROW_TONE_CLASS, huntRowFlag, huntRowStatus, websiteHuntStatus, type HuntRowStatus } from '@/lib/hunt-list';
import { formatHuntTimeSafe, hasLiveCountdown, huntTimeLabel } from '@/lib/hunt-reports';
import { capitalizeFirstLetter, cn } from '@/lib/utils';
import type { Hunt } from '@/types/Hunt';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';
import HuntCodeText from './HuntCodeText';
import HuntMarkerIcon from './HuntMarkerIcon';
import HuntRowDetails from './HuntRowDetails';

/** Coloured status at the start of the meta line; fades over when the status changes, pulses in the last 5 minutes. */
function StatusText({ status }: { status: HuntRowStatus }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status.tone}
        className={cn('font-semibold', HUNT_ROW_TONE_CLASS[status.tone], status.urgent && 'motion-safe:animate-pulse')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {status.text}
      </motion.span>
    </AnimatePresence>
  );
}

/** "Te versturen · 8:42 · Alpha · 14:05 · Merida · controleren", with its own clock: only rows with a running countdown tick. */
function ReportMeta({ report }: { report: HuntReport }) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), hasLiveCountdown(report, now) ? 1000 : null);
  const status = huntRowStatus(report, now);
  const flag = huntRowFlag(report);
  return (
    <span className="block truncate">
      {status && (
        <>
          <StatusText status={status} />
          {' · '}
        </>
      )}
      {capitalizeFirstLetter(report.area)} · {huntTimeLabel(report)} · {report.reportedByName}
      {flag && <span className="text-amber-700 dark:text-amber-300"> · {flag}</span>}
    </span>
  );
}

function Points({ points }: { points: number }) {
  return <span className={cn('text-sm font-bold tabular-nums', points > 0 ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground')}>{points} pt</span>;
}

function ReportRow({ report }: { report: HuntReport }) {
  const { deleteReport } = useHuntReports();
  const [confirming, setConfirming] = useState(false);
  const codeLabel = report.huntCode ?? 'zonder code';

  async function remove() {
    try {
      await deleteReport(report._id);
      toast.success('Hunt verwijderd');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Verwijderen is mislukt'));
      setConfirming(false);
    }
  }

  return (
    <BeheerExpandableRow
      id={report._id}
      leading={<HuntMarkerIcon area={report.area} />}
      title={<HuntCodeText report={report} />}
      meta={<ReportMeta report={report} />}
      trailing={report.status === 'judged' && report.site ? <Points points={report.site.points} /> : undefined}
      bodyClassName="flex flex-col px-3 pt-1 pb-3"
      confirm={
        confirming ? (
          <InlineConfirm
            title={`Hunt ${codeLabel} verwijderen?`}
            description="De foto wordt ook verwijderd."
            confirmLabel="Verwijderen"
            confirmIcon={<Trash2Icon />}
            onCancel={() => setConfirming(false)}
            onConfirm={remove}
          />
        ) : undefined
      }
    >
      <HuntRowDetails report={report} onDelete={() => setConfirming(true)} />
    </BeheerExpandableRow>
  );
}

/** A jotihunt.nl hunt nobody registered in the app: no photo or actions, so the row doesn't open. */
function WebsiteRow({ hunt }: { hunt: Hunt }) {
  return (
    <BeheerRow
      leading={<HuntMarkerIcon area={hunt.area} website />}
      title={<span className="truncate font-mono font-bold">{hunt.huntCode}</span>}
      meta={
        <span className="block truncate">
          <StatusText status={websiteHuntStatus(hunt)} /> · {capitalizeFirstLetter(hunt.area.trim())} · {formatHuntTimeSafe(hunt.huntTime)} · jotihunt.nl
        </span>
      }
    >
      <Points points={hunt.points} />
    </BeheerRow>
  );
}

/** One row of "Alle hunts": the hunt marker, code, status + area · time · reporter; own reports open to photo, facts and actions. */
const HuntListRow = memo(function HuntListRow({ item }: { item: HuntListItem }) {
  return item.source === 'website' ? <WebsiteRow hunt={item.hunt} /> : <ReportRow report={item.report} />;
});

export default HuntListRow;
```

Note: `BeheerExpandableRow`'s header title wrapper is `text-[13.5px] font-semibold`; `HuntCodeText` adds `font-mono font-bold` for codes. `ReportMeta` sits in the row's `text-xs text-muted-foreground` meta slot.

- [ ] **Step 4: Type check + lint**

Run: `npx tsc -b && npx eslint src/components/hunts --max-warnings 0`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/hunts/HuntListRow.tsx src/components/hunts/HuntRowDetails.tsx src/components/hunts/HuntInlineEdit.tsx src/components/hunts/HuntDetail.tsx
git commit -m "feat(hunts): hunt rows with the marker icon, status in the meta line, unfolding to photo, facts and actions"
```

---

### Task 5: The new "Alle hunts" window; remove the old detail

**Files:**
- Modify (rewrite): `src/components/hunts/AllHuntsDialog.tsx`
- Delete: `src/components/hunts/HuntDetail.tsx`, `src/components/hunts/HuntStatusBadge.tsx`

**Interfaces:**
- Consumes: Task 1 (`HUNT_FILTERS`, `HUNT_FILTER_LABELS`, `huntAreaTotals`, `huntFilterCounts`, `huntItemArea`, `huntItemKey`, `huntItemPoints`, `matchesHuntFilter`, `type HuntFilter`), Task 2 (`BeheerRows` `openId`/`onOpenIdChange`, `NavItem`, `type NavIcon`, `PANE_SLIDE`, `PANE_SLIDE_TRANSITION`), Task 4 (`HuntListRow`); `ResponsiveDialog`, `BeheerPane`, `BeheerCard`, `CountSwap`, `Pill`, `IconPill`, `useHuntReports`, `useHunts`, `useIsMobile`, `huntListItems`.
- Produces: `default AllHuntsDialog({ open, onOpenChange, initialReportId }: { open: boolean; onOpenChange: (open: boolean) => void; initialReportId?: string })` — same signature as today, so `HuntsSection.tsx` needs no change.

- [ ] **Step 1: Rewrite `AllHuntsDialog.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeftIcon, InboxIcon, ListIcon, SendIcon, StarIcon } from 'lucide-react';
import { BeheerCard, BeheerPane, BeheerRows, CountSwap } from '@/components/beheer/BeheerLayout';
import { IconPill, Pill } from '@/components/beheer/controls/Pill';
import { NavItem, type NavIcon } from '@/components/beheer/WindowNav';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { HUNT_FILTER_LABELS, HUNT_FILTERS, huntAreaTotals, huntFilterCounts, huntItemArea, huntItemKey, huntItemPoints, matchesHuntFilter, type HuntFilter } from '@/lib/hunt-list';
import { huntListItems } from '@/lib/hunt-reports';
import { PANE_SLIDE, PANE_SLIDE_TRANSITION, SWAP } from '@/lib/motion';
import { cn, getColorFromArea } from '@/lib/utils';
import HuntListRow from './HuntListRow';

/** Rows rendered at first (and added per "Meer laden"), so a long list opens quickly. */
const PAGE_SIZE = 200;

const FILTER_ICONS: Record<HuntFilter, NavIcon> = { all: ListIcon, pending: SendIcon, submitted: InboxIcon, judged: StarIcon };

/** What the list shows: a status filter, or one area (then the status filter is "all"). */
interface View {
  filter: HuntFilter;
  area: string | null;
}
const ALL: View = { filter: 'all', area: null };

/** Count right of a nav item; "Te versturen" in orange while there is work. */
function NavCount({ value, hot }: { value: number; hot?: boolean }) {
  return (
    <span className={cn('ml-auto text-xs font-bold', hot && value > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-muted-foreground')}>
      <CountSwap value={value} />
    </span>
  );
}

/** Every hunt (own reports plus website-only hunts) in a Beheer-style window: status filters and areas on the left, rows that open in place. */
export default function AllHuntsDialog({ open, onOpenChange, initialReportId }: { open: boolean; onOpenChange: (open: boolean) => void; initialReportId?: string }) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Alle hunts"
      description="Alle geregistreerde hunts en hunts van jotihunt.nl."
      hideHeader
      className="h-[640px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[960px] sm:rounded-[20px]"
      drawerClassName="bg-beheer-window"
    >
      <AllHuntsWindow open={open} initialReportId={initialReportId} />
    </ResponsiveDialog>
  );
}

/** The window's content; only mounted while the window is open (or closing). */
function AllHuntsWindow({ open, initialReportId }: { open: boolean; initialReportId?: string }) {
  const isMobile = useIsMobile();
  const { reports } = useHuntReports();
  const { hunts } = useHunts();
  const items = useMemo(() => huntListItems(reports, hunts), [reports, hunts]);
  const [view, setView] = useState<View>(ALL);
  const [openId, setOpenId] = useState<string | null>(initialReportId ?? null);
  /** Pages added with "Meer laden" */
  const [extraPages, setExtraPages] = useState(0);
  // Phone: the nav list first, unless the window was opened on a hunt
  const [phoneView, setPhoneView] = useState<'list' | 'pane'>(initialReportId ? 'pane' : 'list');
  const [direction, setDirection] = useState(1);
  // Reopened before the close finished (the content stays mounted then): start over like a fresh open
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView(ALL);
      setOpenId(initialReportId ?? null);
      setExtraPages(0);
      setPhoneView(initialReportId ? 'pane' : 'list');
    }
  }

  const counts = useMemo(() => huntFilterCounts(items), [items]);
  const areas = useMemo(() => huntAreaTotals(items), [items]);
  const shown = useMemo(() => items.filter((item) => matchesHuntFilter(item, view.filter) && (!view.area || huntItemArea(item) === view.area)), [items, view]);
  // The hunt the window opened on must be on the first page
  const initialIndex = initialReportId ? shown.findIndex((item) => huntItemKey(item) === initialReportId) : -1;
  const limit = Math.max(PAGE_SIZE, initialIndex + 1) + extraPages * PAGE_SIZE;
  const points = shown.reduce((sum, item) => sum + huntItemPoints(item), 0);
  const title = view.area ? (areas.find((area) => area.area === view.area)?.label ?? view.area) : HUNT_FILTER_LABELS[view.filter];
  const description = `${shown.length} hunts · ${view.area ? '' : 'totaal '}${points} pt`;

  function select(next: View) {
    setView(next);
    setOpenId(null);
    setExtraPages(0);
    setDirection(1);
    setPhoneView('pane');
  }

  function back() {
    setDirection(-1);
    setPhoneView('list');
  }

  const navItems = (phone: boolean) => (
    <>
      {HUNT_FILTERS.map((filter) => (
        <NavItem
          key={filter}
          icon={FILTER_ICONS[filter]}
          title={HUNT_FILTER_LABELS[filter]}
          active={!phone && !view.area && view.filter === filter}
          indicatorId={phone ? undefined : 'hunts-nav-active'}
          onClick={() => select({ filter, area: null })}
          trailing={<NavCount value={counts[filter]} hot={filter === 'pending'} />}
          className={phone ? 'h-12 text-foreground' : undefined}
        />
      ))}
      {areas.length > 0 && <div className="px-3 pt-[18px] pb-1.5 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">Deelgebieden</div>}
      {areas.map((area) => (
        <NavItem
          key={area.area}
          leading={
            <span className="grid size-[18px] shrink-0 place-items-center">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: getColorFromArea(area.area) }} />
            </span>
          }
          title={area.label}
          active={!phone && view.area === area.area}
          indicatorId={phone ? undefined : 'hunts-nav-active'}
          // Picking the active area again clears it (desktop; on phones the nav is a fresh list each time)
          onClick={() => select(!phone && view.area === area.area ? ALL : { filter: 'all', area: area.area })}
          trailing={<span className="ml-auto text-xs font-bold text-muted-foreground tabular-nums">{area.points} pt</span>}
          className={phone ? 'h-11 text-foreground' : 'h-8 text-[13px]'}
        />
      ))}
    </>
  );

  const list = (
    <BeheerPane title={title} description={description}>
      <BeheerCard>
        {shown.length ? (
          <BeheerRows openId={openId} onOpenIdChange={setOpenId}>
            {shown.slice(0, limit).map((item) => (
              <HuntListRow key={huntItemKey(item)} item={item} />
            ))}
          </BeheerRows>
        ) : (
          <p className="py-8 text-center text-[13px] text-muted-foreground">Geen hunts in deze lijst.</p>
        )}
        {shown.length > limit && (
          <div className="flex justify-center pt-3">
            <Pill variant="secondary" onClick={() => setExtraPages((pages) => pages + 1)}>
              Meer laden ({shown.length - limit} over)
            </Pill>
          </div>
        )}
      </BeheerCard>
    </BeheerPane>
  );
  const viewKey = view.area ?? view.filter;

  if (isMobile) {
    return (
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {phoneView === 'list' ? (
          <motion.nav
            key="list"
            aria-label="Hunts"
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
            custom={direction}
            variants={PANE_SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={PANE_SLIDE_TRANSITION}
          >
            <div className="px-3 pt-1 pb-3 text-lg font-bold">Hunts</div>
            {navItems(true)}
          </motion.nav>
        ) : (
          <motion.div
            key="pane"
            className="flex min-h-0 flex-1 flex-col"
            custom={direction}
            variants={PANE_SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={PANE_SLIDE_TRANSITION}
          >
            <div className="flex items-center gap-2 pb-3">
              <IconPill aria-label="Terug" onClick={back}>
                <ArrowLeftIcon />
              </IconPill>
              <span className="text-lg font-bold">{title}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">{list}</div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr] grid-rows-[minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 overflow-y-auto px-3 py-[18px]" aria-label="Hunts">
        <div className="px-3 pt-0.5 pb-3.5 text-[17px] font-bold">Hunts</div>
        {navItems(false)}
      </nav>
      <div className="min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={viewKey} className="h-full overflow-y-auto px-7 py-6" {...SWAP}>
            {list}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete the old detail and badge**

```bash
git rm src/components/hunts/HuntDetail.tsx src/components/hunts/HuntStatusBadge.tsx
```

- [ ] **Step 3: Type check, lint, tests, build**

Run: `npx tsc -b && npx eslint src --max-warnings 0 && npx --yes bun test && npx vite build`
Expected: all clean/green; build succeeds. If eslint reports now-unused exports/imports elsewhere (e.g. `huntStatusText` only used by the badge), leave lib functions that still have tests; remove only unused imports.

- [ ] **Step 4: Commit**

```bash
git add -A src/components/hunts
git commit -m "feat(hunts): Alle hunts as a Beheer-style window; rows open in place instead of a separate detail"
```

---

### Task 6: Verify in the browser

**Files:** none (fix-ups go in a follow-up commit if needed).

- [ ] **Step 1: Run the client against the local server**

Start the Vite dev server on a free port in the background (the docker stack on :8080/:3000 is the user's live instance — don't restart it): `npx vite --port 5181 --strictPort`. Open it in the preview browser and log in, or fake data: per the memory note, import axios through `/node_modules/.vite/deps/axios.js?v=…` in `preview_evaluate` and add a response interceptor that returns fixture `/hunt-reports` and `/hunts` data (keep each evaluate under 15 s).

- [ ] **Step 2: Check, in dark and light theme, at desktop width and at phone width (≤ 767px)**

- Nav: four filters with counts ("Te versturen" orange when > 0), "Deelgebieden" with dots and points; the active fill slides; picking an active area again clears it.
- Rows: hunt marker icon with the area letter; code in mono; meta line starts with the coloured status ("Te versturen · m:ss" ticking, pulsing under 5 min; "Te laat!", "Ingestuurd", site status); amber "· controleren" / "· dubbel?"; points right only when judged; website hunts with a globe and no chevron.
- Opening a row: unfolds (height), chevron turns, only one open; photo zoomed on the sticker, tap = lightbox; facts; warnings; actions. Secondary pills must stand out from the open row (`bg-beheer-row-high` on `bg-beheer-row-high`): if they don't, give the row body's pills `bg-black/5 dark:bg-white/8` and note it.
- Bewerken: edit box unfolds; code/time save; Escape cancels without closing the window.
- Delete: row turns red with the confirm; Annuleer returns; Verwijderen removes the row (it folds away).
- Ingestuurd → status text fades to "Ingestuurd", button swaps to "Terugzetten".
- Sidebar → click a hunt: the window opens with that row open and scrolled into view (phone: straight into the list).
- `prefers-reduced-motion`: no pulse.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A src
git commit -m "fix(hunts): Alle hunts window polish after browser check"
```
