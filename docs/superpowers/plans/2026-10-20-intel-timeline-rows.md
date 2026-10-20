# Intel Timeline Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the busy Intel timeline cards (rail, pills, area chips) with calm per-day grouped rows: kind icon tile with unread/done badges, title, one grey meta line.

**Architecture:** Two pure helpers in `src/lib/intel-window.ts` (`isHintDone`, `assignmentMeta`) feed the new row rendering in `IntelTimeline.tsx`. The list's motion infrastructure (`TimelineList`, `Fold`, variants) stays; only the day body and the row change. `AreaChips.tsx` is deleted.

**Tech Stack:** React 19, TypeScript, Tailwind v4, motion/react, lucide-react, bun test.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-20-intel-timeline-rows-design.md`.
- Every UI state change animates (enter/exit/swap); reduced motion as today.
- Only existing tokens (`card`, `beheer-window`, `beheer-row`, `muted-foreground`, `foreground`) + `KIND_COLOR` + area colours.
- `KindTag`, `DeadlineTag`, `AssignmentStatusTag` stay exported from `IntelTimeline.tsx` (used by `IntelDetail.tsx`).
- Copy is Dutch: "opgelost", "Beoordeeld", "niemand", "ongelezen".
- Commands via `npx bun` (bun is not on PATH).

---

### Task 1: Row helpers

**Files:**
- Modify: `src/lib/intel-window.ts` (after `deadlineTone`, ~line 135)
- Test: `src/lib/intel-window.test.ts`

**Interfaces:**
- Produces:
  - `isHintDone(cells: HintCell[]): boolean`
  - `type MetaTone = 'muted' | 'ok' | 'info' | 'warn' | 'danger'`
  - `interface MetaSegment { text: string; tone: MetaTone }`
  - `assignmentMeta(item: IntelItem, now: number): MetaSegment[]`

- [ ] **Step 1: Write the failing tests** — add `isHintDone, assignmentMeta` to the import from `./intel-window` and append:

```ts
describe('isHintDone', () => {
  test('all areas with a hint solved', () => {
    expect(isHintDone([cell('alpha', 'solved'), cell('bravo', 'solved'), cell('oscar', 'none')])).toBe(true);
  });
  test('an open area or no hint at all is not done', () => {
    expect(isHintDone([cell('alpha', 'solved'), cell('bravo', 'open')])).toBe(false);
    expect(isHintDone([cell('oscar', 'none')])).toBe(false);
    expect(isHintDone([])).toBe(false);
  });
});

describe('assignmentMeta', () => {
  const now = Date.parse('2026-10-18T11:18:00Z');
  const item = (extra: Partial<IntelItem> = {}): IntelItem => ({
    id: 1, kind: 'assignment', title: 'T', publishAt: '2026-10-18T10:00:00Z', content: '', cells: [], unread: false, readBy: [],
    endTime: '2026-10-18T12:00:00Z', maxPoints: 9, ...extra,
  });
  const site = (extra: Record<string, unknown>) => ({ submitted: true, judged: true, ...extra }) as unknown as Assignment['site'];

  test('open and unowned: deadline coloured by urgency, then niemand', () => {
    expect(assignmentMeta(item(), now)).toEqual([{ text: 'nog 42 min', tone: 'warn' }, { text: 'niemand', tone: 'muted' }]);
  });
  test('our status (not open) and the owner follow the deadline', () => {
    const assignment: Assignment = { _id: 'a', articleId: 1, status: 'busy', owner: { _id: 'u', name: 'Jesse' } as Assignment['owner'], notes: [] };
    expect(assignmentMeta(item({ assignment, endTime: '2026-10-18T14:00:00Z' }), now)).toEqual([
      { text: 'nog 2 u 42', tone: 'info' }, { text: 'Bezig', tone: 'muted' }, { text: 'Jesse', tone: 'muted' },
    ]);
  });
  test('expired is red, submitted is muted', () => {
    expect(assignmentMeta(item({ endTime: '2026-10-18T11:00:00Z' }), now)[0]).toEqual({ text: 'verlopen', tone: 'danger' });
    const assignment: Assignment = { _id: 'a', articleId: 1, status: 'submitted', notes: [] };
    expect(assignmentMeta(item({ assignment }), now).slice(0, 2)).toEqual([{ text: 'nog 42 min', tone: 'muted' }, { text: 'Ingeleverd', tone: 'muted' }]);
  });
  test('judged: points out of max in green, no deadline', () => {
    const assignment: Assignment = { _id: 'a', articleId: 1, status: 'submitted', notes: [], site: site({ points: 9 }) };
    expect(assignmentMeta(item({ assignment }), now)).toEqual([{ text: 'Beoordeeld · 9/9 pt', tone: 'ok' }, { text: 'niemand', tone: 'muted' }]);
    expect(assignmentMeta(item({ assignment, maxPoints: 0 }), now)[0].text).toBe('Beoordeeld · 9 pt');
    const noPoints: Assignment = { ...assignment, site: site({ points: null }) };
    expect(assignmentMeta(item({ assignment: noPoints }), now)[0].text).toBe('Beoordeeld');
  });
  test('no deadline: only status and owner', () => {
    expect(assignmentMeta(item({ endTime: undefined }), now)).toEqual([{ text: 'niemand', tone: 'muted' }]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx bun test src/lib/intel-window.test.ts` → `isHintDone` / `assignmentMeta` not exported.

- [ ] **Step 3: Implement** — in `src/lib/intel-window.ts` after `deadlineTone`:

```ts
/** Every area that has a hint is solved (and there is at least one) */
export function isHintDone(cells: HintCell[]): boolean {
  const { solved, total } = solvedCount(cells);
  return total > 0 && solved === total;
}

/** How a part of a timeline row's grey line is coloured */
export type MetaTone = 'muted' | 'ok' | 'info' | 'warn' | 'danger';
export interface MetaSegment {
  text: string;
  tone: MetaTone;
}

const DEADLINE_META_TONE: Record<DeadlineTone, MetaTone> = { done: 'muted', expired: 'danger', urgent: 'warn', calm: 'info' };

/**
 * An assignment row's grey line after its time: "Beoordeeld · 9/9 pt" (green) once judged, else the deadline (coloured
 * by urgency) and our status when not open; the owner (or "niemand") last.
 */
export function assignmentMeta(item: IntelItem, now: number): MetaSegment[] {
  const assignment = item.assignment;
  const owner: MetaSegment = { text: assignment?.owner?.name ?? 'niemand', tone: 'muted' };
  const site = siteSubmission(assignment);
  if (site?.judged) {
    const points = site.points === null ? '' : item.maxPoints ? ` · ${site.points}/${item.maxPoints} pt` : ` · ${site.points} pt`;
    return [{ text: `Beoordeeld${points}`, tone: 'ok' }, owner];
  }
  const status = assignment?.status ?? 'open';
  const segments: MetaSegment[] = [];
  if (item.endTime) segments.push({ text: deadlineLabel(item.endTime, now), tone: DEADLINE_META_TONE[deadlineTone(item.endTime, now, status)] });
  if (status !== 'open') segments.push({ text: ASSIGNMENT_STATUS_LABELS[status], tone: 'muted' });
  return [...segments, owner];
}
```

- [ ] **Step 4: Run, expect PASS** — `npx bun test src/lib/intel-window.test.ts`.

- [ ] **Step 5: Commit** — `git add src/lib/intel-window.ts src/lib/intel-window.test.ts && git commit -m "feat(intel): row meta helpers for the timeline"`

---

### Task 2: Grouped rows in the timeline

**Files:**
- Modify: `src/components/intel-window/IntelTimeline.tsx`
- Delete: `src/components/intel-window/AreaChips.tsx`
- Modify: `src/components/intel-window/HintPane.tsx:170` (comment mentions `AreaChip`)

**Interfaces:**
- Consumes: `isHintDone`, `assignmentMeta`, `MetaTone`, `MetaSegment` (Task 1); `areaStates`, `solvedCount`, `siteSubmission`, `KIND_COLOR` (existing).

- [ ] **Step 1: Day body** — in `IntelTimeline`, replace the day `<motion.section>` contents: header `pl-[66px]` becomes `pl-1`; items go into one group card instead of the rail grid:

```tsx
<motion.h3 variants={entry} className="sticky top-0 z-10 bg-linear-to-b from-beheer-window from-70% to-transparent pt-3.5 pb-2 pl-1 text-[11.5px] font-extrabold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase">
  {group.label}
</motion.h3>
{/* The window colour shows through the 2px gaps as row separators */}
<div className="flex flex-col gap-0.5 overflow-hidden rounded-[20px] bg-beheer-window">
  <AnimatePresence>
    {group.items.map((item) => (
      <Fold key={item.id}>
        <motion.div variants={entry}>
          <Row item={item} now={now} onSelect={onSelect} />
        </motion.div>
      </Fold>
    ))}
  </AnimatePresence>
</div>
```

- [ ] **Step 2: Row, icon tile, meta** — remove `UnreadDot` and `WideCard`; add (imports: `MegaphoneIcon, ClipboardListIcon, LightbulbIcon, type LucideIcon` from `lucide-react`; `CookieBadge` from `@/components/tracker/CookieBadge`; `SuccessBadge` from `@/components/auth/SuccessBadge`; `cn, getColorFromArea, areaOptions` from `@/lib/utils`; `assignmentMeta, isHintDone, siteSubmission, type MetaSegment, type MetaTone` from `@/lib/intel-window`; `AreaState` from `@/types/Intel`; drop the `AreaChip` import):

```tsx
const KIND_ICON: Record<IntelKind, LucideIcon> = { news: MegaphoneIcon, assignment: ClipboardListIcon, hint: LightbulbIcon };

const META_TONE: Record<MetaTone, string> = {
  muted: '',
  ok: 'text-green-600 dark:text-green-400',
  info: 'text-blue-500 dark:text-blue-400',
  warn: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};

/**
 * One row of a day group: kind tile, title, grey line. `--row-bg` is the row's background (card, lighter on hover); the
 * badges on the tile ring themselves in it so they cut out cleanly.
 */
function Row({ item, now, onSelect }: { item: IntelItem; now: number; onSelect: (id: number) => void }) {
  const done = item.kind === 'assignment' ? !!siteSubmission(item.assignment)?.judged : item.kind === 'hint' && isHintDone(item.cells);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="flex w-full items-center gap-3 bg-(--row-bg) px-3.5 py-[11px] text-left outline-none transition-colors [--row-bg:var(--card)] hover:[--row-bg:var(--beheer-row)] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      <KindTile kind={item.kind} unread={item.unread} done={done} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          <span className="tabular-nums">{formatClock(item.publishAt)}</span>
          <RowMeta item={item} now={now} />
        </span>
      </span>
    </button>
  );
}

/** Tonal kind tile; a white dot top-right while unread, a green cookie check bottom-right once judged / fully solved */
function KindTile({ kind, unread, done }: { kind: IntelKind; unread: boolean; done: boolean }) {
  const Icon = KIND_ICON[kind];
  // As AreaChip did: a check that appears on screen pops in (SuccessBadge), one mounted done is static
  const [poppable, setPoppable] = useState(!done);
  if (!done && !poppable) setPoppable(true);
  return (
    <span
      className="relative grid size-[34px] shrink-0 place-items-center rounded-xl"
      style={{ color: KIND_COLOR[kind], backgroundColor: `color-mix(in oklab, ${KIND_COLOR[kind]} 16%, var(--card))` }}
    >
      <Icon className="size-[17px]" strokeWidth={2.2} />
      <AnimatePresence initial={false}>
        {unread && (
          <motion.span
            key="unread"
            aria-label="ongelezen"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={REVEAL_TRANSITION}
            className="absolute -top-0.5 -right-0.5 size-[9px] rounded-full bg-foreground shadow-[0_0_0_2.5px_var(--row-bg)]"
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {done && (
          <motion.span
            key="done"
            exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}
            className="absolute -right-1 -bottom-1 grid place-items-center rounded-full bg-(--row-bg) p-0.5"
          >
            {poppable ? <SuccessBadge size={16} /> : <CookieBadge tone="ok" size={16} />}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** The rest of the grey line after the time */
function RowMeta({ item, now }: { item: IntelItem; now: number }) {
  if (item.kind === 'news') return item.summary ? <> · {item.summary}</> : null;
  if (item.kind === 'hint') return <HintMeta cells={item.cells} />;
  return assignmentMeta(item, now).map((segment, index) => <MetaPart key={index} segment={segment} />);
}

/** " · text"; a new text fades in, a new colour eases */
function MetaPart({ segment }: { segment: MetaSegment }) {
  return (
    <>
      {' · '}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={segment.text}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn('transition-colors', META_TONE[segment.tone])}
        >
          {segment.text}
        </motion.span>
      </AnimatePresence>
    </>
  );
}

/** " · ●○○○ 1/8 opgelost": a dot per area in its colour (filled = solved, ring = open, faint ring = no hint) */
function HintMeta({ cells }: { cells: IntelItem['cells'] }) {
  const states = areaStates(cells);
  const { solved, total } = solvedCount(cells);
  return (
    <>
      {' · '}
      <span className="mr-1.5 inline-flex gap-[3px] align-middle">
        {areaOptions.map(({ value, label }) => (
          <AreaDot key={value} area={value} label={label} state={states[value]} />
        ))}
      </span>
      <span className={cn('transition-colors', total > 0 && solved === total && META_TONE.ok)}>
        {solved}/{total} opgelost
      </span>
    </>
  );
}

const AREA_TITLE: Record<AreaState, string> = { solved: 'opgelost', open: 'nog open', none: 'geen hint', missing: 'geen hint' };

/** Fills (with a short pop) when its area gets solved on screen; mounting solved just shows it filled */
function AreaDot({ area, label, state }: { area: string; label: string; state: AreaState }) {
  const color = getColorFromArea(area);
  const solved = state === 'solved';
  return (
    <motion.span
      title={`${label}: ${AREA_TITLE[state]}`}
      initial={false}
      animate={{ scale: solved ? [1, 1.6, 1] : 1 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="block size-1.5 rounded-full transition-[background-color,box-shadow,opacity] duration-200"
      style={{
        backgroundColor: solved ? color : 'transparent',
        boxShadow: solved ? 'none' : `inset 0 0 0 1.4px ${color}`,
        opacity: solved ? 1 : state === 'open' ? 0.7 : 0.3,
      }}
    />
  );
}
```

- [ ] **Step 3: Delete `AreaChips.tsx`; fix the HintPane comment** — `git rm src/components/intel-window/AreaChips.tsx`; in `HintPane.tsx:170` change `// Derived (as AreaChip): …` to `// Derived during render: …` (keep the rest of the sentence).

- [ ] **Step 4: Verify** — `npx bun test`, `npx bun run lint`, `npx tsc -b` → all clean. Remove now-unused imports (`ReactNode` stays for `Fold`/`TimelineList`; `Tag`/`ClockIcon` stay for `DeadlineTag`/`AssignmentStatusTag`).

- [ ] **Step 5: Visual check** — run the app, open Intel; check dark + light: news rows, open/urgent/expired/judged assignments, partly and fully solved hints, unread rows, hover (badge rings follow the hover colour), tab switch push, sticky day headers.

- [ ] **Step 6: Commit** — `git add -A src/components/intel-window && git commit -m "feat(intel): calm grouped timeline rows"`
