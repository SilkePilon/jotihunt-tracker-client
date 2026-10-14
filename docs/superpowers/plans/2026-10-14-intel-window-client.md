# Intel window — client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the full-screen `/hints` page and add a desktop-only "Intel" dialog in the Beheer look: a day-grouped timeline of hints, opdrachten and nieuws that shrinks to the left third when an item opens, with the item on the right (hint solving per area, opdracht bookkeeping, news read state).

**Architecture:** New folder `src/components/intel-window/` (dialog shell, top bar, timeline, detail panes), a zustand store `src/stores/intel.store.ts` for open/selection state (no URL), pure helpers in `src/lib/intel-window.ts` (unit-tested), and trimmed data hooks (`hints.hook.ts`, `assignments.hook.ts`, `read-state.hook.ts`). Motion choreography with `motion/react`. Entry points: sidebar mini grid and an "Openen" action on hint/news toasts.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind v4, SWR (`useAuthSWR`, `fetcherWithMethod`), zustand, `motion/react` (MotionConfig `reducedMotion="user"` is global in `main.tsx`), sonner toasts, Bun test runner for `src/lib/*.test.ts`.

Spec: `docs/superpowers/specs/2026-10-14-intel-window-design.md`. Mockups (open them, they are the visual reference): `.superpowers/brainstorm/1004222-1791989094/content/intel-a-v5.html` (T1 transition + S1 summary, section 1 option T1), `intel-hints-v6.html` (H2 hint pane + O opdracht/nieuws). Server counterpart: `jotihunt-tracker-server/docs/superpowers/plans/2026-10-14-intel-window-server.md` (must ship together).

## Global Constraints

- Desktop only: the dialog never renders when `useIsMobile()` is true. Phones keep the mini grid's current behaviour.
- Beheer look: window `bg-beheer-window`, `sm:rounded-[20px]`, cards `rounded-3xl bg-card p-4` (`BeheerCard`), tonal rows `bg-beheer-row` / open `bg-beheer-row-high` (first row `rounded-t-2xl`, last `rounded-b-2xl`, inner `rounded-md`, 2px gaps), buttons via `Pill` / `IconPill` (`rounded-lg` = 12px), no icons in card titles, no avatar circles.
- Type colours: hint orange `#fb923c` (`text-orange-400`), opdracht blue `#60a5fa` (`text-blue-400`), nieuws purple `#c084fc` (`text-purple-400`).
- Area chips: solved = green cookie check (`CookieBadge tone="ok"`, popping in with `SuccessBadge` when it becomes solved), open = no badge, no hint / no cell = dimmed (`opacity-40`) and **no dash**.
- Summary card (S1): `BeheerCard` title "Samenvatting", right "automatisch · kan fouten bevatten" (muted, 12px), the text. No "voor ons" points anywhere.
- Hint solving is answer-only (no claims, checks, notes, status). Opdracht status options: Open / Bezig / Ingeleverd / Skip (`open | busy | submitted | skipped`).
- Every state change animates (enter/exit/swap); nothing pops. Use `motion/react`, `lib/motion.ts` (`SWAP`, `POP`, `EASE_OUT`, `REVEAL_TRANSITION`), `Reveal`, `AutoHeight`.
- Commands: tests `npx --yes bun test <path>`; types/build `npm run build` (runs `vite build && tsc -b`); lint `npm run lint`.
- Branch `feat/intel-window` from `main` in `jotihunt-tracker-client`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Dutch UI copy exactly as written in this plan.

## File Structure

Create:
- `src/stores/intel.store.ts` — open state + selected article/area + tab.
- `src/lib/intel-window.ts` (+ `src/lib/intel-window.test.ts`) — items, tabs, day groups, area states, next open area, deadline label, marker-409 check.
- `src/components/intel-window/IntelDialog.tsx` — dialog shell, data loading, split layout + choreography.
- `src/components/intel-window/IntelTopBar.tsx` — title, tabs, countdown.
- `src/components/intel-window/IntelTimeline.tsx` — wide timeline and compact rows.
- `src/components/intel-window/AreaChips.tsx` — `AreaChip` (wide) and `AreaStrip` (compact).
- `src/components/intel-window/IntelDetail.tsx` — header + summary + per-kind pane.
- `src/components/intel-window/SummaryCard.tsx`
- `src/components/intel-window/ArticleHtml.tsx` — sanitised article HTML with image lightbox.
- `src/components/intel-window/HintPane.tsx` — H2 expandable area rows + answer field.
- `src/components/intel-window/AssignmentPane.tsx`
- `src/components/intel-window/NewsPane.tsx`

Rewrite: `src/types/Intel.ts`, `src/types/HintCell.ts` (fields), `src/hooks/hints.hook.ts` (actions), `src/hooks/assignments.hook.ts`, `src/hooks/read-state.hook.ts`, `src/lib/hints.ts` (drop `hintStep`), `src/components/sidebar/HintMiniGrid.tsx`.

Modify: `src/Routes.tsx`, `src/Layout.tsx`, `src/components/ResponsiveDialog.tsx` (optional `onEscapeKeyDown`), `src/hooks/notification-feed.hook.ts`, `src/components/tour/steps.ts`, `src/types/Article.ts`.

Delete: `src/pages/Hints.tsx`, `src/components/intel/` (whole folder), `src/components/hints/detail/` (whole folder), `src/hooks/presence.hook.ts`, `src/hooks/guarded-write.hook.ts`, `src/hooks/hint-actions.hook.ts`, `src/lib/intel.ts`, `src/lib/intel.test.ts`.

---

### Task 0: Branch

- [ ] `cd jotihunt-tracker-client && git checkout -b feat/intel-window main && npx --yes bun test` (baseline green).

---

### Task 1: Remove the /hints page and the old intel code

**Files:** see "Delete" above; modify `src/Routes.tsx`, `src/Layout.tsx`, `src/types/Intel.ts`, `src/types/HintCell.ts`, `src/types/Article.ts`, `src/hooks/hints.hook.ts`, `src/hooks/assignments.hook.ts`, `src/hooks/read-state.hook.ts`, `src/lib/hints.ts`, `src/lib/hints.test.ts`, `src/components/sidebar/HintMiniGrid.tsx`, `src/components/tour/steps.ts`.

**Interfaces (Produces):**
- `src/types/HintCell.ts`:
  ```ts
  export type HintCellStatus = 'open' | 'solved' | 'none';
  export interface UserRef { _id: string; name: string }
  export interface HintCell {
    _id: string; articleId: number; area: string; publishAt: string; slotTime: string; snippet?: string;
    status: HintCellStatus; answer?: string; answerKind?: 'rd' | 'text'; answerLocation?: [number, number];
    markerId?: string; articleChanged: boolean;
  }
  export interface HintArticle { id: number; title: string; publishAt: string; content: string }
  export interface HintBoard { articles: HintArticle[]; cells: HintCell[] }
  export interface RdPreview { x: number; y: number; lng: number; lat: number }
  ```
- `src/types/Intel.ts` (whole file):
  ```ts
  import type { HintCell, UserRef } from './HintCell';

  /** What an article is in the intel window; every article type other than hint and assignment is news */
  export type IntelKind = 'hint' | 'assignment' | 'news';
  /** The tabs of the intel window */
  export type IntelTab = 'all' | IntelKind;

  /** How far we are with an assignment */
  export type AssignmentStatus = 'open' | 'busy' | 'submitted' | 'skipped';

  export interface AssignmentNote {
    _id: string;
    user: UserRef | null;
    text: string;
    createdAt: string;
  }

  /** Our own bookkeeping of an assignment article; articles without one are open and unowned */
  export interface Assignment {
    _id: string;
    articleId: number;
    status: AssignmentStatus;
    statusBy?: UserRef | null;
    statusAt?: string;
    owner?: UserRef | null;
    ownerBy?: UserRef | null;
    ownerAt?: string;
    notes: AssignmentNote[];
  }

  /** Which articles the current user opened, and per article the names of everyone who opened it */
  export interface ReadState {
    read: number[];
    readBy: Record<string, string[]>;
  }

  /** One article in the intel window, joined with its hint cells, assignment bookkeeping and read state */
  export interface IntelItem {
    id: number;
    kind: IntelKind;
    title: string;
    /** ISO */
    publishAt: string;
    content: string;
    summary?: string;
    /** Hint cells of this article (hints only) */
    cells: HintCell[];
    /** ISO deadline (assignments only) */
    endTime?: string;
    maxPoints?: number;
    assignment?: Assignment;
    /** News and assignments the current user has not opened yet */
    unread: boolean;
    /** Names of the users who opened it */
    readBy: string[];
  }

  /** How an area of a hint stands: no cell at all = missing */
  export type AreaState = 'solved' | 'open' | 'none' | 'missing';

  /** Timeline items of one day */
  export interface DayGroup {
    /** YYYY-MM-DD in Dutch time */
    key: string;
    /** "Vandaag · zaterdag 17 okt", "Gisteren · vrijdag 16 okt", "donderdag 15 okt" */
    label: string;
    items: IntelItem[];
  }
  ```
- `useHintBoard()` returns `{ board, isLoading, isError, actions: { refresh(), solve(articleId: number, area: string, answer: string, replaceMarker?: boolean): Promise<HintCell> } }` (`actions` also spread at top level, as today).
- `useAssignments()` returns `{ assignments, members, isError, refresh, setStatus(articleId, status), setOwner(articleId, ownerId | null), addNote(articleId, text) }`.
- `useReadState()` returns `{ readState: ReadState | undefined, markRead(articleId: number) }`.
- `src/stores/intel.store.ts` (Step 1) — `HintMiniGrid`'s desktop cell click and "Open hints" call its `openIntel`; the dialog that reads it arrives in Task 3.

- [ ] **Step 1: Store** — create `src/stores/intel.store.ts`:

```ts
import { create } from 'zustand';
import type { IntelTab } from '@/types/Intel';

interface IntelState {
  /** The intel window shows while true */
  open: boolean;
  /** The article shown on the right (split view), or null for the wide timeline */
  articleId: number | null;
  /** For a hint: the area to unfold first (from the mini grid), or null for the first open area */
  area: string | null;
  tab: IntelTab;
  /** Open the window, optionally on an article (and area of a hint) */
  openIntel: (articleId?: number | null, area?: string | null) => void;
  /** Show an article on the right, or null to go back to the wide timeline */
  select: (articleId: number | null) => void;
  setTab: (tab: IntelTab) => void;
  close: () => void;
}

const useIntelStore = create<IntelState>()((set) => ({
  open: false,
  articleId: null,
  area: null,
  tab: 'all',
  openIntel: (articleId = null, area = null) => set({ open: true, articleId, area }),
  select: (articleId) => set({ articleId, area: null }),
  setTab: (tab) => set({ tab }),
  close: () => set({ open: false }),
}));

export default useIntelStore;
```

- [ ] **Step 2: Delete** `src/pages/Hints.tsx`, `src/components/intel/`, `src/components/hints/detail/`, `src/hooks/presence.hook.ts`, `src/hooks/guarded-write.hook.ts`, `src/hooks/hint-actions.hook.ts`, `src/lib/intel.ts`, `src/lib/intel.test.ts` (`git rm -r`). If `src/components/hints/` is then empty, it disappears with them.

- [ ] **Step 3: Routes/Layout** — `src/Routes.tsx`: remove `import Hints from './pages/Hints';` and the `<Route path="/hints" … />` line. `src/Layout.tsx`: replace

```tsx
            {/* The hints page covers the map: keep keyboard focus and screen readers out of what is hidden underneath */}
            <div inert={pathname === '/hints'}>
                <ErrorBoundary name="De kaart" className="mx-auto mt-[40dvh] w-fit">
                    <Map ref={mapRef}/>
                </ErrorBoundary>
            </div>
```

with

```tsx
            <ErrorBoundary name="De kaart" className="mx-auto mt-[40dvh] w-fit">
                <Map ref={mapRef}/>
            </ErrorBoundary>
```

  and fix the comment above `<StaleDataBadge/>` to `{/* After the outlet: at the same z-index the later element is on top */}`. Remove `pathname` from `useLocation()` destructuring if nothing else uses it (check with grep in the file).

- [ ] **Step 4: Types** — write `src/types/Intel.ts` and the `HintCell.ts` content from **Interfaces** above. In `src/types/Article.ts` delete `summaryPoints` and its comment.

- [ ] **Step 5: Hooks** — `src/hooks/hints.hook.ts`: drop the `WriteFlags` and `HintCheck` imports; the `actions` memo returns only:

```ts
    return {
      /** Fetch the board now instead of waiting for the next poll */
      refresh: () => mutate(),
      /** Store an answer; a 409 with `existingMarkerId` means another hint marker is there (resend with replaceMarker) */
      solve: (articleId: number, area: string, answer: string, replaceMarker = false) => post(articleId, area, 'solve', { answer, replaceMarker }),
    };
```

  and the polling comment becomes `// The intel window polls fast (answers by others show up quickly); the sidebar mini grid slowly`.
  `src/hooks/assignments.hook.ts`: import types from `@/types/Intel` (`Assignment`, `AssignmentStatus`) and `UserRef` from `@/types/HintCell`; `setStatus: (articleId: number, status: AssignmentStatus) => post(articleId, 'status', { status })`, `setOwner: (articleId: number, owner: string | null) => post(articleId, 'owner', { owner })`; `refresh` comment `/** Fetch the bookkeeping now */`.
  `src/hooks/read-state.hook.ts`: optimistic data becomes

```ts
          optimisticData: (current) => ({ read: [...(current?.read ?? []), articleId], readBy: current?.readBy ?? {} }),
```

  (names come with the revalidation that follows).

- [ ] **Step 6: lib/hints** — in `src/lib/hints.ts` delete `HintStepNumber`, `HintStep`, `hintStep` and update the polling doc comments ("hints page" → "intel window"). In `src/lib/hints.test.ts` delete the `hintStep` tests. Delete `remainingMs`/`HINT_WINDOW_MS` only if `grep -rn "remainingMs\|HINT_WINDOW_MS" src` shows no user outside `lib/hints*` (and then their tests too).

- [ ] **Step 7: Mini grid** — `src/components/sidebar/HintMiniGrid.tsx`:
  - imports: drop `useNavigate`, `selectionSearch`; add `import useIntelStore from '@/stores/intel.store';`
  - `cellClass` / `statusLabel`: remove the `solving` entries (record type follows `HintCell['status']`).
  - in the component: `const openIntel = useIntelStore((state) => state.openIntel);`; in `selectCell` the desktop branch becomes `openIntel(articleId, area); return;`; the button becomes `<Button variant="outline" size="sm" onClick={() => openIntel()}>Open hints <ArrowRightIcon /></Button>`.
  - `CellSummary`: remove the `case 'solving'`.
  - doc comment: "On desktop a cell opens that hint in the intel window".
- [ ] **Step 8: Tour** — `src/components/tour/steps.ts` hints step body becomes: `'De laatste hints per deelgebied in één oogopslag: groen is opgelost, grijs staat nog open. Op een laptop open je met "Open hints" het venster met alle hints, opdrachten en nieuws.'`

- [ ] **Step 9: Verify** — `npm run build && npx --yes bun test && npm run lint`. Expected: clean. `grep -rn "components/intel/\|/hints'\|presence\|guarded-write\|hint-actions\|summaryPoints\|claimedBy\|'solving'" src` → no hits.

- [ ] **Step 10: Commit** `refactor(intel): remove the /hints page; trim hint, assignment and read-state hooks` + co-author line.

---

### Task 2: Pure helpers (`lib/intel-window.ts`)

**Files:** Create `src/lib/intel-window.ts`, `src/lib/intel-window.test.ts`.

**Interfaces (Produces):**

```ts
export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string>; // { open: 'Open', busy: 'Bezig', submitted: 'Ingeleverd', skipped: 'Skip' }
export function buildIntelItems(input: { articles?: Article[]; board?: HintBoard; assignments?: Assignment[]; readState?: ReadState }): IntelItem[]; // newest first
export function filterByTab(items: IntelItem[], tab: IntelTab): IntelItem[];
export function groupByDay(items: IntelItem[], now: number): DayGroup[];
export function areaStates(cells: HintCell[]): Record<string, AreaState>; // keys = areaOptions values in order
export function solvedCount(cells: HintCell[]): { solved: number; total: number }; // total ignores 'none'
export function nextOpenArea(cells: HintCell[], after?: string | null): string | null;
export function unreadCount(items: IntelItem[]): number;
export function deadlineLabel(endTime: string, now: number): string; // "nog 42 min", "nog 1 u 47", "verlopen"
export function isDeadlineUrgent(endTime: string | undefined, now: number, status: AssignmentStatus): boolean; // < 1 h left and not submitted/skipped
export function hasExistingMarker(error: unknown): boolean; // axios 409 with data.existingMarkerId
```

- [ ] **Step 1: Failing tests** — `src/lib/intel-window.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import type { Article } from '@/types/Article';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem } from '@/types/Intel';
import { areaStates, buildIntelItems, deadlineLabel, filterByTab, groupByDay, hasExistingMarker, isDeadlineUrgent, nextOpenArea, solvedCount, unreadCount } from './intel-window';

const article = (id: number, type: string, publishAt: string, extra: Partial<Article> = {}) =>
  ({ id, title: `A${id}`, type, publishAt: new Date(publishAt), content: '<p>x</p>', messageType: '', maxPoints: 0, endTime: new Date(publishAt), ...extra }) as Article;
const cell = (area: string, status: HintCell['status'], articleId = 1): HintCell =>
  ({ _id: `${articleId}-${area}`, articleId, area, publishAt: '', slotTime: '', status, articleChanged: false }) as HintCell;

describe('buildIntelItems', () => {
  test('newest first, kinds, cells per hint, read state and assignment joined', () => {
    const items = buildIntelItems({
      articles: [article(1, 'hint', '2026-10-17T12:00:00Z'), article(2, 'news', '2026-10-17T13:00:00Z'), article(3, 'assignment', '2026-10-16T14:00:00Z', { maxPoints: 30 })],
      board: { articles: [], cells: [cell('alpha', 'solved'), cell('bravo', 'open', 9)] },
      assignments: [{ _id: 'x', articleId: 3, status: 'busy', notes: [] }],
      readState: { read: [2], readBy: { '2': ['Daan', 'Sanne'] } },
    });
    expect(items.map((item) => [item.id, item.kind])).toEqual([[2, 'news'], [1, 'hint'], [3, 'assignment']]);
    expect(items[1].cells.map((c) => c.area)).toEqual(['alpha']);
    expect(items[0]).toMatchObject({ unread: false, readBy: ['Daan', 'Sanne'] });
    expect(items[2]).toMatchObject({ unread: true, maxPoints: 30, assignment: { status: 'busy' } });
    expect(items[1].unread).toBe(false); // hints are never unread
  });
});

describe('tabs and unread', () => {
  const items = [{ kind: 'hint', unread: false }, { kind: 'news', unread: true }, { kind: 'assignment', unread: true }] as IntelItem[];
  test('filterByTab', () => {
    expect(filterByTab(items, 'all')).toHaveLength(3);
    expect(filterByTab(items, 'news').map((item) => item.kind)).toEqual(['news']);
  });
  test('unreadCount', () => expect(unreadCount(items)).toBe(2));
});

describe('groupByDay', () => {
  const now = new Date('2026-10-17T14:30:00Z').getTime();
  const at = (iso: string) => ({ publishAt: iso }) as IntelItem;
  test('Dutch days, today and yesterday named, order kept', () => {
    const groups = groupByDay([at('2026-10-17T21:59:00Z'), at('2026-10-17T08:00:00Z'), at('2026-10-16T12:00:00Z'), at('2026-10-14T12:00:00Z')], now);
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ['Vandaag · zaterdag 17 okt', 2],
      ['Gisteren · vrijdag 16 okt', 1],
      ['woensdag 14 okt', 1],
    ]);
  });
  test('midnight in Dutch time starts a new day (22:30Z on the 17th is Sunday 18th)', () => {
    expect(groupByDay([at('2026-10-17T22:30:00Z')], now)[0].label).toBe('zondag 18 okt');
  });
});

describe('areas', () => {
  const cells = [cell('alpha', 'solved'), cell('bravo', 'open'), cell('charlie', 'none'), cell('delta', 'open'), cell('oscar', 'open')];
  test('areaStates covers every area in order, missing ones too', () => {
    const states = areaStates(cells);
    expect(Object.keys(states)).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'oscar']);
    expect(states).toMatchObject({ alpha: 'solved', bravo: 'open', charlie: 'none', echo: 'missing' });
  });
  test('solvedCount ignores none', () => expect(solvedCount(cells)).toEqual({ solved: 1, total: 4 }));
  test('nextOpenArea: first open, after a given area with wrap-around, null when none', () => {
    expect(nextOpenArea(cells)).toBe('bravo');
    expect(nextOpenArea(cells, 'bravo')).toBe('delta');
    expect(nextOpenArea(cells, 'oscar')).toBe('bravo');
    expect(nextOpenArea([cell('alpha', 'solved')])).toBeNull();
  });
});

describe('deadlines', () => {
  const now = new Date('2026-10-17T12:00:00Z').getTime();
  test('labels', () => {
    expect(deadlineLabel('2026-10-17T12:42:00Z', now)).toBe('nog 42 min');
    expect(deadlineLabel('2026-10-17T13:47:00Z', now)).toBe('nog 1 u 47');
    expect(deadlineLabel('2026-10-17T11:00:00Z', now)).toBe('verlopen');
  });
  test('urgent under an hour unless done', () => {
    expect(isDeadlineUrgent('2026-10-17T12:30:00Z', now, 'open')).toBe(true);
    expect(isDeadlineUrgent('2026-10-17T12:30:00Z', now, 'submitted')).toBe(false);
    expect(isDeadlineUrgent('2026-10-17T15:00:00Z', now, 'busy')).toBe(false);
  });
});

test('hasExistingMarker', () => {
  const error = new AxiosError('x', '409', undefined, undefined, { status: 409, data: { existingMarkerId: 'm' }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } });
  expect(hasExistingMarker(error)).toBe(true);
  expect(hasExistingMarker(new Error('x'))).toBe(false);
});
```

- [ ] **Step 2:** `npx --yes bun test src/lib/intel-window.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implementation** — `src/lib/intel-window.ts`:

```ts
import { isAxiosError } from 'axios';
import type { Article } from '@/types/Article';
import type { HintBoard, HintCell } from '@/types/HintCell';
import type { AreaState, Assignment, AssignmentStatus, DayGroup, IntelItem, IntelKind, IntelTab, ReadState } from '@/types/Intel';
import { areaOptions } from '@/lib/utils';

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = { open: 'Open', busy: 'Bezig', submitted: 'Ingeleverd', skipped: 'Skip' };

const AREAS = areaOptions.map((area) => area.value);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const time = (date: unknown) => new Date(date as string).getTime();
const iso = (date: unknown) => (date ? new Date(date as string).toISOString() : undefined);
const kindOf = (type: string): IntelKind => (type === 'hint' || type === 'assignment' ? type : 'news');

/** Every article newest first, joined with its hint cells, assignment bookkeeping and read state */
export function buildIntelItems({ articles, board, assignments, readState }: { articles?: Article[]; board?: HintBoard; assignments?: Assignment[]; readState?: ReadState }): IntelItem[] {
  const read = new Set(readState?.read ?? []);
  const byArticle = new Map((assignments ?? []).map((assignment) => [assignment.articleId, assignment]));
  return [...(articles ?? [])]
    .sort((a, b) => time(b.publishAt) - time(a.publishAt))
    .map((article) => {
      const kind = kindOf(article.type);
      return {
        id: article.id,
        kind,
        title: article.title,
        publishAt: iso(article.publishAt) ?? '',
        content: article.content,
        summary: article.summary || undefined,
        cells: kind === 'hint' ? (board?.cells ?? []).filter((cell) => cell.articleId === article.id) : [],
        endTime: kind === 'assignment' ? iso(article.endTime) : undefined,
        maxPoints: kind === 'assignment' ? (article.maxPoints ?? undefined) : undefined,
        assignment: kind === 'assignment' ? byArticle.get(article.id) : undefined,
        unread: kind !== 'hint' && !read.has(article.id),
        readBy: readState?.readBy[String(article.id)] ?? [],
      };
    });
}

export function filterByTab(items: IntelItem[], tab: IntelTab): IntelItem[] {
  return tab === 'all' ? items : items.filter((item) => item.kind === tab);
}

export function unreadCount(items: IntelItem[]): number {
  return items.filter((item) => item.unread).length;
}

const dayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayName = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'short' });

/** "zaterdag 17 okt" (Intl gives "zaterdag 17 okt."; the dot goes) */
const dayLabel = (date: number) => dayName.format(date).replace(/\.$/, '');

/** Items (already sorted) per Dutch calendar day; today and yesterday are named */
export function groupByDay(items: IntelItem[], now: number): DayGroup[] {
  const today = dayKey.format(now);
  const yesterday = dayKey.format(now - DAY_MS);
  const groups: DayGroup[] = [];
  for (const item of items) {
    const date = time(item.publishAt);
    const key = dayKey.format(date);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const prefix = key === today ? 'Vandaag · ' : key === yesterday ? 'Gisteren · ' : '';
      group = { key, label: `${prefix}${dayLabel(date)}`, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** Per area (in the fixed area order): solved, open, none (no hint for that area) or missing (no cell) */
export function areaStates(cells: HintCell[]): Record<string, AreaState> {
  const byArea = new Map(cells.map((cell) => [cell.area, cell]));
  return Object.fromEntries(AREAS.map((area) => {
    const cell = byArea.get(area);
    return [area, cell ? (cell.status === 'solved' ? 'solved' : cell.status === 'none' ? 'none' : 'open') : 'missing'];
  }));
}

export function solvedCount(cells: HintCell[]): { solved: number; total: number } {
  const relevant = cells.filter((cell) => cell.status !== 'none');
  return { solved: relevant.filter((cell) => cell.status === 'solved').length, total: relevant.length };
}

/** The first open area (in area order), or the first one after `after` (wrapping around, never `after` itself) */
export function nextOpenArea(cells: HintCell[], after?: string | null): string | null {
  const states = areaStates(cells);
  const start = after ? AREAS.indexOf(after) + 1 : 0;
  const order = [...AREAS.slice(start), ...AREAS.slice(0, start)].filter((area) => area !== after);
  return order.find((area) => states[area] === 'open') ?? null;
}

/** "nog 42 min", "nog 1 u 47" or "verlopen" */
export function deadlineLabel(endTime: string, now: number): string {
  const left = time(endTime) - now;
  if (left <= 0) return 'verlopen';
  const minutes = Math.ceil(left / 60_000);
  return minutes < 60 ? `nog ${minutes} min` : `nog ${Math.floor(minutes / 60)} u ${minutes % 60}`;
}

export function isDeadlineUrgent(endTime: string | undefined, now: number, status: AssignmentStatus): boolean {
  if (!endTime || status === 'submitted' || status === 'skipped') return false;
  const left = time(endTime) - now;
  return left > 0 && left < HOUR_MS;
}

/** The solve was refused because another hint marker exists for that area and hour */
export function hasExistingMarker(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409 && !!(error.response.data as { existingMarkerId?: string } | undefined)?.existingMarkerId;
}
```

- [ ] **Step 4:** `npx --yes bun test src/lib/intel-window.test.ts` → PASS. If the `zondag 18 okt` / `okt` assertions fail because the runtime's ICU formats differently (e.g. "17 okt." handled, but month "oct"), print `dayName.format(...)` and adjust `dayLabel`'s cleanup — the expected strings in the test are the contract.
- [ ] **Step 5: Commit** `feat(intel): timeline helpers for the intel window` + co-author line.

---

### Task 3: Dialog shell, top bar and entry points

**Files:**
- Create: `src/components/intel-window/IntelDialog.tsx`, `src/components/intel-window/IntelTopBar.tsx`
- Modify: `src/components/ResponsiveDialog.tsx`, `src/Layout.tsx`, `src/hooks/notification-feed.hook.ts`

**Interfaces:**
- Consumes: `useIntelStore` (Task 1), helpers (Task 2), `useNextHint()` (`{ label, isUrgent, isNewHint, isCountdown }`).
- Produces: `<IntelDialog mapRef={mapRef} />` mounted in Layout; `ResponsiveDialog` prop `onEscapeKeyDown?: (event: KeyboardEvent) => void` (runs before the inline-edit guard; call `event.preventDefault()` to keep the dialog open). `IntelDialog` exposes nothing else. Task 4–6 fill the body via `IntelTimeline` / `IntelDetail` (temporarily render the item titles as a plain list so the task is testable).
- `useNotificationFeed` gets option `openArticle?: (articleId: number) => void`; when set, toasts of type `hint` and `article` with `data.articleId` get `action: { label: 'Openen', onClick: () => openArticle(articleId) }`.

- [ ] **Step 1: ResponsiveDialog** — add to the props interface:

```ts
  /** Escape on the desktop dialog, before the inline-edit guard; call event.preventDefault() to keep the dialog open (e.g. to close a sub-view first) */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
```

  destructure it, and on `DialogContent` use

```tsx
onEscapeKeyDown={(event) => {
  onEscapeKeyDown?.(event);
  if (!event.defaultPrevented) keepOpenWhileEditing(event);
}}
```

  (leave the drawer branch as is).

- [ ] **Step 2: Top bar** — `src/components/intel-window/IntelTopBar.tsx`:

```tsx
import { motion } from 'motion/react';
import { ClockIcon } from 'lucide-react';
import { useNextHint } from '@/hooks/next-hint.hook';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { IntelTab } from '@/types/Intel';
import { AnimatePresence } from 'motion/react';

const TABS: { value: IntelTab; label: string }[] = [
  { value: 'all', label: 'Alles' },
  { value: 'hint', label: 'Hints' },
  { value: 'assignment', label: 'Opdrachten' },
  { value: 'news', label: 'Nieuws' },
];

/** "Intel", the tabs (a dot on Nieuws while something is unread) and the countdown to the next hint. Leaves room right for the dialog's close button. */
export default function IntelTopBar({ unread }: { unread: boolean }) {
  const tab = useIntelStore((state) => state.tab);
  const setTab = useIntelStore((state) => state.setTab);
  const next = useNextHint();
  return (
    <div className="flex items-center gap-4 py-4 pr-14 pl-6">
      <h2 className="text-[17px] font-bold">Intel</h2>
      <div role="tablist" aria-label="Soort" className="flex gap-0.5 rounded-xl bg-beheer-row p-[3px]">
        {TABS.map((option) => {
          const active = option.value === tab;
          return (
            <button
              key={option.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(option.value)}
              className={cn('relative flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {active && <motion.span layoutId="intel-tab" className="absolute inset-0 rounded-[9px] bg-beheer-row-high" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{option.label}</span>
              <AnimatePresence>{option.value === 'news' && unread && <motion.span key="dot" {...POP} className="relative size-[7px] rounded-full bg-primary" aria-label="ongelezen" />}</AnimatePresence>
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold tabular-nums', next.isUrgent || next.isNewHint ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300')}>
        <ClockIcon className="size-3.5" />
        {next.isCountdown ? `Volgende hint over ${next.label}` : next.label}
      </span>
    </div>
  );
}
```

  (merge the two `motion/react` imports into one.)

- [ ] **Step 3: Dialog shell** — `src/components/intel-window/IntelDialog.tsx` (body is a placeholder list in this task; Task 4 replaces `<PlaceholderList>`):

```tsx
import { RefObject, useEffect, useMemo } from 'react';
import { MapRef } from '@/components/Map';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useArticles } from '@/hooks/articles.hook';
import { useAssignments } from '@/hooks/assignments.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { useReadState } from '@/hooks/read-state.hook';
import { buildIntelItems, filterByTab, unreadCount } from '@/lib/intel-window';
import useIntelStore from '@/stores/intel.store';
import IntelTopBar from './IntelTopBar';

/** Desktop window with hints, opdrachten and nieuws (phones keep the sidebar mini grid). */
export default function IntelDialog({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();
  const open = useIntelStore((state) => state.open);
  const close = useIntelStore((state) => state.close);

  // The store is global: Layout unmounts on /login, and a window left open would pop up again after the next login
  useEffect(() => () => useIntelStore.getState().close(), []);
  // Shrinking the window to phone size closes it
  useEffect(() => {
    if (isMobile && useIntelStore.getState().open) close();
  }, [isMobile, close]);

  if (isMobile) return null;
  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      title="Intel"
      description="Hints, opdrachten en nieuws."
      hideHeader
      onEscapeKeyDown={(event) => {
        // Escape first closes the item on the right, then the window
        const { articleId, select } = useIntelStore.getState();
        if (articleId !== null) {
          event.preventDefault();
          select(null);
        }
      }}
      className="h-[720px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[1160px] sm:rounded-[20px]"
    >
      <IntelWindow mapRef={mapRef} />
    </ResponsiveDialog>
  );
}

/** The window's content; only mounted while open (or closing). Polls fast while mounted. */
function IntelWindow({ mapRef: _mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const tab = useIntelStore((state) => state.tab);
  const { articles } = useArticles();
  const { board } = useHintBoard({ live: true });
  const { assignments } = useAssignments();
  const { readState } = useReadState();
  const items = useMemo(() => buildIntelItems({ articles, board, assignments, readState }), [articles, board, assignments, readState]);
  const shown = filterByTab(items, tab);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IntelTopBar unread={unreadCount(items) > 0} />
      <ul className="min-h-0 flex-1 overflow-y-auto px-6">
        {shown.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Layout** — `src/Layout.tsx`: import `IntelDialog from './components/intel-window/IntelDialog'` and render `<IntelDialog mapRef={mapRef}/>` right after `<BeheerDialog mapRef={mapRef}/>`. Pass the toast action: `useNotificationFeed({onUnauthorized: sessionExpired, openArticle: (articleId) => useIntelStore.getState().openIntel(articleId)});` (import `useIntelStore`). On phones the dialog does not render, so `openArticle` must check: `openArticle: isMobile ? undefined : (articleId) => …` with `const isMobile = useIsMobile();` in Layout.

- [ ] **Step 5: Toast action** — `src/hooks/notification-feed.hook.ts`:
  - `FeedOptions` gets `/** Desktop: hint/news toasts get an "Openen" button that opens the article */ openArticle?: (articleId: number) => void;`
  - destructure it in the hook signature and include it in `latest.current` (both the initial `useRef` value and the effect that refreshes it).
  - in the toast loop, replace the generic toast line with:

```ts
            const articleId = notification.data.articleId;
            const open = options.openArticle;
            const action = open && articleId !== undefined && (notification.type === 'hint' || notification.type === 'article') ? { label: 'Openen', onClick: () => open(articleId) } : undefined;
            toast[toastKind(notification)](notification.title, { description: notification.body || undefined, duration, action });
```

  (`showHighlightToast` keeps handling its own types first.)

- [ ] **Step 6: Verify** — `npm run build && npm run lint`. Manual check deferred to Task 7.
- [ ] **Step 7: Commit** `feat(intel): intel dialog shell, top bar, mini grid and toast entry points` + co-author line.

---

### Task 4: Timeline (wide + compact) and the split choreography

**Files:**
- Create: `src/components/intel-window/AreaChips.tsx`, `src/components/intel-window/IntelTimeline.tsx`
- Modify: `src/components/intel-window/IntelDialog.tsx`

**Interfaces:**
- `AreaChip({ area, state, label }: { area: string; state: AreaState; label: string })`, `AreaStrip({ cells }: { cells: HintCell[] })`.
- `IntelTimeline({ items, compact, selectedId, onSelect }: { items: IntelItem[]; compact: boolean; selectedId: number | null; onSelect: (id: number) => void })`.
- `IntelDialog` renders the split: left column (`motion.div`, width 100% ↔ 33.333%), separator, right column (Task 5's `IntelDetail`, here a placeholder `<div>` with the title).

Choreography (T1; see `intel-a-v5.html` → option T1 for the reference feel):
- **Open (wide → split):** the wide list fades out (0.13 s, x −12), then the column animates `width: 100%→33.333%` (0.42 s, `EASE_OUT`, delay 0.1 s); compact rows enter staggered (x +16 → 0, opacity, 0.32 s each, stagger 0.02 s, start delay 0.19 s); the separator scales Y 0→1 from the top (0.5 s, delay 0.12 s); the right column sits at `flex-basis: calc(66.667% - 1px)` inside an `overflow-hidden` row so it is pushed in from the right while the column shrinks, and its parts stagger in (x +28, 0.38 s, stagger 0.055 s, delay 0.15 s).
- **Swap (split, other item):** only the right side: old parts fade out (0.11 s), new parts stagger in (y +10).
- **Close (split → wide):** right parts fade out (x +24, 0.16 s) and the separator fades, compact rows fade out (x −10, 0.14 s), the column grows back (0.42 s), the wide list enters staggered (y +8, stagger 0.022 s, delay 0.21 s).
- Text never re-wraps while the column resizes: the list inside is swapped (`AnimatePresence mode="wait"`, keyed `wide`/`compact`) while hidden.
- `MotionConfig reducedMotion="user"` already turns these into instant changes for reduced motion.

- [ ] **Step 1: Area chips** — `src/components/intel-window/AreaChips.tsx`:

```tsx
import { AnimatePresence, motion } from 'motion/react';
import CookieBadge from '@/components/tracker/CookieBadge';
import SuccessBadge from '@/components/auth/SuccessBadge';
import { areaStates } from '@/lib/intel-window';
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
import type { HintCell } from '@/types/HintCell';
import type { AreaState } from '@/types/Intel';

const TITLE: Record<AreaState, string> = { solved: 'opgelost', open: 'nog open', none: 'geen hint', missing: 'geen hint' };

/** Area status chip in the wide timeline: dot + name, a green cookie check when solved, dimmed without a hint. Status only. */
export function AreaChip({ area, state, label }: { area: string; state: AreaState; label: string }) {
  const dim = state === 'none' || state === 'missing';
  return (
    <motion.span
      layout
      title={`${label}: ${TITLE[state]}`}
      className={cn('inline-flex h-[26px] items-center gap-1.5 rounded-[9px] bg-beheer-row pr-2.5 pl-2 text-xs font-semibold', state === 'solved' && 'pr-1.5', dim && 'opacity-40')}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area) }} aria-hidden />
      {label}
      <AnimatePresence initial={false}>{state === 'solved' && <SolvedCheck key="ok" />}</AnimatePresence>
    </motion.span>
  );
}

/** Pops in (and draws its check) when the area gets solved while the timeline is open; a plain badge on first render */
function SolvedCheck() {
  return (
    <motion.span className="inline-grid" initial={false} exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}>
      <SolvedBadge />
    </motion.span>
  );
}

let mounted = false;
function SolvedBadge() {
  // SuccessBadge animates on mount; on the first paint of the window use the static badge
  return mounted ? <SuccessBadge size={16} /> : <CookieBadge tone="ok" size={16} />;
}
export function markChipsMounted() {
  mounted = true;
}

/** Compact timeline row: one block per area — filled = solved, outlined = open, grey = no hint */
export function AreaStrip({ cells }: { cells: HintCell[] }) {
  const states = areaStates(cells);
  return (
    <span className="flex gap-[3px]" aria-label="Deelgebieden">
      {areaOptions.map(({ value, label }) => {
        const state = states[value];
        const color = getColorFromArea(value);
        return (
          <span
            key={value}
            title={`${label}: ${TITLE[state]}`}
            className="size-2.5 rounded-[3px] transition-colors duration-300"
            style={state === 'solved' ? { backgroundColor: color } : state === 'open' ? { boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${color} 45%, transparent)` } : { backgroundColor: 'var(--beheer-row-high)' }}
          />
        );
      })}
    </span>
  );
}
```

  **Simplify if you can:** the module-level `mounted` flag is a workaround so chips don't all animate on first open. A cleaner equivalent is preferred: pass `animateNew` down from `IntelTimeline` using a `useRef` that turns true after the first render effect, and render `SuccessBadge` only when `animateNew` is true. Use that instead of the module flag (then delete `markChipsMounted`).

- [ ] **Step 2: Timeline** — `src/components/intel-window/IntelTimeline.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { ClockIcon } from 'lucide-react';
import { Tag } from '@/components/beheer/controls/Pill';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, areaStates, deadlineLabel, groupByDay, solvedCount } from '@/lib/intel-window';
import { EASE_OUT } from '@/lib/motion';
import { areaOptions, cn } from '@/lib/utils';
import type { IntelItem, IntelKind } from '@/types/Intel';
import { AreaChip, AreaStrip } from './AreaChips';

export const KIND_COLOR: Record<IntelKind, string> = { hint: '#fb923c', assignment: '#60a5fa', news: '#c084fc' };
export const KIND_LABEL: Record<IntelKind, string> = { hint: 'Hint', assignment: 'Opdracht', news: 'Nieuws' };

const list: Variants = {
  hidden: {},
  shown: (compact: boolean) => ({ transition: { staggerChildren: compact ? 0.02 : 0.022, delayChildren: compact ? 0.19 : 0.21 } }),
  gone: (compact: boolean) => ({ opacity: 0, x: compact ? -10 : -12, transition: { duration: compact ? 0.14 : 0.13, ease: 'easeIn' } }),
};
const entry: Variants = {
  hidden: (compact: boolean) => ({ opacity: 0, x: compact ? 16 : 0, y: compact ? 0 : 8 }),
  shown: { opacity: 1, x: 0, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
};

/** Ticks once a minute: deadlines and day labels */
function useMinute() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

interface TimelineProps {
  items: IntelItem[];
  compact: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/** Day-grouped timeline: wide cards with a time rail, or compact rows when an item is open on the right */
export default function IntelTimeline({ items, compact, selectedId, onSelect }: TimelineProps) {
  const now = useMinute();
  const groups = groupByDay(items, now);
  const firstPaint = useRef(true);
  useEffect(() => {
    firstPaint.current = false;
  }, []);

  return (
    <AnimatePresence mode="wait" initial={false} custom={compact}>
      <motion.div key={compact ? 'compact' : 'wide'} custom={compact} variants={list} initial={firstPaint.current ? false : 'hidden'} animate="shown" exit="gone" className={compact ? 'px-4 pb-8' : 'pr-[200px] pb-8 pl-[150px]'}>
        {groups.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nog niets gepubliceerd</p>}
        {groups.map((group) => (
          <section key={group.key}>
            <motion.h3 custom={compact} variants={entry} className={cn('sticky top-0 z-10 bg-gradient-to-b from-beheer-window from-70% to-transparent pt-3.5 pb-2 text-[11.5px] font-extrabold tracking-[0.06em] text-muted-foreground uppercase', compact ? 'pl-1.5' : 'pl-[66px]')}>
              {group.label}
            </motion.h3>
            {group.items.map((item) =>
              compact ? (
                <motion.div key={item.id} custom={compact} variants={entry} className="my-1">
                  <CompactRow item={item} now={now} selected={item.id === selectedId} onSelect={onSelect} />
                </motion.div>
              ) : (
                <motion.div key={item.id} custom={compact} variants={entry} className="grid grid-cols-[52px_14px_1fr] gap-x-2.5">
                  <div className="pt-[15px] text-right text-xs text-muted-foreground tabular-nums">{formatClock(item.publishAt)}</div>
                  <div className="relative before:absolute before:inset-y-0 before:left-1.5 before:w-0.5 before:bg-beheer-row-high">
                    <span className="absolute top-[18px] left-0.5 size-2.5 rounded-full ring-2 ring-beheer-window" style={{ backgroundColor: KIND_COLOR[item.kind] }} />
                  </div>
                  <WideCard item={item} now={now} onSelect={onSelect} />
                </motion.div>
              ),
            )}
          </section>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}

function UnreadDot({ unread }: { unread: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {unread && <motion.span key="dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0, opacity: 0 }} className="size-[7px] shrink-0 rounded-full bg-primary" aria-label="ongelezen" />}
    </AnimatePresence>
  );
}

function WideCard({ item, now, onSelect }: { item: IntelItem; now: number; onSelect: (id: number) => void }) {
  const states = item.kind === 'hint' ? areaStates(item.cells) : null;
  const count = item.kind === 'hint' ? solvedCount(item.cells) : null;
  const status = item.assignment?.status ?? 'open';
  return (
    <button type="button" onClick={() => onSelect(item.id)} className="my-[5px] w-full rounded-[20px] bg-card px-[15px] py-[13px] text-left outline-none transition-colors hover:bg-beheer-row focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <span className="flex items-center gap-2">
        <UnreadDot unread={item.unread} />
        <span className="text-[14.5px] font-bold">{item.title}</span>
        <KindTag kind={item.kind} />
        <span className="ml-auto text-xs text-muted-foreground">
          {count && `${count.solved}/${count.total} opgelost`}
        </span>
        {item.kind === 'assignment' && item.endTime && (
          <Tag tone="warn" className="ml-auto gap-1">
            <ClockIcon className="size-3" />
            {deadlineLabel(item.endTime, now)}
          </Tag>
        )}
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

function CompactRow({ item, now, selected, onSelect }: { item: IntelItem; now: number; selected: boolean; onSelect: (id: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // After the open choreography the selected row is scrolled into view
    if (selected) setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 450);
  }, [selected]);
  const status = item.assignment?.status ?? 'open';
  return (
    <button
      ref={ref}
      type="button"
      aria-current={selected || undefined}
      onClick={() => onSelect(item.id)}
      className={cn('flex w-full gap-2.5 rounded-[14px] bg-card px-3 py-2.5 text-left outline-none transition-[background-color,box-shadow] duration-200 hover:bg-beheer-row focus-visible:ring-[3px] focus-visible:ring-ring/50', selected && 'shadow-[0_0_0_2px_var(--primary)]')}
    >
      <span className="w-1 shrink-0 self-stretch rounded" style={{ backgroundColor: KIND_COLOR[item.kind] }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <UnreadDot unread={item.unread} />
          <span className="truncate text-[13.5px] font-bold">{item.title}</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatClock(item.publishAt)}</span>
        </span>
        <span className="mt-1 flex min-w-0">
          {item.kind === 'hint' ? (
            <AreaStrip cells={item.cells} />
          ) : item.kind === 'assignment' ? (
            <span className="text-xs text-muted-foreground">
              {item.endTime ? `${deadlineLabel(item.endTime, now)} · ` : ''}
              {ASSIGNMENT_STATUS_LABELS[status]}
            </span>
          ) : (
            <span className="truncate text-xs text-muted-foreground">{item.summary ?? ''}</span>
          )}
        </span>
      </span>
    </button>
  );
}

export function KindTag({ kind }: { kind: IntelKind }) {
  return (
    <span className="rounded-lg px-2 py-0.5 text-[11px] font-bold" style={{ color: KIND_COLOR[kind], backgroundColor: `color-mix(in oklab, ${KIND_COLOR[kind]} 14%, transparent)` }}>
      {KIND_LABEL[kind]}
    </span>
  );
}
```

  Check `Tag`'s `tone` variants in `src/components/beheer/controls/Pill.tsx` and use an amber/warn tone that exists there (if none, use the same inline style approach as `KindTag` with `#f59e0b`). The "n/m opgelost" span and the deadline tag must not both take `ml-auto` for the same kind (they don't: one is hint-only, the other assignment-only).

- [ ] **Step 3: Split layout in `IntelDialog`** — replace the placeholder `<ul>` in `IntelWindow` with:

```tsx
  const articleId = useIntelStore((state) => state.articleId);
  const select = useIntelStore((state) => state.select);
  // A selected article that disappeared (e.g. filtered by the tab) closes the split
  const selected = items.find((item) => item.id === articleId) ?? null;
  const split = selected !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IntelTopBar unread={unreadCount(items) > 0} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <motion.div
          className="min-h-0 shrink-0 overflow-y-auto [scrollbar-gutter:stable]"
          initial={false}
          animate={{ width: split ? '33.333%' : '100%' }}
          transition={{ duration: 0.42, ease: EASE_OUT, delay: split ? 0.1 : 0.14 }}
        >
          <IntelTimeline items={shown} compact={split} selectedId={articleId} onSelect={(id) => select(id === articleId ? null : id)} />
        </motion.div>
        <AnimatePresence>
          {split && (
            <motion.div
              key="separator"
              className="my-1 mb-[18px] w-px shrink-0 origin-top bg-border"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1, transition: { duration: 0.5, delay: 0.12, ease: EASE_OUT } }}
              exit={{ opacity: 0, transition: { duration: 0.16 } }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {selected && (
            <motion.div
              key="detail"
              className="min-h-0 shrink-0 basis-[calc(66.667%-1px)] overflow-y-auto px-9 pt-1.5 pb-8"
              exit={{ opacity: 0, x: 24, transition: { duration: 0.16, ease: 'easeIn' } }}
            >
              <div className="relative mx-auto max-w-[720px]">
                {/* Task 5: <IntelDetail item={selected} mapRef={mapRef} /> */}
                <h2 className="text-[21px] font-bold">{selected.title}</h2>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
```

  Imports: `AnimatePresence, motion` from `motion/react`, `EASE_OUT` from `@/lib/motion`, `IntelTimeline`. Rename `_mapRef` back to `mapRef` once Task 5 uses it.
  When the tab changes while split and the selected item is not in the tab, call `select(null)` in an effect (`useEffect(() => { if (articleId !== null && !shown.some((item) => item.id === articleId)) select(null); }, [articleId, shown, select])`). `selected` must be looked up in `shown`, not `items`.
  Mark news/opdrachten read when selected: `useEffect(() => { if (selected && selected.kind !== 'hint' && selected.unread) void markRead(selected.id); }, [selected, markRead]);` (take `markRead` from `useReadState()`).

- [ ] **Step 4: Verify** — `npm run build && npm run lint`, then a quick browser look (see Task 7's recipe) at open/close/swap; adjust only timings, not structure.
- [ ] **Step 5: Commit** `feat(intel): day-grouped timeline with compact split view and transitions` + co-author line.

---

### Task 5: Detail pane: header, summary, news and opdracht

**Files:**
- Create: `src/components/intel-window/IntelDetail.tsx`, `SummaryCard.tsx`, `ArticleHtml.tsx`, `NewsPane.tsx`, `AssignmentPane.tsx`
- Modify: `src/components/intel-window/IntelDialog.tsx` (render `IntelDetail`)

**Interfaces:**
- `IntelDetail({ item, mapRef }: { item: IntelItem; mapRef: RefObject<MapRef | null> })` — keyed by `item.id` inside its own `AnimatePresence mode="wait"` so a swap fades the old parts out (0.11 s) and staggers the new parts in.
- `SummaryCard({ summary }: { summary?: string })` renders nothing without a summary.
- `ArticleHtml({ html }: { html: string })`.
- `NewsPane({ item })`, `AssignmentPane({ item })`; Task 6 adds `HintPane({ item, area, mapRef })`.

- [ ] **Step 1: SummaryCard**

```tsx
import { BeheerCard } from '@/components/beheer/BeheerLayout';

/** The AI summary (S1): plain card, no icon, a muted note that it was made automatically */
export default function SummaryCard({ summary }: { summary?: string }) {
  if (!summary) return null;
  return (
    <BeheerCard title="Samenvatting" right={<span className="text-xs text-muted-foreground">automatisch · kan fouten bevatten</span>}>
      <p className="px-1 text-sm leading-relaxed">{summary}</p>
    </BeheerCard>
  );
}
```

- [ ] **Step 2: ArticleHtml**

```tsx
import { memo, useMemo, useState } from 'react';
import ImageLightbox from '@/components/ImageLightbox';
import { sanitizeHintHtml } from '@/lib/hints';

/** Sanitised article HTML; an image opens in the zoomable lightbox */
function ArticleHtml({ html }: { html: string }) {
  const sanitized = useMemo(() => sanitizeHintHtml(html), [html]);
  const [zoom, setZoom] = useState<string | null>(null);
  return (
    <>
      <div
        className="px-1 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_img]:my-2 [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-xl [&_p]:my-2"
        onClick={(event) => {
          if (event.target instanceof HTMLImageElement) {
            event.preventDefault();
            setZoom(event.target.src);
          }
        }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      <ImageLightbox src={zoom ?? ''} alt="" open={zoom !== null} onOpenChange={(open) => !open && setZoom(null)} />
    </>
  );
}

export default memo(ArticleHtml);
```

- [ ] **Step 3: NewsPane**

```tsx
import { AnimatePresence, motion } from 'motion/react';
import { BeheerCard } from '@/components/beheer/BeheerLayout';
import { POP } from '@/lib/motion';
import type { IntelItem } from '@/types/Intel';
import ArticleHtml from './ArticleHtml';

export default function NewsPane({ item }: { item: IntelItem }) {
  return (
    <>
      <BeheerCard title="Volledige tekst">
        <ArticleHtml html={item.content} />
      </BeheerCard>
      <BeheerCard title="Gelezen door" count={item.readBy.length}>
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {item.readBy.map((name) => (
              <motion.span key={name} layout {...POP} className="rounded-lg bg-beheer-row px-2.5 py-1 text-xs">
                {name}
              </motion.span>
            ))}
          </AnimatePresence>
          {item.readBy.length === 0 && <span className="text-xs text-muted-foreground">Nog niemand</span>}
        </div>
      </BeheerCard>
    </>
  );
}
```

- [ ] **Step 4: AssignmentPane**

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { BeheerCard, BeheerRow, BeheerRows } from '@/components/beheer/BeheerLayout';
import { Pill } from '@/components/beheer/controls/Pill';
import Segmented from '@/components/beheer/controls/Segmented';
import { Input } from '@/components/ui/input';
import { useAssignments } from '@/hooks/assignments.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS } from '@/lib/intel-window';
import type { AssignmentStatus, IntelItem } from '@/types/Intel';
import ArticleHtml from './ArticleHtml';
import NewsPane from './NewsPane';

const STATUS_OPTIONS = (Object.keys(ASSIGNMENT_STATUS_LABELS) as AssignmentStatus[]).map((value) => ({ value, label: ASSIGNMENT_STATUS_LABELS[value] }));

export default function AssignmentPane({ item }: { item: IntelItem }) {
  const { members, setStatus, setOwner, addNote } = useAssignments();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const status = item.assignment?.status ?? 'open';
  const notes = item.assignment?.notes ?? [];

  const run = (write: () => Promise<unknown>, failure: string) => write().catch((error) => toast.error(apiErrorMessage(error, failure)));

  async function submitNote() {
    const text = note.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await addNote(item.id, text);
      setNote('');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Notitie opslaan mislukt'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <BeheerCard>
        <BeheerRows>
          <BeheerRow key="status" title="Status">
            <Segmented label="Status" value={status} options={STATUS_OPTIONS} onChange={(next) => run(() => setStatus(item.id, next), 'Status opslaan mislukt')} />
          </BeheerRow>
          <BeheerRow key="owner" title="Eigenaar">
            <select
              aria-label="Eigenaar"
              className="h-8 rounded-lg bg-beheer-row-high px-2.5 text-[12.5px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={item.assignment?.owner?._id ?? ''}
              onChange={(event) => run(() => setOwner(item.id, event.target.value || null), 'Eigenaar opslaan mislukt')}
            >
              <option value="">Niemand</option>
              {members.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
          </BeheerRow>
        </BeheerRows>
      </BeheerCard>
      <BeheerCard title="Notities" count={notes.length}>
        <BeheerRows>
          {notes.map((entry) => (
            <BeheerRow key={entry._id} title={entry.user?.name ?? 'Onbekend'} meta={formatClock(entry.createdAt)}>
              <span className="max-w-[60%] text-[13px] whitespace-pre-line">{entry.text}</span>
            </BeheerRow>
          ))}
          <BeheerRow key="new" title={<Input value={note} onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void submitNote()} placeholder="Notitie toevoegen…" maxLength={1000} className="h-8" />}>
            <Pill variant="primary" disabled={!note.trim() || saving} onClick={() => void submitNote()}>
              Toevoegen
            </Pill>
          </BeheerRow>
        </BeheerRows>
      </BeheerCard>
      <BeheerCard title="Volledige tekst">
        <ArticleHtml html={item.content} />
      </BeheerCard>
    </>
  );
}
```

  Remove the unused `NewsPane` import if you don't use it; "Gelezen door" is only on news (spec O). Check that `@/components/ui/input` exists (`ls src/components/ui`); otherwise use a plain `<input>` with the `inp` look (`h-8 rounded-[10px] bg-beheer-window px-2.5 text-[13px] outline-none ring-1 ring-border focus:ring-primary`). If the owner `<select>` looks out of place next to Beheer controls, use the shadcn `Select` the Beheer hunters pane uses for its pickers (grep `components/beheer` for `Select`) — keep the behaviour.

- [ ] **Step 5: IntelDetail**

```tsx
import { RefObject } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { ClockIcon } from 'lucide-react';
import { MapRef } from '@/components/Map';
import { formatClock } from '@/lib/format';
import { deadlineLabel, solvedCount } from '@/lib/intel-window';
import { EASE_OUT } from '@/lib/motion';
import type { IntelItem } from '@/types/Intel';
import AssignmentPane from './AssignmentPane';
import { KindTag } from './IntelTimeline';
import NewsPane from './NewsPane';
import SummaryCard from './SummaryCard';

const parts: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.055, delayChildren: 0.15 } },
  gone: { opacity: 0, transition: { duration: 0.11 } },
};
const part: Variants = {
  hidden: { opacity: 0, x: 28 },
  shown: { opacity: 1, x: 0, transition: { duration: 0.38, ease: EASE_OUT } },
};

/** The item on the right: title, meta line, summary and the pane for its kind; parts stagger in, a new item swaps */
export default function IntelDetail({ item, area, mapRef }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null> }) {
  const count = item.kind === 'hint' ? solvedCount(item.cells) : null;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={item.id} variants={parts} initial="hidden" animate="shown" exit="gone" className="flex flex-col gap-3">
        <motion.div variants={part}>
          <h2 className="pr-10 text-[21px] leading-tight font-bold">{item.title}</h2>
          <div className="mt-1.5 mb-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <KindTag kind={item.kind} />
            {formatClock(item.publishAt)}
            {count && <span>· {count.solved}/{count.total} opgelost</span>}
            {item.kind === 'assignment' && item.endTime && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                <ClockIcon className="size-3" />
                {deadlineLabel(item.endTime, Date.now())}
              </span>
            )}
            {item.maxPoints ? <span>max {item.maxPoints} pt</span> : null}
          </div>
        </motion.div>
        {item.summary && (
          <motion.div variants={part}>
            <SummaryCard summary={item.summary} />
          </motion.div>
        )}
        <PaneParts item={item} area={area} mapRef={mapRef} />
      </motion.div>
    </AnimatePresence>
  );
}

/** Each card of the pane is one staggered part */
function PaneParts({ item }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null> }) {
  const pane = item.kind === 'assignment' ? <AssignmentPane item={item} /> : item.kind === 'news' ? <NewsPane item={item} /> : null; // Task 6: hint
  return <motion.div variants={part} className="flex flex-col gap-3">{pane}</motion.div>;
}
```

  (Fine to keep the pane as one staggered part; a per-card stagger is a nice-to-have.)
  In `IntelDialog`, replace the placeholder `<h2>` with `<IntelDetail item={selected} area={useIntelStore area} mapRef={mapRef} />` (read `area` from the store with a selector), and add the close button on the right column (top-right, `IconPill aria-label="Sluiten (Esc)"` with `XIcon`, `absolute -right-2 -top-1`, `onClick={() => select(null)}`).

- [ ] **Step 6: Verify** — `npm run build && npm run lint`.
- [ ] **Step 7: Commit** `feat(intel): item pane with summary, news read-by and opdracht bookkeeping` + co-author line.

---

### Task 6: Hint pane (H2)

**Files:**
- Create: `src/components/intel-window/HintPane.tsx`
- Modify: `src/components/intel-window/IntelDetail.tsx` (render it for hints)

**Interfaces:**
- `HintPane({ item, area, mapRef }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null> })`.
- Consumes: `useHintBoard().actions.solve(articleId, area, answer, replaceMarker)`, `useRdPreview(answer)`, `nextOpenArea`, `hasExistingMarker`, `ConfirmDialog` (`{ open, onOpenChange, title, description, confirmLabel, destructive?, onConfirm }` — check its prop names in `src/components/ConfirmDialog.tsx`), `useIntelStore.close`, `SuccessBadge`, `CookieBadge`, `RowFrame` and `Chevron` from `BeheerLayout`, `Reveal`.

Behaviour (match `intel-hints-v6.html` option H2):
- Card "Deelgebieden": one row per area (fixed area order). A `none` / missing area is a dimmed, non-interactive row "geen hint".
- Exactly one row open, controlled here (not `BeheerRows`' own state): initially `area` from the store if it is a cell of this hint, else `nextOpenArea(cells)`, else null.
- Row header: colour dot, name, then right: solved → answer (mono, green) + cookie; open → "open" muted; chevron.
- Open row body (indented under the name): the area's snippet (mono, wraps, `whitespace-pre-wrap break-words`), then:
  - solved and not editing: answer + cookie + `IconPill` map (closes the window, then after 260 ms `mapRef.current?.flyTo({ center: answerLocation, duration: 2000, zoom: 15 })`; hidden for text answers) + `IconPill` pencil (edit);
  - open or editing: `Input` (placeholder `1234 5678`, autofocus, prefilled with the answer when editing) + `Pill variant="primary"` "Opslaan" (spinner while saving); Enter saves, Escape (while editing a solved answer) cancels the edit and stops propagation so the window stays open;
  - preview line under the field (Reveal): RD parsed → `✓ RD {x} {y} · {lat.toFixed(4)} N, {lng.toFixed(4)} E` (muted, check green); RD outside X 130000–260000 / Y 400000–520000 → amber `⚠ ligt buiten het speelgebied: cijfers omgedraaid?`; typed text that isn't RD → `Tekst-antwoord, geen marker` (muted).
- Save: `solve(...)`; on 409 `hasExistingMarker` → `ConfirmDialog` "Bestaande marker vervangen?" / "Er staat al een hint-marker voor {Area} op dit uur. Die wordt verplaatst naar dit antwoord." / "Vervangen" → resend with `replaceMarker: true`; other errors → `toast.error(apiErrorMessage(error, 'Antwoord opslaan mislukt'))`. On success: the row's status swaps to answer + `SuccessBadge` (pop + draw), the row folds, and `nextOpenArea(cells-after-save, savedArea)` unfolds (or none).
- Card "Volledige hint": `ArticleHtml` of `item.content`.

- [ ] **Step 1: Implementation** — `src/components/intel-window/HintPane.tsx`:

```tsx
import { RefObject, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, MapIcon, PencilIcon } from 'lucide-react';
import { toast } from 'sonner';
import SuccessBadge from '@/components/auth/SuccessBadge';
import { BeheerCard, Chevron, RowFrame } from '@/components/beheer/BeheerLayout';
import { IconPill, Pill } from '@/components/beheer/controls/Pill';
import ConfirmDialog from '@/components/ConfirmDialog';
import { MapRef } from '@/components/Map';
import Reveal from '@/components/motion/Reveal';
import CookieBadge from '@/components/tracker/CookieBadge';
import { Input } from '@/components/ui/input';
import { useHintBoard, useRdPreview } from '@/hooks/hints.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { hasExistingMarker, nextOpenArea } from '@/lib/intel-window';
import { SWAP } from '@/lib/motion';
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem } from '@/types/Intel';
import ArticleHtml from './ArticleHtml';

const DIALOG_CLOSE_MS = 260;

export default function HintPane({ item, area, mapRef }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null> }) {
  const cells = new Map(item.cells.map((cell) => [cell.area, cell]));
  const initial = area && cells.get(area) && cells.get(area)!.status !== 'none' ? area : nextOpenArea(item.cells);
  const [openArea, setOpenArea] = useState<string | null>(initial);
  // Areas solved while this pane is open: their cookie pops in instead of just being there
  const [justSolved, setJustSolved] = useState<Set<string>>(new Set());

  function solved(savedArea: string, after: HintCell[]) {
    setJustSolved((current) => new Set(current).add(savedArea));
    setOpenArea(nextOpenArea(after, savedArea));
  }

  return (
    <>
      <BeheerCard title="Deelgebieden">
        <div className="flex flex-col gap-0.5">
          {areaOptions.map(({ value, label }) => {
            const cell = cells.get(value);
            return (
              <AreaRow
                key={value}
                item={item}
                cell={cell}
                area={value}
                label={label}
                open={openArea === value}
                pop={justSolved.has(value)}
                onToggle={() => setOpenArea(openArea === value ? null : value)}
                onSolved={(after) => solved(value, after)}
                mapRef={mapRef}
              />
            );
          })}
        </div>
      </BeheerCard>
      <BeheerCard title="Volledige hint">
        <ArticleHtml html={item.content} />
      </BeheerCard>
    </>
  );
}

interface AreaRowProps {
  item: IntelItem;
  cell: HintCell | undefined;
  area: string;
  label: string;
  open: boolean;
  pop: boolean;
  onToggle: () => void;
  onSolved: (cellsAfter: HintCell[]) => void;
  mapRef: RefObject<MapRef | null>;
}

function AreaRow({ item, cell, area, label, open, pop, onToggle, onSolved, mapRef }: AreaRowProps) {
  const dot = <span className="size-[9px] shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area) }} aria-hidden />;
  if (!cell || cell.status === 'none') {
    return (
      <RowFrame tone="muted">
        <div className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
          {dot}
          <span className="w-16 font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground">geen hint</span>
        </div>
      </RowFrame>
    );
  }
  const solved = cell.status === 'solved' && !!cell.answer;
  return (
    <RowFrame tone={open ? 'open' : 'default'}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset">
        {dot}
        <span className="w-16 text-[13px] font-semibold">{label}</span>
        <span className="flex-1" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={solved ? `ok-${cell.answer}` : 'open'} {...SWAP} className="flex items-center gap-2">
            {solved ? (
              <>
                <span className="font-mono text-[12.5px] font-bold text-green-600 dark:text-green-300">{cell.answer}</span>
                {pop ? <SuccessBadge size={18} /> : <CookieBadge tone="ok" size={18} />}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">open</span>
            )}
          </motion.span>
        </AnimatePresence>
        <Chevron open={open} />
      </button>
      <Reveal>{open && <AreaBody item={item} cell={cell} label={label} onSolved={onSolved} mapRef={mapRef} />}</Reveal>
    </RowFrame>
  );
}

function AreaBody({ item, cell, label, onSolved, mapRef }: { item: IntelItem; cell: HintCell; label: string; onSolved: (after: HintCell[]) => void; mapRef: RefObject<MapRef | null> }) {
  const { solve } = useHintBoard();
  const close = useIntelStore((state) => state.close);
  const solved = cell.status === 'solved' && !!cell.answer;
  const [editing, setEditing] = useState(!solved);
  const [answer, setAnswer] = useState(cell.answer ?? '');
  const [saving, setSaving] = useState(false);
  const [askReplace, setAskReplace] = useState(false);
  const preview = useRdPreview(editing ? answer : '');

  async function save(replaceMarker = false) {
    const value = answer.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      const saved = await solve(item.id, cell.area, value, replaceMarker);
      setEditing(false);
      onSolved(item.cells.map((existing) => (existing._id === saved._id ? saved : existing)));
    } catch (error) {
      if (hasExistingMarker(error)) setAskReplace(true);
      else toast.error(apiErrorMessage(error, 'Antwoord opslaan mislukt'));
    } finally {
      setSaving(false);
    }
  }

  function showOnMap() {
    const location = cell.answerLocation;
    if (!location) return;
    close();
    setTimeout(() => mapRef.current?.flyTo({ center: location, duration: 2000, zoom: 15 }), DIALOG_CLOSE_MS);
  }

  const outside = preview && (preview.x < 130000 || preview.x > 260000 || preview.y < 400000 || preview.y > 520000);
  const previewLine = !editing || !answer.trim() ? null : preview ? (
    outside ? (
      <span className="text-amber-600 dark:text-amber-300">⚠ RD {preview.x} {preview.y} ligt buiten het speelgebied: cijfers omgedraaid?</span>
    ) : (
      <span className="text-muted-foreground">
        <span className="text-green-600 dark:text-green-300">✓</span> RD {preview.x} {preview.y} · {preview.lat.toFixed(4)} N, {preview.lng.toFixed(4)} E
      </span>
    )
  ) : (
    <span className="text-muted-foreground">Tekst-antwoord, geen marker</span>
  );

  return (
    <div className="pt-0.5 pr-3.5 pb-3.5 pl-8">
      {cell.snippet && <p className="mb-3 font-mono text-[13.5px] leading-[1.7] break-words whitespace-pre-wrap">{cell.snippet}</p>}
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div key="edit" {...SWAP} className="flex items-center gap-2">
            <Input
              autoFocus
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void save();
                if (event.key === 'Escape' && solved) {
                  event.stopPropagation();
                  setAnswer(cell.answer ?? '');
                  setEditing(false);
                }
              }}
              placeholder="1234 5678"
              maxLength={200}
              aria-label={`Antwoord ${label}`}
              className="h-8 w-44 font-mono"
            />
            <Pill variant="primary" disabled={!answer.trim() || saving} onClick={() => void save()} morphKey={saving ? 'saving' : 'idle'}>
              {saving ? <Loader2Icon className="animate-spin" /> : 'Opslaan'}
            </Pill>
          </motion.div>
        ) : (
          <motion.div key="done" {...SWAP} className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-bold text-green-600 dark:text-green-300">{cell.answer}</span>
            {cell.answerKind === 'rd' && cell.answerLocation && (
              <IconPill aria-label="Op kaart" onClick={showOnMap}>
                <MapIcon />
              </IconPill>
            )}
            <IconPill aria-label="Wijzigen" onClick={() => setEditing(true)}>
              <PencilIcon />
            </IconPill>
          </motion.div>
        )}
      </AnimatePresence>
      <Reveal>{previewLine && <p className="mt-2 text-xs">{previewLine}</p>}</Reveal>
      <ConfirmDialog
        open={askReplace}
        onOpenChange={setAskReplace}
        title="Bestaande marker vervangen?"
        description={`Er staat al een hint-marker voor ${label} op dit uur. Die wordt verplaatst naar dit antwoord.`}
        confirmLabel="Vervangen"
        onConfirm={() => save(true)}
      />
    </div>
  );
}
```

  Check `ConfirmDialog`'s exact props (`src/components/ConfirmDialog.tsx`) and adapt names. Check `IconPill` renders children icons at the right size. `SuccessBadge` pops on mount — it is only mounted for areas solved while the pane is open (`pop`).

- [ ] **Step 2: Wire it** — in `IntelDetail.tsx` `PaneParts`: `item.kind === 'hint' ? <HintPane item={item} area={area} mapRef={mapRef} /> : …` (pass `area` and `mapRef` through). Area chips in the timeline update from the same board cache (the solve puts the returned cell into the SWR cache), so the cookie appears there too.
- [ ] **Step 3: Verify** — `npm run build && npm run lint && npx --yes bun test`.
- [ ] **Step 4: Commit** `feat(intel): solve hints per area with live RD preview` + co-author line.

---

### Task 7: Browser check end-to-end

Recipe (from the old intel work; adapt paths):
1. Server on branch `feat/intel-window` (server plan done): copy `.stress/intel/seed.ts` from the repo root (`/home/silke/Documents/Jotihunt 2026/.stress/intel/seed.ts`) into the server checkout's `.superpowers/sdd/` and run it with a throwaway DB (e.g. `jotihunt-intel-window`) — read the file first, it seeded hints/assignments/news for the old page; drop anything it does with claims/checks/notes/presence.
2. `/home/silke/Documents/Jotihunt 2026/.stress/start-server.sh 3105 jotihunt-intel-window` (set `JOTIHUNT_API_URL=http://127.0.0.1:9` so crons don't overwrite seeded data).
3. Client: `API_BASE_URL=http://localhost:3105 npx --yes bun x vite --port 5180` (restart with `--force` after edits if HMR serves stale modules).
4. Never touch the docker stack (server :3000, client :8080); kill your processes by PID.

- [ ] **Step 1:** Log in, open the mini grid "Open hints": wide timeline grouped per day, chips (cookie / open / dimmed without dash), unread dot on Nieuws tab.
- [ ] **Step 2:** Click a hint: T1 choreography (fade → shrink → rows stagger → separator draws → right parts stagger). Click another item: only the right side swaps. Esc: back to wide (window stays open); Esc again: window closes.
- [ ] **Step 3:** Solve an area: preview lines (try `1873 4512`, `4512 1873`, `haggis`), Enter, cookie pops in the row and in the compact strip / wide chips, next open area unfolds. Edit with the pencil, Escape cancels the edit (window stays). Map button closes the window and flies to the marker. Force the marker 409 (solve the same area/hour of another hint article via a second cell, or place a hint marker by hand with the sidebar "Hint registreren" card) and confirm "Vervangen".
- [ ] **Step 4:** Opdracht: status segmented, owner picker, add a note. News: opening clears the unread dot and adds you to "Gelezen door".
- [ ] **Step 5:** Mini grid cell on desktop opens the window on that hint with that area unfolded. A new article notification (insert one in the throwaway DB or trigger the notifier) shows "Openen" and opens it. At phone width the window closes and the mini grid behaves as before.
- [ ] **Step 6:** Light theme quick look (`preview_set_appearance` or the app's theme toggle).
- [ ] **Step 7:** Fix what you found (one commit per fix), then `npm run build && npm run lint && npx --yes bun test`.

Merging and deploying happen after review, together with the server branch.
