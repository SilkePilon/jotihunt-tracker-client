# Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the big-card left sidebar of the main map page with a compact collapsible accordion (header countdown pill, fox pills, mini hint grid, hint entry, counter-hunt, active hunters) and a bottom sheet on mobile.

**Architecture:** Pure helpers (`lib/next-hint.ts`, `lib/fox-status.ts`, additions to `lib/hints.ts`) carry all logic and are unit-tested with `bun test`. A persisted zustand store (`sidebar.store.ts`) holds open sections and the mobile sheet snap. Small components under `src/components/sidebar/` compose existing card contents (rendered "bare", without Card chrome) inside a generic `SidebarSection`. `Sidebar` picks a desktop floating stack or a vaul bottom sheet by breakpoint.

**Tech Stack:** React 19, Vite 8, TypeScript 6, Tailwind 4 + shadcn/ui, zustand 5, SWR 2, react-router 8, vaul 1.1, MapLibre (react-map-gl/maplibre).

**Spec:** `docs/superpowers/specs/2026-09-27-sidebar-redesign-design.md`

## Global Constraints

- Repo `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client`, branch `feat/sidebar` (already checked out, stacked on `feat/maplibre`). Do not push.
- Bun is **not installed on the host**. Every `bun` command below means this shell function, run from the repo root:
  ```bash
  bun_() { docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app oven/bun:1 bun "$@"; }
  ```
- UI copy is Dutch. Code/comments English, matching existing style (JSDoc comments on functions).
- `bun test` only covers pure `src/lib/*.test.ts` files (excluded from `tsc -b` by `tsconfig.app.json`). Lib files used by tests must use `import type` for type-only imports.
- Desktop sidebar width `w-[320px]`, section gap `gap-1.5`. Default open sections: `foxes`, `hints`; closed: `hintEntry`, `counterHunt`, `hunters`.
- Mini grid shows the **last 4** hint articles, newest on top. Cell colours: solved `bg-green-500`, solving `bg-amber-400`, open `bg-muted`, none dashed outline.
- Countdown pill red in the last 5 minutes (`5 * 60 * 1000` ms). Hunt cooldown after a hunt: 1 hour.
- Mobile breakpoint: `md` (768px). Sheet snap points: peek `'200px'`, half `0.5`, full `0.92`.
- Every commit message ends with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- Deviation from spec (decided here): vaul is used directly (`import { Drawer } from 'vaul'`) instead of generating `ui/drawer.tsx`, because the sheet needs snap-point control that the shadcn wrapper doesn't add.

## File Structure

- Create `src/lib/next-hint.ts` (+ test) — last/next hint time, countdown label.
- Create `src/lib/fox-status.ts` (+ test) — last hunt per area, cooldown, status pill class, status summary.
- Modify `src/lib/hints.ts` (+ test) — `lastHintRows`, `hintProgress`.
- Modify `src/lib/utils.ts` — `filterActiveDevices`.
- Create `src/stores/sidebar.store.ts`, `src/hooks/media.hook.ts` (`useIsMobile`), `src/hooks/next-hint.hook.ts`.
- Create `src/components/sidebar/{SidebarSection,CountdownPill,SidebarHeader,FoxPills,HintMiniGrid,SidebarSections,MobileSheet,Sidebar}.tsx`.
- Modify `src/components/Settings.tsx` (single icon trigger), `src/components/cards/hint-entry/HintEntryCard.tsx` and `src/components/cards/counter-hunt/CounterHuntCard.tsx` (`bare` prop), `src/components/map/ActiveDevices.tsx` (`showLabel` prop), `src/pages/Hints.tsx` (deep link), `src/pages/App.tsx` (use Sidebar).
- Delete `src/components/cards/next-hint-time/NextHintTimeCard.tsx`, `src/components/cards/fox-status/FoxStatusCard.tsx`, `src/components/cards/fox-status/FoxStatus.tsx`, `src/stores/menu.store.ts`, and `src/components/magicui/Ripple.tsx` if no longer imported.

---

### Task 1: Pure helpers (next hint, fox status, hint rows)

**Files:**
- Create: `src/lib/next-hint.ts`, `src/lib/next-hint.test.ts`, `src/lib/fox-status.ts`, `src/lib/fox-status.test.ts`
- Modify: `src/lib/hints.ts`, `src/lib/hints.test.ts`, `src/lib/utils.ts`

**Interfaces:**
- Produces:
  - `getLastHintTime(articles?: Article[]): Date | undefined`
  - `getNextHintTime(lastHintTime: Date | undefined, huntStart: Date): Date`
  - `formatHintCountdown(ms: number): string`
  - `HUNT_COOLDOWN_MS = 3600000`, `lastHuntTimeFor(hunts: Hunt[] | undefined, areaName: string): Date | string | undefined`, `huntCooldownMs(lastHuntTime: Date | string | undefined, now: number): number`, `statusPillClass(status: string): string`, `statusSummary(areas: Area[]): string`
  - `interface HintRow { article: HintArticle; cells: Partial<Record<string, HintCell>> }`, `lastHintRows(board: HintBoard, count: number): HintRow[]`, `hintProgress(board: HintBoard): { solved: number; total: number }`
  - `filterActiveDevices(devices?: Device[]): Device[]`

- [ ] **Step 1: Write failing tests** — `src/lib/next-hint.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import type { Article } from '@/types/Article';
import { formatHintCountdown, getLastHintTime, getNextHintTime } from './next-hint';

function article(type: string, publishAt: string): Article {
  return { id: 1, title: 't', type, publishAt: new Date(publishAt), content: '', messageType: '', maxPoints: 0, endTime: new Date() };
}

describe('getLastHintTime', () => {
  test('returns the newest hint regardless of order and ignores news', () => {
    const articles = [
      article('hint', '2026-10-17T10:00:00Z'),
      article('news', '2026-10-17T13:00:00Z'),
      article('hint', '2026-10-17T12:00:00Z'),
    ];
    expect(getLastHintTime(articles)?.toISOString()).toBe('2026-10-17T12:00:00.000Z');
  });

  test('undefined without hints', () => {
    expect(getLastHintTime([article('news', '2026-10-17T10:00:00Z')])).toBeUndefined();
    expect(getLastHintTime(undefined)).toBeUndefined();
  });
});

describe('getNextHintTime', () => {
  const start = new Date('2026-10-17T08:00:00Z');

  test('hunt start when there is no hint or the hint is before the start', () => {
    expect(getNextHintTime(undefined, start).toISOString()).toBe(start.toISOString());
    expect(getNextHintTime(new Date('2026-09-21T14:00:00Z'), start).toISOString()).toBe(start.toISOString());
  });

  test('next full hour after the last hint', () => {
    expect(getNextHintTime(new Date('2026-10-17T12:04:30Z'), start).toISOString()).toBe('2026-10-17T13:00:00.000Z');
  });
});

describe('formatHintCountdown', () => {
  test('formats minutes and hours', () => {
    expect(formatHintCountdown(0)).toBe('0:00');
    expect(formatHintCountdown(-1000)).toBe('0:00');
    expect(formatHintCountdown(61_000)).toBe('1:01');
    expect(formatHintCountdown(59 * 60_000 + 59_000)).toBe('59:59');
    expect(formatHintCountdown(3 * 3_600_000 + 5 * 60_000 + 7_000)).toBe('3:05:07');
  });
});
```

`src/lib/fox-status.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import type { Area } from '@/types/Area';
import type { Hunt } from '@/types/Hunt';
import { huntCooldownMs, HUNT_COOLDOWN_MS, lastHuntTimeFor, statusPillClass, statusSummary } from './fox-status';

function hunt(area: string, status: string, huntTime: string): Hunt {
  return { _id: area + huntTime, area, huntCode: 'x', status, points: 1, huntTime: huntTime as unknown as Date, updatedAt: new Date() };
}

function area(name: string, status: string): Area {
  return { _id: name, name, status, updatedAt: '2026-10-17T10:00:00Z' };
}

describe('lastHuntTimeFor', () => {
  test('first matching hunt, case-insensitive, skipping tegenhunts', () => {
    const hunts = [hunt('alpha', 'Tegenhunt', '2026-10-17T12:00:00Z'), hunt('Alpha', 'Goedgekeurd', '2026-10-17T11:00:00Z')];
    expect(lastHuntTimeFor(hunts, 'Alpha')).toBe('2026-10-17T11:00:00Z');
    expect(lastHuntTimeFor(hunts, 'Bravo')).toBeUndefined();
    expect(lastHuntTimeFor(undefined, 'Alpha')).toBeUndefined();
  });
});

describe('huntCooldownMs', () => {
  const huntTime = '2026-10-17T11:00:00Z';
  const t = new Date(huntTime).getTime();
  test('counts down one hour after a hunt', () => {
    expect(huntCooldownMs(huntTime, t)).toBe(HUNT_COOLDOWN_MS);
    expect(huntCooldownMs(huntTime, t + 60_000)).toBe(HUNT_COOLDOWN_MS - 60_000);
    expect(huntCooldownMs(huntTime, t + HUNT_COOLDOWN_MS + 1)).toBe(0);
    expect(huntCooldownMs(undefined, t)).toBe(0);
  });
});

describe('statusPillClass / statusSummary', () => {
  test('maps statuses', () => {
    expect(statusPillClass('green')).toContain('green');
    expect(statusPillClass('orange')).toContain('orange');
    expect(statusPillClass('red')).toContain('red');
    expect(statusPillClass('unknown')).toContain('gray');
  });

  test('summarises counts in Dutch', () => {
    expect(statusSummary([area('Alpha', 'green'), area('Bravo', 'red'), area('Charlie', 'green'), area('Delta', 'orange')])).toBe(
      '2 groen · 1 oranje · 1 rood',
    );
  });
});
```

Append to `src/lib/hints.test.ts` (add `hintProgress, lastHintRows` to its import from `./hints`, and `import type { HintBoard, HintCell } from '@/types/HintCell';`):

```ts
function cell(articleId: number, area: string, status: HintCell['status']): HintCell {
  return {
    _id: `${articleId}-${area}`, articleId, area, publishAt: '', slotTime: '', status,
    check: 'unchecked', notes: [], articleChanged: false,
  };
}

describe('lastHintRows', () => {
  const board: HintBoard = {
    articles: [
      { id: 1, title: 'a', publishAt: '2026-10-17T10:00:00Z', content: '' },
      { id: 3, title: 'c', publishAt: '2026-10-17T12:00:00Z', content: '' },
      { id: 2, title: 'b', publishAt: '2026-10-17T11:00:00Z', content: '' },
    ],
    cells: [cell(3, 'alpha', 'solved'), cell(3, 'bravo', 'none'), cell(2, 'alpha', 'open')],
  };

  test('newest first, limited to count', () => {
    expect(lastHintRows(board, 2).map((row) => row.article.id)).toEqual([3, 2]);
    expect(lastHintRows(board, 10)).toHaveLength(3);
  });

  test('maps cells by area', () => {
    const [newest] = lastHintRows(board, 1);
    expect(newest.cells.alpha?.status).toBe('solved');
    expect(newest.cells.bravo?.status).toBe('none');
    expect(newest.cells.charlie).toBeUndefined();
  });

  test('hintProgress ignores none cells', () => {
    expect(hintProgress(board)).toEqual({ solved: 1, total: 2 });
  });
});
```

- [ ] **Step 2: Run to see them fail** — `bun_ test` → FAIL (modules/exports missing).

- [ ] **Step 3: Implement** — `src/lib/next-hint.ts`

```ts
import type { Article } from '@/types/Article';

/**
 * Get the publish time of the newest hint article.
 * @param articles The articles (any order)
 * @returns The newest hint time, or undefined when there are no hints
 */
export function getLastHintTime(articles?: Article[]): Date | undefined {
  const times = (articles ?? [])
    .filter((article) => article.type === 'hint')
    .map((article) => new Date(article.publishAt).getTime());
  return times.length ? new Date(Math.max(...times)) : undefined;
}

/**
 * Hints are published every full hour after the previous one, starting at the hunt start.
 * @param lastHintTime The newest hint time
 * @param huntStart The hunt start time
 * @returns When the next hint is expected
 */
export function getNextHintTime(lastHintTime: Date | undefined, huntStart: Date): Date {
  if (!lastHintTime || lastHintTime.getTime() < huntStart.getTime()) return huntStart;
  const next = new Date(lastHintTime);
  next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
  return next;
}

/**
 * Format a countdown as m:ss, or h:mm:ss from one hour.
 */
export function formatHintCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
```

`src/lib/fox-status.ts`:

```ts
import type { Area } from '@/types/Area';
import type { Hunt } from '@/types/Hunt';

export const HUNT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Time of the latest hunt on an area. Tegenhunts don't count for the cooldown (since 2024).
 * Assumes hunts are sorted newest first, as the API returns them.
 */
export function lastHuntTimeFor(hunts: Hunt[] | undefined, areaName: string): Date | string | undefined {
  return hunts
    ?.filter((hunt) => !hunt.status.toLowerCase().includes('tegenhunt'))
    .find((hunt) => hunt.area.toLowerCase() === areaName.toLowerCase())?.huntTime;
}

/**
 * Milliseconds until an area can be hunted again (0 when huntable).
 */
export function huntCooldownMs(lastHuntTime: Date | string | undefined, now: number): number {
  if (!lastHuntTime) return 0;
  return Math.max(0, new Date(lastHuntTime).getTime() + HUNT_COOLDOWN_MS - now);
}

/**
 * Tailwind classes for a fox status pill.
 */
export function statusPillClass(status: string): string {
  switch (status) {
    case 'green':
      return 'bg-green-100 border-green-400 text-green-700';
    case 'orange':
      return 'bg-orange-100 border-orange-400 text-orange-700';
    case 'red':
      return 'bg-red-100 border-red-400 text-red-700';
    default:
      return 'bg-gray-100 border-gray-400 text-gray-700';
  }
}

/**
 * Dutch summary like "3 groen · 3 oranje · 3 rood".
 */
export function statusSummary(areas: Area[]): string {
  const count = (status: string) => areas.filter((area) => area.status === status).length;
  return `${count('green')} groen · ${count('orange')} oranje · ${count('red')} rood`;
}
```

Append to `src/lib/hints.ts` (add `import type { HintArticle, HintBoard, HintCell } from '@/types/HintCell';` at the top):

```ts
export interface HintRow {
  article: HintArticle;
  cells: Partial<Record<string, HintCell>>;
}

/**
 * The newest hint articles with their cells keyed by area.
 * @param board The hint board
 * @param count How many articles to return
 */
export function lastHintRows(board: HintBoard, count: number): HintRow[] {
  return [...board.articles]
    .sort((a, b) => new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime())
    .slice(0, count)
    .map((article) => ({
      article,
      cells: Object.fromEntries(board.cells.filter((cell) => cell.articleId === article.id).map((cell) => [cell.area, cell])),
    }));
}

/**
 * Solved vs. total cells over the whole hunt, ignoring areas without a hint.
 */
export function hintProgress(board: HintBoard): { solved: number; total: number } {
  const relevant = board.cells.filter((cell) => cell.status !== 'none');
  return { solved: relevant.filter((cell) => cell.status === 'solved').length, total: relevant.length };
}
```

Append to `src/lib/utils.ts` (add `import type { Device } from '@/types/Device';` at the top):

```ts
/**
 * Devices that reported a position in the last five minutes.
 */
export function filterActiveDevices(devices?: Device[]): Device[] {
  return devices?.filter((device) => !isMoreThanFiveMinutesAgo(device.lastUpdate.toString())) ?? [];
}
```

Then in `src/components/map/ActiveDevices.tsx` replace
`const activeDevices = devices?.filter((device) => !isMoreThanFiveMinutesAgo(device.lastUpdate.toString()));`
with `const activeDevices = filterActiveDevices(devices);` and change the utils import to `import {filterActiveDevices} from "@/lib/utils.ts";`.

- [ ] **Step 4: Verify** — `bun_ test` all PASS; `bun_ run build`, `bun_ run lint` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/components/map/ActiveDevices.tsx
git commit -m "feat(sidebar): add pure helpers for next hint, fox status and hint rows

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Sidebar store, section wrapper, header with countdown

**Files:**
- Create: `src/stores/sidebar.store.ts`, `src/hooks/media.hook.ts`, `src/hooks/next-hint.hook.ts`, `src/components/sidebar/SidebarSection.tsx`, `src/components/sidebar/CountdownPill.tsx`, `src/components/sidebar/SidebarHeader.tsx`
- Modify: `src/components/Settings.tsx`

**Interfaces:**
- Consumes: `getLastHintTime`, `getNextHintTime`, `formatHintCountdown` (Task 1); `useArticles` (`src/hooks/articles.hook.ts`); `useInterval(cb, ms)`.
- Produces:
  - `type SidebarSectionId = 'foxes' | 'hints' | 'hintEntry' | 'counterHunt' | 'hunters'`, `type SheetSnap = 'peek' | 'half' | 'full'`, default export `useSidebarStore` with `openSections`, `toggleSection(id)`, `sheetSnap`, `setSheetSnap(snap)`
  - `useIsMobile(): boolean`
  - `useNextHint(): { label: string; isUrgent: boolean; isNewHint: boolean }`
  - `<SidebarSection id title summary? children>`, `<CountdownPill />`, `<SidebarHeader />`
  - `<Settings />` with no props (icon trigger at all sizes)

- [ ] **Step 1: Store** — `src/stores/sidebar.store.ts`

```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SidebarSectionId = 'foxes' | 'hints' | 'hintEntry' | 'counterHunt' | 'hunters';
export type SheetSnap = 'peek' | 'half' | 'full';

interface SidebarState {
  openSections: Record<SidebarSectionId, boolean>;
  toggleSection: (id: SidebarSectionId) => void;
  sheetSnap: SheetSnap;
  setSheetSnap: (snap: SheetSnap) => void;
}

const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      openSections: { foxes: true, hints: true, hintEntry: false, counterHunt: false, hunters: false },
      toggleSection: (id) => set((state) => ({ openSections: { ...state.openSections, [id]: !state.openSections[id] } })),
      sheetSnap: 'peek',
      setSheetSnap: (sheetSnap) => set({ sheetSnap }),
    }),
    {
      name: 'sidebar-storage',
      storage: createJSONStorage(() => localStorage),
      // Only remember which sections are open; the sheet always starts at peek
      partialize: (state) => ({ openSections: state.openSections }),
    },
  ),
);

export default useSidebarStore;
```

- [ ] **Step 2: Media hook** — `src/hooks/media.hook.ts`

```ts
import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

/**
 * Whether the viewport is below Tailwind's md breakpoint.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches);
}
```

- [ ] **Step 3: Next-hint hook** — `src/hooks/next-hint.hook.ts` (replaces the logic of `NextHintTimeCard`)

```ts
import { useState } from 'react';
import useSound from 'use-sound';
import { useArticles } from '@/hooks/articles.hook.ts';
import useInterval from '@/hooks/utils/interval.hook.ts';
import hintAlert from '@/assets/audio/hint-alert.mp3';
import { formatHintCountdown, getLastHintTime, getNextHintTime } from '@/lib/next-hint';

const URGENT_MS = 5 * 60 * 1000;
const NEW_HINT_HIGHLIGHT_MS = 60 * 1000;

/**
 * Countdown to the next hint, plus a sound and highlight when a new hint arrives
 * (not on the first load).
 */
export function useNextHint(): { label: string; isUrgent: boolean; isNewHint: boolean } {
  const { articles, isLoading, isError } = useArticles();
  const [play] = useSound(hintAlert);
  const [now, setNow] = useState(() => Date.now());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastPlayedHint, setLastPlayedHint] = useState<number>();
  const [newHintUntil, setNewHintUntil] = useState(0);

  const lastHintTime = getLastHintTime(articles);

  // On first load, treat the current newest hint as already announced
  if (lastHintTime && !hasLoaded) {
    setHasLoaded(true);
    setLastPlayedHint(lastHintTime.getTime());
  }

  useInterval(() => {
    const current = Date.now();
    setNow(current);
    if (hasLoaded && lastHintTime && (!lastPlayedHint || lastHintTime.getTime() > lastPlayedHint)) {
      setLastPlayedHint(lastHintTime.getTime());
      setNewHintUntil(current + NEW_HINT_HIGHLIGHT_MS);
      play();
    }
  }, 1000);

  const remaining = getNextHintTime(lastHintTime, new Date(import.meta.env.HUNT_START_TIME)).getTime() - now;
  const lastHintSlot = new Date(import.meta.env.HUNT_END_TIME).getTime() - 60 * 60 * 1000;
  const huntOver = now > lastHintSlot;
  const isNewHint = now < newHintUntil;

  let label = formatHintCountdown(remaining);
  if (isLoading) label = '…';
  else if (isError) label = 'Fout';
  else if (isNewHint) label = 'Nieuwe hint!';
  else if (huntOver) label = 'Geen hints meer';

  return { label, isNewHint, isUrgent: !huntOver && !isNewHint && remaining > 0 && remaining < URGENT_MS };
}
```

- [ ] **Step 4: Components** — `src/components/sidebar/SidebarSection.tsx`

```tsx
import { ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import useSidebarStore, { SidebarSectionId } from '@/stores/sidebar.store';
import { cn } from '@/lib/utils';

interface SidebarSectionProps {
  id: SidebarSectionId;
  title: string;
  /** Shown next to the title while the section is collapsed */
  summary?: ReactNode;
  children: ReactNode;
}

export default function SidebarSection({ id, title, summary, children }: SidebarSectionProps) {
  const open = useSidebarStore((state) => state.openSections[id]);
  const toggleSection = useSidebarStore((state) => state.toggleSection);

  return (
    <Collapsible open={open} onOpenChange={() => toggleSection(id)} className="card rounded-xl bg-card px-3 py-2 text-card-foreground">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 text-left">
        <span className="text-sm font-semibold">{title}</span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {!open && summary && <span className="truncate">{summary}</span>}
          <ChevronDownIcon className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
```

`src/components/sidebar/CountdownPill.tsx`:

```tsx
import { useNextHint } from '@/hooks/next-hint.hook';
import { cn } from '@/lib/utils';

export default function CountdownPill() {
  const { label, isUrgent, isNewHint } = useNextHint();

  return (
    <span
      title="Volgende hint"
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold',
        isNewHint && 'animate-pulse bg-green-100 text-green-700',
        !isNewHint && isUrgent && 'bg-red-100 text-red-700',
        !isNewHint && !isUrgent && 'bg-orange-100 text-orange-700',
      )}
    >
      ⧗ {label}
    </span>
  );
}
```

`src/components/sidebar/SidebarHeader.tsx`:

```tsx
import Settings from '@/components/Settings';
import CountdownPill from './CountdownPill';

export default function SidebarHeader() {
  const logoUrl: string = import.meta.env.LOGO_URL || '/pwa-512x512.png';
  const groupName: string = import.meta.env.GROUP_NAME;

  return (
    <div className="card flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-card-foreground">
      <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">Jotihunt Tracker</p>
        {groupName && <p className="truncate text-xs text-muted-foreground">{groupName}</p>}
      </div>
      <CountdownPill />
      <Settings />
    </div>
  );
}
```

- [ ] **Step 5: Settings trigger** — in `src/components/Settings.tsx`:
  - Change `export default function Settings({mobile}: InferProps<typeof Settings.propTypes>) {` to `export default function Settings() {`.
  - Delete the `mobileTrigger` and `desktopTrigger` constants.
  - Replace `<DropdownMenuTrigger asChild>{mobile ? mobileTrigger() : desktopTrigger()}</DropdownMenuTrigger>` with:
    ```tsx
    <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Instellingen">
            <CogIcon/>
        </Button>
    </DropdownMenuTrigger>
    ```
  - Delete the `Settings.propTypes = { mobile: PropTypes.bool.isRequired };` block and remove now-unused imports (`PropTypes`, `InferProps`) if nothing else uses them.
  - `src/pages/App.tsx` still renders `<Settings mobile={...} />` until Task 4 — change both usages there to `<Settings />` now so the build passes.

- [ ] **Step 6: Verify** — `bun_ test`, `bun_ run build`, `bun_ run lint` clean.

- [ ] **Step 7: Commit**

```bash
git add src/stores/sidebar.store.ts src/hooks/media.hook.ts src/hooks/next-hint.hook.ts src/components/sidebar src/components/Settings.tsx src/pages/App.tsx
git commit -m "feat(sidebar): add section wrapper, header and countdown pill

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Section contents (fox pills, mini grid, bare cards, deep link)

**Files:**
- Create: `src/components/sidebar/FoxPills.tsx`, `src/components/sidebar/HintMiniGrid.tsx`
- Modify: `src/components/cards/hint-entry/HintEntryCard.tsx`, `src/components/cards/counter-hunt/CounterHuntCard.tsx`, `src/components/map/ActiveDevices.tsx`, `src/pages/Hints.tsx`

**Interfaces:**
- Consumes: Task 1 helpers; `useAreas()` (`areas`, `toggleHidden`, `isHidden`); `useHunts()` (`hunts`); `useHintBoard()` (`board`); `areaOptions`, `cn`, `getColorFromArea` from `@/lib/utils`; `useSidebarStore` (Task 2).
- Produces: `<FoxPills />`, `<HintMiniGrid />`, `<HintEntryCard mapRef bare? />`, `<CounterHuntCard mapRef bare? />`, `<ActiveDevices mapRef showLabel? />`, `/hints?article=<id>&area=<area>` preselects a cell.

- [ ] **Step 1: FoxPills** — `src/components/sidebar/FoxPills.tsx`

```tsx
import { useState } from 'react';
import { useAreas } from '@/hooks/areas.hook';
import { useHunts } from '@/hooks/hunts.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { Skeleton } from '@/components/ui/skeleton';
import { huntCooldownMs, lastHuntTimeFor, statusPillClass } from '@/lib/fox-status';
import { formatHintCountdown } from '@/lib/next-hint';
import { cn, getColorFromArea } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood' };

export default function FoxPills() {
  const { areas, toggleHidden, isHidden } = useAreas();
  const { hunts } = useHunts();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);

  if (!areas) {
    return (
      <div className="grid grid-cols-9 gap-1">
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="h-7 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-9 gap-1">
      {areas.map((area) => {
        const cooldown = huntCooldownMs(lastHuntTimeFor(hunts, area.name), now);
        const hidden = isHidden(area.name);
        const title =
          `${area.name}: ${STATUS_LABEL[area.status] ?? area.status}` +
          (cooldown > 0 ? ` · weer te hunten over ${formatHintCountdown(cooldown)}` : '') +
          (hidden ? ' · verborgen' : '');
        return (
          <button
            key={area._id}
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={!hidden}
            onClick={() => toggleHidden(area.name)}
            className={cn(
              'relative h-7 cursor-pointer rounded-full border text-xs font-semibold transition-opacity',
              cooldown > 0 ? 'border-blue-400 bg-blue-100 text-blue-700' : statusPillClass(area.status),
              hidden && 'opacity-40',
            )}
          >
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-white" style={{ backgroundColor: getColorFromArea(area.name) }} />
            {area.name.charAt(0).toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: HintMiniGrid** — `src/components/sidebar/HintMiniGrid.tsx`

```tsx
import { Fragment } from 'react';
import { useNavigate } from 'react-router';
import { ExternalLinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHintBoard } from '@/hooks/hints.hook';
import { lastHintRows } from '@/lib/hints';
import { areaOptions, cn } from '@/lib/utils';
import { HintCell } from '@/types/HintCell';

const MINI_GRID_ROWS = 4;

const cellClass: Record<HintCell['status'], string> = {
  solved: 'bg-green-500',
  solving: 'bg-amber-400',
  open: 'bg-muted',
  none: 'border border-dashed border-muted-foreground/40',
};

const statusLabel: Record<HintCell['status'], string> = {
  solved: 'opgelost',
  solving: 'bezig',
  open: 'open',
  none: 'geen hint',
};

export default function HintMiniGrid() {
  const navigate = useNavigate();
  const { board } = useHintBoard();
  const rows = board ? lastHintRows(board, MINI_GRID_ROWS) : [];

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nog geen hints</p>
      ) : (
        <div className="grid grid-cols-[2.5rem_repeat(9,1fr)] items-center gap-0.5 text-[10px]">
          <span />
          {areaOptions.map((area) => (
            <span key={area.value} className="text-center font-semibold">
              {area.label.charAt(0)}
            </span>
          ))}
          {rows.map((row) => (
            <Fragment key={row.article.id}>
              <span className="font-mono text-muted-foreground">
                {new Date(row.article.publishAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {areaOptions.map((area) => {
                const cell = row.cells[area.value];
                if (!cell) return <span key={area.value} className="h-4" />;
                const label = `${area.label} · ${statusLabel[cell.status]}`;
                return (
                  <button
                    key={area.value}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => navigate(`/hints?article=${row.article.id}&area=${area.value}`)}
                    className={cn('h-4 cursor-pointer rounded-sm hover:ring-2 hover:ring-primary/50', cellClass[cell.status])}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" onClick={() => navigate('/hints')}>
        Open hint board <ExternalLinkIcon />
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Bare cards**
  - `HintEntryCard.tsx`: add `bare: PropTypes.bool` to `HintEntryCard.propTypes`, destructure `{mapRef, bare}`, and before the existing final `return (` add `if (bare) return formComponent();`.
  - `CounterHuntCard.tsx`:
    - add `bare: PropTypes.bool` to propTypes and destructure `bare`;
    - move the `<div className="flex gap-2 w-full flex-wrap md:flex-nowrap">…</div>` into `const controls = (…);` and render `if (bare) return controls;` before the Card return, with the Card's `<CardContent>{controls}</CardContent>`;
    - replace `import useMenuStore from '@/stores/menu.store.ts';` with `import useSidebarStore from '@/stores/sidebar.store.ts';`, `const { setMenuOpen } = useMenuStore();` with `const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);`, and `setMenuOpen(false);` with `setSheetSnap('peek');` (collapses the mobile sheet so the map is visible).
  - `ActiveDevices.tsx`: add `showLabel: PropTypes.bool` to propTypes, destructure `{mapRef, showLabel = true}`, render the "Actieve hunters:" `<p>` only when `showLabel`, and change the wrapper class to `'flex flex-wrap gap-2 items-center'`.

- [ ] **Step 4: Hints deep link** — in `src/pages/Hints.tsx`:
  - change `import { useNavigate } from 'react-router';` to `import { useNavigate, useSearchParams } from 'react-router';`
  - replace `const [selected, setSelected] = useState<CellKey>();` with:
    ```tsx
    const [searchParams] = useSearchParams();
    // Preselect a cell when opened from the sidebar mini grid (/hints?article=<id>&area=<area>)
    const [selected, setSelected] = useState<CellKey | undefined>(() => {
      const articleId = Number(searchParams.get('article'));
      const area = searchParams.get('area');
      return articleId && area ? { articleId, area } : undefined;
    });
    ```

- [ ] **Step 5: Verify** — `bun_ test`, `bun_ run build`, `bun_ run lint` clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar src/components/cards src/components/map/ActiveDevices.tsx src/pages/Hints.tsx
git commit -m "feat(sidebar): add fox pills, mini hint grid and bare card variants

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Compose the sidebar (desktop stack + mobile sheet) and wire App

**Files:**
- Create: `src/components/sidebar/SidebarSections.tsx`, `src/components/sidebar/MobileSheet.tsx`, `src/components/sidebar/Sidebar.tsx`
- Modify: `src/pages/App.tsx`, `package.json` / `bun.lock` (add `vaul`)
- Delete: `src/components/cards/next-hint-time/NextHintTimeCard.tsx`, `src/components/cards/fox-status/FoxStatusCard.tsx`, `src/components/cards/fox-status/FoxStatus.tsx`, `src/stores/menu.store.ts`, `src/components/magicui/Ripple.tsx` (only if nothing else imports it — check with grep)

**Interfaces:**
- Consumes: everything from Tasks 1–3; `useOutlet()` → `{ mapRef }`; `ScrollArea` from `@/components/ui/scroll-area`; `SearchCard`, `CoordinatesCard` (unchanged).
- Produces: `<Sidebar mapRef />`.

- [ ] **Step 1: Dependency** — `bun_ add vaul`

- [ ] **Step 2: Sections** — `src/components/sidebar/SidebarSections.tsx`

```tsx
import { RefObject } from 'react';
import { MapRef } from '@/components/Map';
import HintEntryCard from '@/components/cards/hint-entry/HintEntryCard';
import CounterHuntCard from '@/components/cards/counter-hunt/CounterHuntCard';
import ActiveDevices from '@/components/map/ActiveDevices';
import { useAreas } from '@/hooks/areas.hook';
import { useDevices } from '@/hooks/devices.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { statusSummary } from '@/lib/fox-status';
import { hintProgress } from '@/lib/hints';
import { filterActiveDevices } from '@/lib/utils';
import SidebarSection from './SidebarSection';
import FoxPills from './FoxPills';
import HintMiniGrid from './HintMiniGrid';

export default function SidebarSections({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { areas } = useAreas();
  const { board } = useHintBoard();
  const { devices } = useDevices();
  const activeCount = filterActiveDevices(devices).length;
  const progress = board ? hintProgress(board) : undefined;

  return (
    <>
      <SidebarSection id="foxes" title="Vossen" summary={areas ? statusSummary(areas) : undefined}>
        <FoxPills />
      </SidebarSection>
      <SidebarSection id="hints" title="Hints" summary={progress ? `${progress.solved}/${progress.total} opgelost` : undefined}>
        <HintMiniGrid />
      </SidebarSection>
      <SidebarSection id="hintEntry" title="Hint registreren">
        <HintEntryCard mapRef={mapRef} bare />
      </SidebarSection>
      {import.meta.env.HOME_TEAM_API_ID && (
        <SidebarSection id="counterHunt" title="Tegenhunt">
          <CounterHuntCard mapRef={mapRef} bare />
        </SidebarSection>
      )}
      <SidebarSection id="hunters" title="Actieve hunters" summary={activeCount ? String(activeCount) : 'Niemand'}>
        <ActiveDevices mapRef={mapRef} showLabel={false} />
      </SidebarSection>
    </>
  );
}
```

- [ ] **Step 3: Mobile sheet** — `src/components/sidebar/MobileSheet.tsx`

```tsx
import { ReactNode } from 'react';
import { Drawer } from 'vaul';
import useSidebarStore, { SheetSnap } from '@/stores/sidebar.store';
import { cn } from '@/lib/utils';

const SNAP_POINTS: (string | number)[] = ['164px', 0.5, 0.92];
const SNAP_BY_NAME: Record<SheetSnap, string | number> = { peek: SNAP_POINTS[0], half: SNAP_POINTS[1], full: SNAP_POINTS[2] };

function snapName(snap: string | number | null): SheetSnap {
  if (snap === SNAP_BY_NAME.full) return 'full';
  if (snap === SNAP_BY_NAME.half) return 'half';
  return 'peek';
}

/**
 * Always-visible bottom sheet for phones. Non-modal so the map stays usable above it.
 */
export default function MobileSheet({ header, children }: { header: ReactNode; children: ReactNode }) {
  const sheetSnap = useSidebarStore((state) => state.sheetSnap);
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={SNAP_BY_NAME[sheetSnap]}
      setActiveSnapPoint={(snap) => setSheetSnap(snapName(snap))}
    >
      <Drawer.Portal>
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-40 flex h-full max-h-[96dvh] flex-col rounded-t-2xl border-t bg-background outline-none"
        >
          <Drawer.Handle className="mx-auto mb-1 mt-2" />
          <Drawer.Title className="sr-only">Zijbalk</Drawer.Title>
          <div className="px-2">{header}</div>
          <div className={cn('flex flex-1 flex-col gap-1.5 px-2 pb-6 pt-1.5', sheetSnap === 'full' ? 'overflow-y-auto' : 'overflow-hidden')}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

- [ ] **Step 4: Sidebar** — `src/components/sidebar/Sidebar.tsx`

```tsx
import { RefObject } from 'react';
import { MapRef } from '@/components/Map';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/media.hook';
import SidebarHeader from './SidebarHeader';
import SidebarSections from './SidebarSections';
import MobileSheet from './MobileSheet';

export default function Sidebar({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileSheet header={<SidebarHeader />}>
        <SidebarSections mapRef={mapRef} />
      </MobileSheet>
    );
  }

  return (
    <aside className="pointer-events-none absolute bottom-2 left-2 top-2 z-40 w-[300px]">
      <ScrollArea className="h-full">
        <div className="pointer-events-auto flex flex-col gap-1.5 pb-2">
          <SidebarHeader />
          <SidebarSections mapRef={mapRef} />
        </div>
      </ScrollArea>
    </aside>
  );
}
```

- [ ] **Step 5: App** — replace `src/pages/App.tsx` entirely:

```tsx
import { useOutlet } from '@/hooks/outlet.hook.ts';
import SearchCard from '@/components/cards/search/SearchCard.tsx';
import CoordinatesCard from '@/components/cards/coordinates/CoordinatesCard.tsx';
import Sidebar from '@/components/sidebar/Sidebar';

function App() {
  const { mapRef } = useOutlet();

  return (
    <>
      <div className="absolute left-2 right-2 top-2 z-30 flex gap-2 md:left-auto md:right-12">
        <div className="hidden md:block">
          <CoordinatesCard mapRef={mapRef} />
        </div>
        <div className="w-full md:w-auto">
          <SearchCard mapRef={mapRef} />
        </div>
      </div>
      <Sidebar mapRef={mapRef} />
    </>
  );
}

export default App;
```

- [ ] **Step 6: Delete obsolete files** — delete the files listed above (check `grep -rn "Ripple\|menu.store\|NextHintTime\|FoxStatusCard\|FoxStatus'" src` returns nothing that still needs them first).

- [ ] **Step 7: Verify** — `bun_ test`, `bun_ run build`, `bun_ run lint` clean.

- [ ] **Step 8: Commit**

```bash
git add -A src package.json bun.lock
git commit -m "feat(sidebar): compose compact sidebar with mobile bottom sheet

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Visual verification

**Files:** none (fix bugs in the relevant files and commit as `fix(sidebar): …`).

- [ ] **Step 1: Rebuild** — `cd "/home/silke/Documents/Jotihunt 2026" && docker compose up -d --build client`; seed one hint: `docker compose exec -T server bun run seed-hint --force`.

- [ ] **Step 2: Screenshots** with headless Chromium from the server image (it has puppeteer + chromium). Script `/tmp/shot/sidebar.ts`:

```ts
import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
async function login() {
  await page.goto("http://localhost:8080/login", { waitUntil: "networkidle2" });
  const inputs = await page.$$("input");
  await inputs[0].type("solver@local.test");
  await inputs[1].type("Solver123456");
  await page.click("button[type=submit]");
  await new Promise((r) => setTimeout(r, 4000));
}
await page.setViewport({ width: 1280, height: 800 });
await login();
await page.goto("http://localhost:8080/", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 5000));
await page.screenshot({ path: "/out/desktop.png" });
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto("http://localhost:8080/", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 5000));
await page.screenshot({ path: "/out/mobile-peek.png" });
await browser.close();
```

Run: `docker run --rm --network host -v /tmp/shot:/out -w /usr/src/app --entrypoint bun jotihunt-server /out/sidebar.ts` and inspect `/tmp/shot/desktop.png`, `/tmp/shot/mobile-peek.png`. Also check (in a browser session or by extending the script) that clicking a mini-grid cell lands on `/hints?article=…&area=…` with that cell's panel open, and dragging the sheet reaches half/full.

- [ ] **Step 3: Clean up the seeded hint**

```bash
docker compose exec -T mongodb mongosh jotihunt --quiet --eval \
  'db.articles.deleteMany({id:{$gte:900000}}); db.hintcells.deleteMany({articleId:{$gte:900000}})'
```
