# Intel Window Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Intel dialog: shared Account/Meldingen shell, status card (tiles + oplos-tempo chart) next to a left timeline, back button in the top bar with aligned detail cards, and push animations replacing the shared-element morph.

**Architecture:** Pure stats in `src/lib/intel-window.ts` (`intelStats`, tested with bun). New `StatusCard` + `CountUp` components. `IntelDialog` stacks one keyed `PushView` per view (timeline / each item) in `AnimatePresence` with a direction (`custom`), so views push left/right. `IntelTimeline` loses the morph/return logic and pushes its list sideways on tab switches. The shell classes move into one shared constant.

**Tech Stack:** React 19, TypeScript, Tailwind v4, motion v12 (`motion/react`, `MotionConfig reducedMotion="user"` already in `main.tsx`), zustand, SWR, bun:test.

Spec: `docs/superpowers/specs/2026-10-16-intel-window-redesign-design.md`. Mockups: `.superpowers/brainstorm/258856-1792148239/content/`.
Server counterpart: server repo `docs/superpowers/plans/2026-10-16-intel-solved-at.md` (adds `solvedAt`; deploy server first; client must tolerate it missing).

## Global Constraints

- `bun` not on PATH: `npx --yes bun test <file>`, `npx --yes bun x tsc -b`, `npx --yes bun run lint`.
- Branch `feat/intel-redesign` from `main` (check `git branch --show-current`; another session may use main — if the checkout is busy, use a worktree `.worktrees/client-intel-redesign`).
- All UI copy Dutch, exactly as written here.
- Buttons in new UI: 12px radius (`rounded-xl`), never pills (`rounded-full`).
- Every state change animates (enter/exit/swap); reduced motion handled by the global `MotionConfig reducedMotion="user"` (transforms off, opacity kept) plus explicit checks where noted.
- Comments: short, explain why, match the surrounding density.
- Desktop only: the dialog returns null on phones (unchanged).

---

### Task 1: Shared dialog shell

**Files:**
- Create: `src/lib/dialog-shell.ts`
- Modify: `src/components/account/AccountDialog.tsx` (remove `DIALOG_CLASS`)
- Modify: `src/components/notifications/NotificationsDialog.tsx` (remove `SHELL`)
- Modify: `src/components/intel-window/IntelDialog.tsx` (`className` of `ResponsiveDialog`)

**Interfaces:**
- Produces: `DIALOG_SHELL: string` from `@/lib/dialog-shell`.

- [ ] **Step 1: Create the constant**

`src/lib/dialog-shell.ts`:

```ts
/**
 * Desktop dialog shell (Account, Meldingen, Intel): 28px card without border, the layers-popover shadow, and the built-in
 * close X as a 34×32 tonal button with 12px corners like the sidebar header buttons. Add width, background and padding.
 */
export const DIALOG_SHELL =
  'rounded-[28px] border-0 shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/0.35)] [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4 [&>[data-slot=dialog-close]]:grid [&>[data-slot=dialog-close]]:h-8 [&>[data-slot=dialog-close]]:w-[34px] [&>[data-slot=dialog-close]]:place-items-center [&>[data-slot=dialog-close]]:rounded-xl [&>[data-slot=dialog-close]]:bg-beheer-row [&>[data-slot=dialog-close]]:text-muted-foreground [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:ring-0 [&>[data-slot=dialog-close]]:ring-offset-0 [&>[data-slot=dialog-close]]:transition-colors [&>[data-slot=dialog-close]:hover]:bg-beheer-row-high [&>[data-slot=dialog-close]:focus-visible]:ring-[3px] [&>[data-slot=dialog-close]:focus-visible]:ring-ring/50';
```

- [ ] **Step 2: Use it in Account and Meldingen**

AccountDialog: delete the `DIALOG_CLASS` constant (and its comment); import `DIALOG_SHELL` and `cn` (already imported); pass `className={cn(DIALOG_SHELL, 'bg-card p-5 sm:max-w-md')}`.

NotificationsDialog: delete `SHELL` (and its comment); import `DIALOG_SHELL` and `cn` from `@/lib/utils`; pass `className={cn(DIALOG_SHELL, 'bg-card p-5 sm:max-w-sm')}`.

- [ ] **Step 3: Use it in Intel, with the rise-in entrance**

In `IntelDialog.tsx` replace the `className` on `ResponsiveDialog` with:

```tsx
      // Shell shared with Account/Meldingen; the window rises 18px instead of the default zoom
      className={cn(
        DIALOG_SHELL,
        'h-[720px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[1160px] data-[state=open]:zoom-in-100 data-[state=open]:slide-in-from-bottom-[18px] data-[state=open]:duration-[380ms]',
      )}
```

(`cn` is already imported there.) Verify in the browser that the dialog still centres (Tailwind v4 `translate-*` uses the `translate` property, the tw-animate keyframes use `transform`, so they compose). If it jumps, drop the three `data-[state=open]` classes and note it in the report.

- [ ] **Step 4: Check**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dialog-shell.ts src/components/account/AccountDialog.tsx src/components/notifications/NotificationsDialog.tsx src/components/intel-window/IntelDialog.tsx
git commit -m "refactor(dialogs): share the dialog shell; Intel uses it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Stats, push variants and next-hint time

**Files:**
- Modify: `src/types/HintCell.ts` (add `solvedAt`)
- Modify: `src/lib/intel-window.ts` (add stats, formatting, tab order, push variants)
- Modify: `src/hooks/next-hint.hook.ts` (add `nextAt`)
- Test: `src/lib/intel-window.test.ts`

**Interfaces:**
- Produces (all from `@/lib/intel-window`):
  - `interface SlotBar { slotTime: string; hour: string; solved: number; open: number }`
  - `interface IntelStats { hints: { solved: number; total: number; percent: number | null }; assignments: { submitted: number; total: number; points: number }; unread: { news: number; assignment: number }; slots: SlotBar[]; avgSolveMs: number | null }`
  - `intelStats(items: IntelItem[], cells: HintCell[]): IntelStats`
  - `SOLVE_CHART_SLOTS = 8`
  - `formatSolveTime(ms: number): string` → `"18 min"` / `"1 u 05"`
  - `unreadLabel(unread: { news: number; assignment: number }): string`
  - `unreadTab(unread: { news: number; assignment: number }): IntelTab`
  - `INTEL_TAB_ORDER: IntelTab[]` = `['all', 'hint', 'assignment', 'news']`
  - `PUSH_TRANSITION: Transition`, `PUSH: Variants` (labels `enter`/`center`/`exit`, custom = direction 1 | -1)
- Produces: `useNextHint()` also returns `nextAt: Date | null` (the expected time of the next hint while counting down, else null).
- Produces: `HintCell.solvedAt?: string`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/intel-window.test.ts` (extend the import from `./intel-window` with `formatSolveTime, intelStats, unreadLabel, unreadTab`):

```ts
describe('intelStats', () => {
  const slotA = '2026-10-17T11:00:00.000Z'; // 13:00 in Amsterdam
  const slotB = '2026-10-17T12:00:00.000Z'; // 14:00
  const at = (slotTime: string, area: string, status: HintCell['status'], solvedAfterMin?: number): HintCell =>
    ({
      _id: `${slotTime}-${area}`,
      articleId: 1,
      area,
      publishAt: slotTime,
      slotTime,
      status,
      articleChanged: false,
      solvedAt: solvedAfterMin === undefined ? undefined : new Date(new Date(slotTime).getTime() + solvedAfterMin * 60_000).toISOString(),
    }) as HintCell;

  test('hints: geen-hint cells are not counted; percent rounded; null without hints', () => {
    const stats = intelStats([], [at(slotA, 'alpha', 'solved'), at(slotA, 'bravo', 'open'), at(slotA, 'charlie', 'open'), at(slotA, 'delta', 'none')]);
    expect(stats.hints).toEqual({ solved: 1, total: 3, percent: 33 });
    expect(intelStats([], []).hints).toEqual({ solved: 0, total: 0, percent: null });
    expect(intelStats([], [at(slotA, 'alpha', 'none')]).hints.percent).toBeNull();
  });

  test('assignments: submitted count and their max points', () => {
    const items = [
      { kind: 'assignment', maxPoints: 30, assignment: { status: 'submitted' } },
      { kind: 'assignment', maxPoints: 50, assignment: { status: 'busy' } },
      { kind: 'assignment', maxPoints: undefined, assignment: { status: 'submitted' } },
      { kind: 'news', unread: true },
    ] as IntelItem[];
    expect(intelStats(items, []).assignments).toEqual({ submitted: 2, total: 3, points: 30 });
  });

  test('unread per kind', () => {
    const items = [{ kind: 'news', unread: true }, { kind: 'news', unread: false }, { kind: 'assignment', unread: true }, { kind: 'hint', unread: false }] as IntelItem[];
    expect(intelStats(items, []).unread).toEqual({ news: 1, assignment: 1 });
  });

  test('slots: oldest first, solved/open per slot, none skipped, hour in Dutch time, last 8 only', () => {
    const stats = intelStats([], [at(slotB, 'alpha', 'open'), at(slotA, 'alpha', 'solved'), at(slotA, 'bravo', 'open'), at(slotB, 'bravo', 'none')]);
    expect(stats.slots).toEqual([
      { slotTime: slotA, hour: '13', solved: 1, open: 1 },
      { slotTime: slotB, hour: '14', solved: 0, open: 1 },
    ]);
    const many = Array.from({ length: 10 }, (_, index) => at(new Date(Date.UTC(2026, 9, 17, index)).toISOString(), 'alpha', 'open'));
    const slots = intelStats([], many).slots;
    expect(slots).toHaveLength(8);
    expect(slots[0].slotTime).toBe('2026-10-17T02:00:00.000Z');
  });

  test('average solve time over solved cells with solvedAt in the shown slots', () => {
    const stats = intelStats([], [at(slotA, 'alpha', 'solved', 10), at(slotA, 'bravo', 'solved', 30), at(slotA, 'charlie', 'solved'), at(slotB, 'alpha', 'open')]);
    expect(stats.avgSolveMs).toBe(20 * 60_000);
    expect(intelStats([], [at(slotA, 'alpha', 'solved')]).avgSolveMs).toBeNull();
  });
});

describe('stat labels', () => {
  test('formatSolveTime', () => {
    expect(formatSolveTime(18 * 60_000)).toBe('18 min');
    expect(formatSolveTime(89 * 60_000)).toBe('89 min');
    expect(formatSolveTime(65 * 60_000 + 25 * 60_000)).toBe('1 u 30');
    expect(formatSolveTime(125 * 60_000)).toBe('2 u 05');
  });
  test('unreadLabel and unreadTab', () => {
    expect(unreadLabel({ news: 2, assignment: 1 })).toBe('nieuws · 1 opdracht');
    expect(unreadLabel({ news: 0, assignment: 2 })).toBe('opdrachten');
    expect(unreadLabel({ news: 3, assignment: 0 })).toBe('nieuws');
    expect(unreadLabel({ news: 0, assignment: 0 })).toBe('alles gelezen');
    expect(unreadTab({ news: 0, assignment: 2 })).toBe('assignment');
    expect(unreadTab({ news: 1, assignment: 2 })).toBe('news');
    expect(unreadTab({ news: 0, assignment: 0 })).toBe('news');
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx --yes bun test src/lib/intel-window.test.ts`
Expected: FAIL (`intelStats` etc. not exported).

- [ ] **Step 3: Type field**

`src/types/HintCell.ts`, in `HintCell` after `markerId?: string;`:

```ts
  /** ISO; when the cell was first solved (older servers don't send it) */
  solvedAt?: string;
```

- [ ] **Step 4: Implement in `src/lib/intel-window.ts`**

Add `import type { IntelTab } from '@/types/Intel';` is already covered by the existing type import (add `IntelTab` if missing). Append near the other exports (before the motion section):

```ts
/** Tab order left to right: a tab further right pushes the list in from the right */
export const INTEL_TAB_ORDER: IntelTab[] = ['all', 'hint', 'assignment', 'news'];

/** Bars in the oplos-tempo chart */
export const SOLVE_CHART_SLOTS = 8;

/** One hint slot in the oplos-tempo chart */
export interface SlotBar {
  /** ISO */
  slotTime: string;
  /** "18" (Dutch time) */
  hour: string;
  solved: number;
  open: number;
}

/** Everything the status card shows */
export interface IntelStats {
  /** Cells with a hint (not "geen hint"); percent is null without any */
  hints: { solved: number; total: number; percent: number | null };
  /** Submitted assignments and the max points of those */
  assignments: { submitted: number; total: number; points: number };
  unread: { news: number; assignment: number };
  /** The last SOLVE_CHART_SLOTS hint slots, oldest first */
  slots: SlotBar[];
  /** Mean time from publish to first solve over the solved cells of those slots that have a solvedAt, or null */
  avgSolveMs: number | null;
}

const hourFormat = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hourCycle: 'h23' });

export function intelStats(items: IntelItem[], cells: HintCell[]): IntelStats {
  const counted = cells.filter((cell) => cell.status !== 'none');
  const solved = counted.filter((cell) => cell.status === 'solved').length;

  const assignments = items.filter((item) => item.kind === 'assignment');
  const submitted = assignments.filter((item) => item.assignment?.status === 'submitted');

  // Per slot (normalised ISO, so differently formatted dates of one slot meet), newest SOLVE_CHART_SLOTS kept
  const bySlot = new Map<string, HintCell[]>();
  for (const cell of counted) {
    const key = new Date(cell.slotTime).toISOString();
    bySlot.set(key, [...(bySlot.get(key) ?? []), cell]);
  }
  const keys = [...bySlot.keys()].sort((a, b) => time(a) - time(b)).slice(-SOLVE_CHART_SLOTS);
  const slots = keys.map((slotTime) => {
    const slotCells = bySlot.get(slotTime)!;
    const solvedHere = slotCells.filter((cell) => cell.status === 'solved').length;
    return { slotTime, hour: hourFormat.format(time(slotTime)), solved: solvedHere, open: slotCells.length - solvedHere };
  });

  const durations = keys
    .flatMap((key) => bySlot.get(key)!)
    .filter((cell) => cell.status === 'solved' && cell.solvedAt)
    .map((cell) => time(cell.solvedAt) - time(cell.publishAt))
    .filter((ms) => ms >= 0);

  return {
    hints: { solved, total: counted.length, percent: counted.length ? Math.round((solved / counted.length) * 100) : null },
    assignments: { submitted: submitted.length, total: assignments.length, points: submitted.reduce((sum, item) => sum + (item.maxPoints ?? 0), 0) },
    unread: { news: unreadCount(items, 'news'), assignment: unreadCount(items, 'assignment') },
    slots,
    avgSolveMs: durations.length ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length : null,
  };
}

/** "18 min", or "1 u 05" from 90 minutes on */
export function formatSolveTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes < 90 ? `${minutes} min` : `${Math.floor(minutes / 60)} u ${String(minutes % 60).padStart(2, '0')}`;
}

/** The Ongelezen tile's sub line */
export function unreadLabel({ news, assignment }: { news: number; assignment: number }): string {
  const assignments = assignment === 1 ? 'opdracht' : 'opdrachten';
  if (news && assignment) return `nieuws · ${assignment} ${assignments}`;
  if (assignment) return assignments;
  return news ? 'nieuws' : 'alles gelezen';
}

/** Where the Ongelezen tile leads: Opdrachten when only assignments are unread, else Nieuws */
export function unreadTab({ news, assignment }: { news: number; assignment: number }): IntelTab {
  return assignment && !news ? 'assignment' : 'news';
}
```

`time` already exists at the top of the file (`const time = (date: unknown) => new Date(date as string).getTime();`); `unreadCount` is defined above. If `HintCell` is not imported as a type, it is (`import type { HintBoard, HintCell, RdPreview }`).

Then add the push variants next to the other motion constants (import `Transition`/`Variants` already there):

```ts
/** Views and items push sideways (timeline ↔ item, item ↔ item): 1 = forward (in from the right), -1 = back */
export const PUSH_TRANSITION: Transition = { duration: 0.36, ease: EASE_OUT };
export const PUSH: Variants = {
  enter: (direction: number) => ({ x: `${35 * direction}%`, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: PUSH_TRANSITION },
  exit: (direction: number) => ({ x: `${-35 * direction}%`, opacity: 0, transition: PUSH_TRANSITION }),
};
```

- [ ] **Step 5: `nextAt` in `useNextHint`**

In `src/hooks/next-hint.hook.ts`: change the return type to `{ label: string; isUrgent: boolean; isNewHint: boolean; isCountdown: boolean; nextAt: Date | null }`, keep the computed next time:

```ts
  const nextTime = getNextHintTime(lastHintTime, new Date(import.meta.env.HUNT_START_TIME));
  const remaining = nextTime.getTime() - now;
```

and return `nextAt: isCountdown ? nextTime : null` in the object. Update the doc comment: "`nextAt`: when the next hint is expected, only while counting down". HqTopCard destructures, so it is unaffected.

- [ ] **Step 6: Run tests and checks**

Run: `npx --yes bun test src/lib/intel-window.test.ts && npx --yes bun x tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/types/HintCell.ts src/lib/intel-window.ts src/lib/intel-window.test.ts src/hooks/next-hint.hook.ts
git commit -m "feat(intel): status stats, push variants and next hint time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Status card next to the timeline

**Files:**
- Create: `src/components/motion/CountUp.tsx`
- Create: `src/components/intel-window/StatusCard.tsx`
- Modify: `src/components/intel-window/IntelDialog.tsx` (`IntelWindow` passes items/cells; `TimelineView` lays out timeline + card)
- Modify: `src/components/intel-window/IntelTimeline.tsx` (only the list padding: `pr-[200px] pl-[150px]` → `pr-2`)

**Interfaces:**
- Consumes: `intelStats`, `formatSolveTime`, `unreadLabel`, `unreadTab`, `IntelStats`, `SlotBar` (Task 2); `useNextHint().nextAt` (Task 2); `useIntelStore` `setTab`.
- Produces: `<CountUp value={number} from?={number} className? />` (default export, `@/components/motion/CountUp`); `<StatusCard items={IntelItem[]} cells={HintCell[]} entrance={boolean} />` (default export).

- [ ] **Step 1: `CountUp`**

`src/components/motion/CountUp.tsx`:

```tsx
import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';

/** A whole number that rolls to its value: from `from` on mount (a count-up), then from the old value on every change */
export default function CountUp({ value, from = value, className }: { value: number; from?: number; className?: string }) {
  const reduce = useReducedMotion();
  const current = useMotionValue(from);
  const text = useTransform(current, (latest) => String(Math.round(latest)));
  useEffect(() => {
    if (reduce) {
      current.set(value);
      return;
    }
    const controls = animate(current, value, { duration: 0.7, ease: [0.33, 1, 0.68, 1] });
    return () => controls.stop();
  }, [value, reduce, current]);
  return <motion.span className={cn('tabular-nums', className)}>{text}</motion.span>;
}
```

- [ ] **Step 2: `StatusCard`**

`src/components/intel-window/StatusCard.tsx`:

```tsx
import { type ReactNode, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import CountUp from '@/components/motion/CountUp';
import { useNextHint } from '@/hooks/next-hint.hook';
import { formatClock } from '@/lib/format';
import { formatSolveTime, intelStats, type SlotBar, unreadLabel, unreadTab } from '@/lib/intel-window';
import { EASE_OUT, LAYOUT_SPRING, SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem } from '@/types/Intel';

const LABEL = 'text-[11px] font-extrabold tracking-[0.06em] uppercase';
const BIG = 'text-[24px] leading-none font-extrabold tracking-[-0.02em] tabular-nums';

/**
 * Right of the timeline: 2×2 tiles (next hint, hints solved, opdrachten, unread) and the oplos-tempo chart. Tiles open
 * their tab. `entrance` (read on mount): the window just opened, so the card slides in and its numbers count up.
 */
export default function StatusCard({ items, cells, entrance }: { items: IntelItem[]; cells: HintCell[]; entrance: boolean }) {
  const stats = useMemo(() => intelStats(items, cells), [items, cells]);
  const setTab = useIntelStore((state) => state.setTab);
  const from = entrance ? 0 : undefined;
  const { hints, assignments, unread } = stats;
  return (
    <motion.aside
      initial={entrance ? { opacity: 0, x: 14 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.18, ease: EASE_OUT }}
      aria-label="Status"
      className="flex w-[340px] shrink-0 flex-col gap-2.5 overflow-y-auto rounded-[24px] bg-card p-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <NextHintTile />
        <Tile label="Hints" onClick={() => setTab('hint')} sub={hints.total ? `${hints.solved} van ${hints.total} opgelost` : 'nog geen hints'}>
          {hints.percent === null ? (
            '—'
          ) : (
            <span className="flex items-center gap-2">
              <HintRing percent={hints.percent} entrance={entrance} />
              <span>
                <CountUp value={hints.percent} from={from} />%
              </span>
            </span>
          )}
        </Tile>
        <Tile
          label="Opdrachten"
          onClick={() => setTab('assignment')}
          sub={assignments.total ? `ingeleverd${assignments.points ? ` · ${assignments.points} pt` : ''}` : 'nog geen opdrachten'}
        >
          <CountUp value={assignments.submitted} from={from} />
          <span className="text-[15px] text-muted-foreground">/{assignments.total}</span>
        </Tile>
        <Tile label="Ongelezen" onClick={() => setTab(unreadTab(unread))} sub={unreadLabel(unread)}>
          <CountUp value={unread.news + unread.assignment} from={from} />
        </Tile>
      </div>
      <SolveChart slots={stats.slots} avgSolveMs={stats.avgSolveMs} entrance={entrance} />
    </motion.aside>
  );
}

/** A clickable stat tile: label, big value, sub line */
function Tile({ label, sub, onClick, children }: { label: string; sub: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer flex-col items-start gap-1.5 rounded-[18px] bg-beheer-row p-3 text-left outline-none transition-colors hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className={cn(LABEL, 'text-muted-foreground')}>{label}</span>
      <span className={BIG}>{children}</span>
      <span className="text-[11.5px] text-muted-foreground">{sub}</span>
    </button>
  );
}

/** Countdown to the next hint (orange tonal, red-ish under 5 minutes); its message swaps when the state changes */
function NextHintTile() {
  const next = useNextHint();
  const urgent = next.isUrgent || next.isNewHint;
  const mode = next.isCountdown ? 'countdown' : next.label;
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-[18px] p-3 transition-colors duration-300',
        urgent ? 'bg-destructive/15 text-destructive dark:text-red-300' : 'bg-primary-container text-orange-800 dark:text-orange-200',
      )}
    >
      <span className={LABEL}>Volgende hint</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={mode} className={cn(BIG, !next.isCountdown && 'text-[18px]')} {...SWAP}>
          {next.label}
        </motion.span>
      </AnimatePresence>
      <span className="min-h-[1lh] text-[11.5px] opacity-80">{next.nextAt ? `om ${formatClock(next.nextAt)}` : ''}</span>
    </div>
  );
}

/** Share of solved hint cells as a ring that draws to its value */
function HintRing({ percent, entrance }: { percent: number; entrance: boolean }) {
  return (
    <svg viewBox="0 0 36 36" className="size-[30px] -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r="14" fill="none" strokeWidth="5" className="stroke-beheer-row-high" />
      <motion.circle
        cx="18"
        cy="18"
        r="14"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-green-600 dark:stroke-green-400"
        initial={entrance ? { pathLength: 0 } : false}
        animate={{ pathLength: percent / 100 }}
        transition={{ duration: 0.7, delay: entrance ? 0.2 : 0, ease: EASE_OUT }}
      />
    </svg>
  );
}

/** Solved (green) over open (orange) cells per hint slot, oldest left; bars grow in on entrance and ease to new heights */
function SolveChart({ slots, avgSolveMs, entrance }: { slots: SlotBar[]; avgSolveMs: number | null; entrance: boolean }) {
  const max = Math.max(1, ...slots.map((slot) => slot.solved + slot.open));
  return (
    <div className="flex min-h-[200px] flex-1 flex-col rounded-[18px] bg-beheer-row p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn(LABEL, 'text-muted-foreground')}>Oplos-tempo</span>
        <AnimatePresence mode="wait" initial={false}>
          {avgSolveMs !== null && (
            <motion.span key={formatSolveTime(avgSolveMs)} {...SWAP} className="text-[11.5px] text-muted-foreground">
              gem. {formatSolveTime(avgSolveMs)} per gebied
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {slots.length === 0 ? (
          <motion.p key="empty" {...SWAP} className="m-auto text-sm text-muted-foreground">
            Nog geen hints
          </motion.p>
        ) : (
          <motion.div key="bars" {...SWAP} className="mt-3 flex min-h-0 flex-1 gap-[7px]">
            <AnimatePresence initial={false} mode="popLayout">
              {slots.map((slot, index) => {
                const newest = index === slots.length - 1;
                return (
                  <motion.div
                    key={slot.slotTime}
                    layout
                    transition={LAYOUT_SPRING}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    title={`${slot.hour}:00 · ${slot.solved} van ${slot.solved + slot.open} opgelost`}
                    className="flex min-w-0 flex-1 flex-col"
                  >
                    <motion.div
                      className="flex flex-1 origin-bottom flex-col justify-end gap-0.5"
                      initial={entrance ? { scaleY: 0 } : false}
                      animate={{ scaleY: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.12 + index * 0.045 }}
                    >
                      <motion.div className="rounded-[4px] bg-orange-300 dark:bg-orange-400/80" initial={false} animate={{ height: `${(slot.open / max) * 100}%` }} transition={LAYOUT_SPRING} />
                      <motion.div className="rounded-[4px] bg-green-400 dark:bg-green-500/80" initial={false} animate={{ height: `${(slot.solved / max) * 100}%` }} transition={LAYOUT_SPRING} />
                    </motion.div>
                    <span className={cn('mt-1.5 text-center text-[11px] tabular-nums', newest ? 'font-bold text-foreground' : 'text-muted-foreground')}>{slot.hour}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-2 flex gap-3.5 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green-400" aria-hidden />
          opgelost
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-orange-300" aria-hidden />
          open
        </span>
      </div>
    </div>
  );
}
```

Notes for the implementer: percentage heights need the bar column to have a definite height — `flex-1` inside a `flex-col` whose parent is `flex-1 min-h-0` works; if a bar renders 0 high, give the bars row `h-[150px]` instead of `flex-1` and say so in the report. `bg-primary-container` exists as a theme colour (`--color-primary-container`).

- [ ] **Step 3: Mount it in the timeline view**

In `IntelDialog.tsx`:
- In `IntelWindow`, after `useHintBoard`: `const cells = useMemo(() => board?.cells ?? [], [board]);`
- Pass to `TimelineView` two new props: `allItems={items}` and `cells={cells}`.
- `TimelineViewProps` gets `allItems: IntelItem[]; cells: HintCell[];` (import `type HintCell` from `@/types/HintCell`, `StatusCard` from `./StatusCard`).
- `TimelineView` returns:

```tsx
    <div className="flex min-h-0 flex-1 gap-3.5 px-4 pb-4">
      <motion.div
        ref={ref}
        layoutScroll
        onScroll={(event) => {
          memoryRef.current = { tab, top: event.currentTarget.scrollTop };
        }}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
      >
        <IntelTimeline items={items} tab={tab} skipEntrance={skipEntrance} returnId={returnId} onSelect={onSelect} />
      </motion.div>
      {/* Stats over every kind, whatever the tab. skipEntrance is true on the window's first paint: that is the card's entrance */}
      <StatusCard items={allItems} cells={cells} entrance={skipEntrance} />
    </div>
```

In `IntelTimeline.tsx` change `<div className="pr-[200px] pl-[150px]">` to `<div className="pr-2">`.

- [ ] **Step 4: Check**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: clean, PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/motion/CountUp.tsx src/components/intel-window/StatusCard.tsx src/components/intel-window/IntelDialog.tsx src/components/intel-window/IntelTimeline.tsx
git commit -m "feat(intel): status card with tiles and oplos-tempo next to the timeline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Timeline without the morph; tabs push sideways

**Files:**
- Modify: `src/components/intel-window/IntelTimeline.tsx`
- Modify: `src/components/intel-window/IntelDialog.tsx` (`TimelineView` props/usage)

**Interfaces:**
- Consumes: `INTEL_TAB_ORDER` (Task 2).
- Produces: `IntelTimeline` props become `{ items: IntelItem[]; tab: IntelTab; onSelect: (id: number) => void; entrance: boolean }` (`entrance`, read on mount: cards stagger in; false: they are just there). `DeadlineTag`, `KindTag` exports unchanged.

- [ ] **Step 1: Remove the return-morph machinery**

In `IntelTimeline.tsx` delete: `RETURN_BASE`, the `settle` variants, `useMorphIds` import and use, `INTEL_MORPH` import, the `returnId`/`morphId`/`lifted`/`tabChanged`/`firstTab` state and effect, `Fold`'s `clip` prop (always clip), the `custom={returning}`/`settle` props on the time, rail, tag and chip elements (plain `div`/`span` now, keep their classes), `onLanded`. `entry.hidden` becomes `{ opacity: 0, y: 8 }` (no function). `day.shown` always uses `BASE`.

`WideCard` becomes a plain card (the frame is the button's own background):

```tsx
function WideCard({ item, now, onSelect }: { item: IntelItem; now: number; onSelect: (id: number) => void }) {
  const states = item.kind === 'hint' ? areaStates(item.cells) : null;
  const count = item.kind === 'hint' ? solvedCount(item.cells) : null;
  const status = item.assignment?.status ?? 'open';
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="my-[5px] block w-full rounded-[20px] bg-card px-[15px] py-[13px] text-left outline-none transition-colors hover:bg-beheer-row focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex items-center gap-2">
        <UnreadDot unread={item.unread} />
        <span className="text-[14.5px] font-bold">{item.title}</span>
        <KindTag kind={item.kind} />
        {count && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {count.solved}/{count.total} opgelost
          </span>
        )}
        {item.kind === 'assignment' && item.endTime && <DeadlineTag endTime={item.endTime} now={now} status={status} className="ml-auto shrink-0" />}
      </span>
      {item.summary && <span className="mt-[3px] line-clamp-2 block text-xs text-muted-foreground">{item.summary}</span>}
      {states && (
        <span className="mt-2.5 flex flex-wrap gap-1">
          {areaOptions.map(({ value, label }) => (
            <AreaChip key={value} area={value} state={states[value]} label={label} />
          ))}
        </span>
      )}
      {item.kind === 'assignment' && (
        <span className="mt-2.5 flex gap-1.5">
          <Tag>{ASSIGNMENT_STATUS_LABELS[status]}</Tag>
          <Tag>{item.assignment?.owner?.name ?? 'niemand'}</Tag>
          {item.maxPoints ? <Tag>max {item.maxPoints} pt</Tag> : null}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Tab push**

Replace the `list` variants and `TimelineList`, and the top of `IntelTimeline`:

```tsx
/**
 * A tab switch pushes the list sideways: the old one leaves away from the new tab (x ∓30px, 0.16 s), the new one comes
 * in from its side (0.28 s). `custom` = direction (1: the new tab is further right). Labels: `hidden` = window just
 * opened (the cards stagger in, the list itself is still), `push` = a tab switch, `insert` = mounted while on screen.
 */
const list: Variants = {
  hidden: {},
  push: (direction: number) => ({ opacity: 0, x: 30 * direction }),
  insert: {},
  shown: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } },
  gone: (direction: number) => ({ opacity: 0, x: -30 * direction, transition: { duration: 0.16, ease: 'easeIn' } }),
};
```

```tsx
export default function IntelTimeline({ items, tab, onSelect, entrance }: TimelineProps) {
  const now = useMinute();
  const groups = groupByDay(items, now);
  // Derived during render: which way the last tab switch went, and whether there was one (only the first list may stagger in)
  const [last, setLast] = useState({ tab, direction: 1, switched: false });
  if (last.tab !== tab) setLast({ tab, direction: INTEL_TAB_ORDER.indexOf(tab) > INTEL_TAB_ORDER.indexOf(last.tab) ? 1 : -1, switched: true });
  const [stagger] = useState(entrance);
  return (
    <AnimatePresence mode="wait" custom={last.direction}>
      <TimelineList key={tab} start={last.switched ? 'push' : stagger ? 'hidden' : false} direction={last.direction}>
        {/* …unchanged body: empty state + groups, using the simplified rows and WideCard… */}
      </TimelineList>
    </AnimatePresence>
  );
}

/** One list (one tab). `start` is read once, when it mounts. */
function TimelineList({ start, direction, children }: { start: 'hidden' | 'push' | false; direction: number; children: ReactNode }) {
  const [initial] = useState(start);
  return (
    <motion.div custom={direction} variants={list} initial={initial} animate="shown" exit="gone" className="w-full pb-8">
      <InsertContext.Provider value={initial !== 'hidden'}>{children}</InsertContext.Provider>
    </motion.div>
  );
}
```

Notes:
- Children inherit the list's label. `entry` has no `push` key, so on a tab switch the cards ride along with the list instead of staggering; with `hidden` they stagger (window open). Keep `entry.insert: {}` and `entry.shown`.
- `InsertContext` true means a Fold mounted later unfolds; on the first window paint the list is `hidden` → false until mounted. Keep the existing `useHasMounted` inside `Fold` as it is.
- `TimelineProps`: replace `skipEntrance`/`returnId` with `entrance: boolean` (doc: "Read on mount: the window just opened, so the cards stagger in").
- Delete the now-unused `useHasMounted` import from this file only if nothing else in it uses it (`Fold` does — keep it).

- [ ] **Step 3: Dialog usage**

In `IntelDialog.tsx` `TimelineView`: drop `returnId` and `skipEntrance` props → one `entrance: boolean` prop; render `<IntelTimeline items={items} tab={tab} entrance={entrance} onSelect={onSelect} />` and `<StatusCard … entrance={entrance} />`. Remove the `returnId` centring part of the mount `useLayoutEffect` (keep restoring `saved.top` for the same tab). In `IntelWindow` pass `entrance={!mounted}` (true only on the window's first paint: the cards stagger in and the status card counts up; a timeline pushed back in later just slides), and remove `resolvedId`/`returnId`/`view.from` bookkeeping that only served the return morph (keep the `useEffect` that sends a vanished selection back to the timeline, rewritten to not need `resolvedId`: track "has shown" with a ref `shownIdRef` set when `selected` is non-null).

- [ ] **Step 4: Check by hand**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: clean, PASS. (Behaviour check in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/components/intel-window/IntelTimeline.tsx src/components/intel-window/IntelDialog.tsx
git commit -m "feat(intel): timeline drops the card morph; tab switches push sideways

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Back button in the top bar, aligned detail, view push

**Files:**
- Modify: `src/components/intel-window/IntelTopBar.tsx`
- Modify: `src/components/intel-window/IntelDialog.tsx` (`IntelWindow`, `View` → `PushView`, `DetailView`, remove `DetailColumn`/`DetailSlide`)
- Modify: `src/components/intel-window/IntelDetail.tsx`
- Modify: `src/components/intel-window/NewsPane.tsx`, `AssignmentPane.tsx`, `HintPane.tsx` (drop `DETAIL_PART`)
- Delete: `src/components/intel-window/morph.ts`
- Modify: `src/lib/intel-window.ts` (delete `DETAIL_SWAP`, `DETAIL_PART`, `DETAIL_HEAD`, `INTEL_MORPH`, `CHAT_CARD_ENTER`)

**Interfaces:**
- Consumes: `PUSH`, `INTEL_TAB_ORDER` (Task 2), `StatusCard` (Task 3), new `IntelTimeline` props (Task 4).
- Produces: `IntelTopBar` props `{ unread: Partial<Record<IntelTab, boolean>>; detail: boolean; onBack: () => void }`.

- [ ] **Step 1: Top bar**

`IntelTopBar.tsx` — remove the countdown badge, `useNextHint`, `ClockIcon`; add the back button that grows in:

```tsx
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeftIcon } from 'lucide-react';
import { INTEL_TAB_ORDER } from '@/lib/intel-window';
import { POP, SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { IntelTab } from '@/types/Intel';

const LABELS: Record<IntelTab, string> = { all: 'Alles', hint: 'Hints', assignment: 'Opdrachten', news: 'Nieuws' };

/**
 * Back button (only on an item; grows in from zero width), "Intel" and the tabs (a dot on Nieuws / Opdrachten while one
 * of those is unread). 64px high so it centres on the dialog's close button; leaves room right for it.
 */
export default function IntelTopBar({ unread, detail, onBack }: { unread: Partial<Record<IntelTab, boolean>>; detail: boolean; onBack: () => void }) {
  const tab = useIntelStore((state) => state.tab);
  const setTab = useIntelStore((state) => state.setTab);
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 pr-16 pl-4">
      <motion.button
        type="button"
        onClick={onBack}
        title="Terug naar de tijdlijn (Esc)"
        aria-label="Terug naar de tijdlijn"
        tabIndex={detail ? 0 : -1}
        aria-hidden={!detail}
        initial={false}
        animate={detail ? { width: 34, marginRight: 0, opacity: 1 } : { width: 0, marginRight: -12, opacity: 0 }}
        transition={SWAP_TRANSITION}
        className="grid h-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl bg-beheer-row-high text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon className="size-4" />
      </motion.button>
      <h2 className="text-[17px] font-bold">Intel</h2>
      <div role="tablist" aria-label="Soort" className="flex gap-0.5 rounded-xl bg-beheer-row-high p-[3px]">
        {INTEL_TAB_ORDER.map((value) => {
          const active = value === tab;
          return (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(value)}
              className={cn('relative flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {active && <motion.span layoutId="intel-tab" className="absolute inset-0 rounded-[9px] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.06)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{LABELS[value]}</span>
              <AnimatePresence>{unread[value] && <motion.span key="dot" {...POP} className="relative size-[7px] rounded-full bg-primary" aria-label="ongelezen" />}</AnimatePresence>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

(Tabs: active indicator is now `bg-card` on a `bg-beheer-row-high` track, as in the approved mockup; the tab still stays active while an item is open, and clicking any tab goes back via `setTab`.)

- [ ] **Step 2: Push between views in `IntelDialog.tsx`**

In `IntelWindow`, replace the `resolvedId`/`view`/`timelineTab` derivations and the render with:

```tsx
  // Derived during render: a key per view (timeline, or one per item) and which way it pushes. Forward (+1): timeline →
  // item, or to a newer item; back (−1): item → timeline, or to an older item. `gen` keys the view, so a quick
  // back-and-forth mounts a fresh one instead of reviving one that is still leaving.
  const viewKey = selected ? `item-${selected.id}` : 'timeline';
  const [view, setView] = useState({ key: viewKey, gen: 0, direction: 1, publishAt: selected?.publishAt ?? null });
  if (view.key !== viewKey) {
    const direction = !selected ? -1 : view.publishAt === null || selected.publishAt >= view.publishAt ? 1 : -1;
    setView({ key: viewKey, gen: view.gen + 1, direction, publishAt: selected?.publishAt ?? null });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IntelTopBar detail={selected !== null} onBack={() => select(null)} unread={{ news: unreadCount(items, 'news') > 0, assignment: unreadCount(items, 'assignment') > 0 }} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={view.direction}>
          <PushView key={`${view.key}-${view.gen}`} direction={view.direction}>
            {selected ? (
              <DetailView item={selected} area={area} mapRef={mapRef} entrance={!mounted} />
            ) : (
              <TimelineView items={shown} allItems={items} cells={cells} tab={tab} memoryRef={timelineScroll} entrance={!mounted} onSelect={select} />
            )}
          </PushView>
        </AnimatePresence>
      </div>
    </div>
  );
```

Replace `View` with:

```tsx
/** One view, pushed in and out sideways (PUSH, custom = direction). The leaving one sits underneath and takes no input. */
function PushView({ direction, children }: { direction: number; children: ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      custom={direction}
      variants={PUSH}
      initial="enter"
      animate="center"
      exit="exit"
      inert={!isPresent}
      className={cn('absolute inset-0 flex flex-col', isPresent ? 'z-[1]' : 'pointer-events-none z-0')}
    >
      {children}
    </motion.div>
  );
}
```

Replace `DetailView` (and delete `DetailColumn`, `DetailSlide`, the floating pill, `Pill`/`ArrowLeftIcon`/`EASE_OUT`/`CHAT_CARD_ENTER`/`DETAIL_SWAP` imports):

```tsx
/**
 * The open item: left its column (title card, summary, pane; scrolls on its own), right the AI chat card. Both start at
 * the top of the body, so the title card and the chat card line up. Another item replaces the whole view (a push).
 */
function DetailView({ item, area, mapRef, entrance }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null>; entrance: boolean }) {
  // The window opened straight on this item: no ✦ spin (the dialog's own entrance plays); pushed in later: spin
  const [firstPaint] = useState(entrance);
  return (
    <div className="flex min-h-0 flex-1 gap-3.5 px-4 pb-4">
      <div className="@container min-h-0 min-w-0 flex-[1.25] overflow-y-auto pr-1 [scrollbar-gutter:stable]">
        <IntelDetail item={item} area={area} mapRef={mapRef} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* While the chunk loads: the chat card's empty shell (IntelChat's root classes) */}
        <Suspense fallback={<div className="flex min-h-0 flex-1 flex-col rounded-[24px] bg-card p-3.5" />}>
          <IntelChat item={item} mapRef={mapRef} entrance={!firstPaint} />
        </Suspense>
      </div>
    </div>
  );
}
```

`entrance` (DetailView prop) is true only on the window's first paint, same as the timeline's. The chat keeps today's behaviour (`entrance={!skip}` with skip = first paint): no ✦ spin when the window opens on the item, spin when the item is pushed in later.

Clean up: remove the long choreography comment block and replace it with one line above the return: `{/* Views push sideways (PUSH); tabs push the list inside the timeline view (IntelTimeline) */}`. Remove now-unused imports (`useLayoutEffect` stays for TimelineView, `useHasMounted` stays for `mounted`).

- [ ] **Step 3: Detail header without the morph**

`IntelDetail.tsx`: drop `motion`, `useMorphIds`, `DETAIL_HEAD`, `DETAIL_PART`, `INTEL_MORPH`. The header:

```tsx
      <div className="rounded-[24px] bg-card px-6 pt-5 pb-[18px]">
        <h2 className="text-[21px] leading-tight font-bold">{item.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          {/* …the existing meta line, unchanged… */}
        </div>
      </div>
      {item.summary && <SummaryCard summary={item.summary} />}
```

Update the component doc comment: "The open item: a header card (title + meta line), summary and the pane for its kind."

- [ ] **Step 4: Panes**

In `NewsPane.tsx`, `AssignmentPane.tsx`, `HintPane.tsx`: replace each `<motion.div variants={DETAIL_PART} …>` / `</motion.div>` pair with `<div …>` / `</div>` (keep `className`), remove the `DETAIL_PART` import, and remove the `motion` import where nothing else in the file uses it.

- [ ] **Step 5: Delete dead code**

Delete `src/components/intel-window/morph.ts`. In `src/lib/intel-window.ts` delete `DETAIL_SWAP`, `DETAIL_PART`, `DETAIL_HEAD`, `INTEL_MORPH`, `CHAT_CARD_ENTER` and their comments.

Run: `grep -rn "DETAIL_\|INTEL_MORPH\|CHAT_CARD_ENTER\|useMorphIds\|returnId" src`
Expected: no output.

- [ ] **Step 6: Check**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: clean, PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/intel-window src/lib/intel-window.ts
git commit -m "feat(intel): back button in the top bar, aligned detail, views push sideways

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Visual check in a browser

**Files:** none (fixes found here go into the file they concern, committed as `fix(intel): …`).

- [ ] **Step 1: Start a throwaway stack**

Server (with the server plan merged into its branch or checked out): `.stress/start-server.sh 3105 jotihunt-intel-redesign` from the server repo (sets WEBAUTHN env; seeds per its README). Client: `npx --yes bun run dev -- --port 5180` with the API pointing at `http://localhost:3105` (see `.env`/vite config for the variable used before in `.superpowers/sdd/progress.md`). Never touch the docker stack on :3000/:8080. Seed hint articles/cells and some solved cells with `solvedAt` (or use demo mode).

- [ ] **Step 2: Walk the checklist with Playwright** (cached chromium_headless_shell + playwright-core in /tmp, as in the Account dialog check; log in with a login link / `_auth` cookies)

- Shell: 28px corners, tonal 34×32 close, same as the Account dialog (screenshot both).
- Top bar: no countdown badge; "Intel" + tabs; back button hidden on the timeline.
- Timeline left, status card right; tiles show sane numbers; clicking Hints/Opdrachten/Ongelezen switches tab; chart has bars, hour labels, legend, average when `solvedAt` exists.
- Open an item: timeline pushes left, detail in from the right; back button grows in; title card top == chat card top (measure `getBoundingClientRect().top`, equal within 1px).
- Back (button and Esc): mirror push, scroll position restored.
- Tab switch on the timeline: list pushes in the tab's direction; tab click while on an item goes back to that tab.
- Toast/mini grid opening another item while one is open: push by publish time.
- Window open: rises in, tiles count up, bars grow.
- Dark mode screenshot of timeline + detail.
- Emulate `prefers-reduced-motion: reduce`: views cross-fade, numbers show final values.

- [ ] **Step 3: Final checks and commit fixes**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: clean, PASS. Commit any fixes.
