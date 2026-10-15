# Hint registreren card redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the sidebar "Hint registreren" card as one tonal block with custom M2 pickers (area tiles, day switch + hour grid), restyled digit boxes, an animated status line and lucide icons — behaviour unchanged.

**Architecture:** Pure time helpers (`hint-times.ts`, unit-tested) replace `getTimeOptions`. Two popover pickers (`AreaPicker`, `TimePicker`) share a trigger + tile style (`picker-parts.tsx`). `DigitBoxes` wraps `input-otp` with our own slots; `CoordinateStatus` shows the live NL check. `HintEntryCard` keeps the form logic (zod + react-hook-form, submit, hint bridge) and composes the new parts.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (`@theme inline`), radix-ui Popover (`src/components/ui/popover.tsx`), `input-otp`, `motion/react`, lucide-react, `bun test`.

**Spec:** `docs/superpowers/specs/2026-10-16-hint-entry-redesign-design.md`

## Global Constraints

- `bun` is not on PATH: run tests with `npx --yes bun test …`; typecheck with `npx tsc -b`; lint with `npx eslint <paths> --max-warnings 0`.
- Work on branch `feat/hint-entry-redesign` (from `main`); never push, never touch the docker stack (client :8080 / server :3000 are the user's live instance).
- All UI copy is Dutch, exactly as written in this plan. No emojis anywhere; icons are lucide-react only.
- Every state change animates (popover open/close, tile fill, slot colours, status swap) — see the user's "animations everywhere" rule.
- Buttons and triggers use the sidebar button rounding `rounded-lg` (= `--radius` 12px), not `rounded-full`.
- Popover cards reuse `MENU_CARD` from `src/components/settings/menu-parts.tsx`.
- Day switch reuses `Segmented` from `src/components/beheer/controls/Segmented.tsx` (spec said "Beheer segmented"; this is that component).
- Keep validation, `createMarker`, toasts, `flyTo`, and the hint bridge (`useHintFormBridge`) behaviour exactly as today.
- Comment style: short JSDoc on exported things, like the surrounding code.

---

### Task 1: Hint time helpers

**Files:**
- Create: `src/components/cards/hint-entry/hint-times.ts`
- Test: `src/components/cards/hint-entry/hint-times.test.ts`

**Interfaces:**
- Consumes: `Marker` (`@/types/Marker`), `MarkerType` (`@/types/MarkerType`).
- Produces:
  - `interface HintHour { value: string; label: string; day: string; taken: boolean }` — `value` ISO string, `label` `"HH:00"`, `day` local `"YYYY-MM-DD"`.
  - `interface HintDay { key: string; label: string; hours: HintHour[] }` — `label` full Dutch weekday, capitalised (`"Zaterdag"`).
  - `dayKey(date: Date): string`
  - `buildHintHours(start: Date, end: Date, now: Date, markers: Marker[] | undefined, area: string): HintHour[]`
  - `groupByDay(hours: HintHour[]): HintDay[]`
  - `defaultDay(days: HintDay[]): string | undefined`
  - `shortLabel(iso: string): string` — `"za 14:00"`
  - `isFreeHour(hours: HintHour[], value: string): boolean`

- [ ] **Step 1: Create the branch**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
git switch -c feat/hint-entry-redesign
```

- [ ] **Step 2: Write the failing tests**

All dates are built with the local `Date` constructor so the tests pass in any time zone. 17 Oct 2026 is a Saturday.

```ts
import { describe, expect, test } from 'bun:test';
import { buildHintHours, dayKey, defaultDay, groupByDay, isFreeHour, shortLabel } from './hint-times';
import { MarkerType } from '@/types/MarkerType';
import type { Marker } from '@/types/Marker';

const START = new Date(2026, 9, 17, 10);
const END = new Date(2026, 9, 18, 12);

function hint(area: string, time: Date, type = MarkerType.Hint): Marker {
  return { area, time, type, location: { type: 'Point', coordinates: [5, 52] } };
}

describe('buildHintHours', () => {
  test('lists every started hour from the start up to now', () => {
    const hours = buildHintHours(START, END, new Date(2026, 9, 17, 13, 30), [], 'alpha');
    expect(hours.map((h) => h.label)).toEqual(['10:00', '11:00', '12:00', '13:00']);
    expect(hours[0]).toEqual({ value: new Date(2026, 9, 17, 10).toISOString(), label: '10:00', day: '2026-10-17', taken: false });
  });

  test('stops at the hunt end once the hunt is over', () => {
    const hours = buildHintHours(START, END, new Date(2026, 9, 20), [], 'alpha');
    expect(hours).toHaveLength(26);
    expect(hours.at(-1)?.label).toBe('11:00');
    expect(hours.at(-1)?.day).toBe('2026-10-18');
  });

  test('is empty before the hunt starts', () => {
    expect(buildHintHours(START, END, new Date(2026, 9, 16), [], 'alpha')).toEqual([]);
  });

  test('marks hours that already have a hint for this area as taken', () => {
    const markers = [
      hint('alpha', new Date(2026, 9, 17, 11, 20)),
      hint('bravo', new Date(2026, 9, 17, 12, 5)),
      hint('alpha', new Date(2026, 9, 17, 12, 0), MarkerType.Hunt),
    ];
    const hours = buildHintHours(START, END, new Date(2026, 9, 17, 13, 30), markers, 'alpha');
    expect(hours.map((h) => h.taken)).toEqual([false, true, false, false]);
  });

  test('a hint on the same hour of another day does not count', () => {
    const markers = [hint('alpha', new Date(2026, 9, 18, 10, 0))];
    const hours = buildHintHours(START, END, new Date(2026, 9, 17, 11, 30), markers, 'alpha');
    expect(hours[0].taken).toBe(false);
  });

  test('accepts missing markers', () => {
    expect(buildHintHours(START, END, new Date(2026, 9, 17, 10, 30), undefined, 'alpha')).toHaveLength(1);
  });
});

describe('groupByDay', () => {
  test('splits the hours per calendar day with the Dutch weekday', () => {
    const days = groupByDay(buildHintHours(START, END, new Date(2026, 9, 18, 1, 30), [], 'alpha'));
    expect(days.map((d) => [d.key, d.label, d.hours.length])).toEqual([
      ['2026-10-17', 'Zaterdag', 14],
      ['2026-10-18', 'Zondag', 2],
    ]);
  });

  test('is empty without hours', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('defaultDay', () => {
  test('picks the day of the latest free hour', () => {
    const days = groupByDay(buildHintHours(START, END, new Date(2026, 9, 18, 1, 30), [], 'alpha'));
    expect(defaultDay(days)).toBe('2026-10-18');
  });

  test('skips a day whose hours are all taken', () => {
    const markers = [hint('alpha', new Date(2026, 9, 18, 0, 10)), hint('alpha', new Date(2026, 9, 18, 1, 10))];
    const days = groupByDay(buildHintHours(START, END, new Date(2026, 9, 18, 1, 30), markers, 'alpha'));
    expect(defaultDay(days)).toBe('2026-10-17');
  });

  test('falls back to the last day when every hour is taken', () => {
    const markers = [hint('alpha', new Date(2026, 9, 17, 10, 10))];
    const days = groupByDay(buildHintHours(START, END, new Date(2026, 9, 17, 10, 30), markers, 'alpha'));
    expect(defaultDay(days)).toBe('2026-10-17');
  });

  test('is undefined without days', () => {
    expect(defaultDay([])).toBeUndefined();
  });
});

describe('labels', () => {
  test('dayKey uses the local date', () => {
    expect(dayKey(new Date(2026, 9, 18, 0, 5))).toBe('2026-10-18');
  });

  test('shortLabel shows the short weekday and hour', () => {
    expect(shortLabel(new Date(2026, 9, 17, 14).toISOString())).toBe('za 14:00');
    expect(shortLabel(new Date(2026, 9, 18, 9).toISOString())).toBe('zo 09:00');
  });
});

describe('isFreeHour', () => {
  const hours = buildHintHours(START, END, new Date(2026, 9, 17, 12, 30), [hint('alpha', new Date(2026, 9, 17, 11))], 'alpha');

  test('true for a listed hour that is not taken', () => {
    expect(isFreeHour(hours, hours[0].value)).toBe(true);
  });

  test('false for a taken hour, an unknown hour or empty', () => {
    expect(isFreeHour(hours, hours[1].value)).toBe(false);
    expect(isFreeHour(hours, new Date(2026, 9, 19, 10).toISOString())).toBe(false);
    expect(isFreeHour(hours, '')).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx --yes bun test src/components/cards/hint-entry/hint-times.test.ts`
Expected: FAIL — `Cannot find module './hint-times'`.

- [ ] **Step 4: Write the implementation**

```ts
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

/** One hour a hint can be registered for */
export interface HintHour {
  /** ISO timestamp of the hour, the form value */
  value: string;
  /** "HH:00" */
  label: string;
  /** Local calendar day, "YYYY-MM-DD" */
  day: string;
  /** A hint for this area and hour is already registered */
  taken: boolean;
}

/** The hours of one calendar day, for the day switch in the time picker */
export interface HintDay {
  key: string;
  /** Full Dutch weekday, e.g. "Zaterdag" */
  label: string;
  hours: HintHour[];
}

const HOUR_MS = 3_600_000;
const WEEKDAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const SHORT_WEEKDAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of a date as "YYYY-MM-DD" */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const hourKey = (date: Date) => `${dayKey(date)}T${pad(date.getHours())}`;

/**
 * Every hour from the hunt start up to now (or the hunt end, whichever is first), marking the hours that already have
 * a hint for the area.
 */
export function buildHintHours(start: Date, end: Date, now: Date, markers: Marker[] | undefined, area: string): HintHour[] {
  const last = now < end ? now : end;
  const taken = new Set(
    (markers ?? [])
      .filter((marker) => marker.type === MarkerType.Hint && marker.area === area)
      .map((marker) => hourKey(new Date(marker.time))),
  );
  const hours: HintHour[] = [];
  for (let time = new Date(start); time < last; time = new Date(time.getTime() + HOUR_MS)) {
    hours.push({ value: time.toISOString(), label: `${pad(time.getHours())}:00`, day: dayKey(time), taken: taken.has(hourKey(time)) });
  }
  return hours;
}

/** Group hours per calendar day, in order */
export function groupByDay(hours: HintHour[]): HintDay[] {
  const days: HintDay[] = [];
  for (const hour of hours) {
    const current = days.at(-1);
    if (current?.key === hour.day) current.hours.push(hour);
    else days.push({ key: hour.day, label: WEEKDAYS[new Date(hour.value).getDay()], hours: [hour] });
  }
  return days;
}

/** The day the time picker opens on: the day of the latest free hour (during the hunt that's today), else the last day */
export function defaultDay(days: HintDay[]): string | undefined {
  const latestFree = days.flatMap((day) => day.hours).findLast((hour) => !hour.taken);
  return latestFree?.day ?? days.at(-1)?.key;
}

/** Trigger label of a chosen hour: "za 14:00" */
export function shortLabel(iso: string): string {
  const date = new Date(iso);
  return `${SHORT_WEEKDAYS[date.getDay()]} ${pad(date.getHours())}:00`;
}

/** Whether a chosen hour is still listed and free (used when the area changes) */
export function isFreeHour(hours: HintHour[], value: string): boolean {
  return hours.some((hour) => hour.value === value && !hour.taken);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx --yes bun test src/components/cards/hint-entry/hint-times.test.ts`
Expected: all PASS.

If `findLast` is flagged by `npx tsc -b` (lib target), replace it with `[...list].reverse().find(...)`.

- [ ] **Step 6: Commit**

```bash
git add src/components/cards/hint-entry/hint-times.ts src/components/cards/hint-entry/hint-times.test.ts
git commit -m "feat(hint-entry): time helpers with taken hours and day groups"
```

---

### Task 2: Primary container tokens + area and time pickers

**Files:**
- Modify: `src/index.css` (`:root` block ends ~line 61, `.dark` block ends ~line 107, `@theme inline` block ~line 109-160)
- Create: `src/components/cards/hint-entry/picker-parts.tsx`
- Create: `src/components/cards/hint-entry/AreaPicker.tsx`
- Create: `src/components/cards/hint-entry/TimePicker.tsx`

**Interfaces:**
- Consumes: `HintDay`, `dayKey`, `defaultDay`, `shortLabel` from Task 1; `MENU_CARD` (`@/components/settings/menu-parts`); `Segmented` (`@/components/beheer/controls/Segmented`); `areaOptions`, `getColorFromArea`, `cn` (`@/lib/utils`).
- Produces:
  - Tailwind colours `bg-primary-container`, `text-on-primary-container`.
  - `PickerTrigger` (props: `lead: ReactNode; placeholder: string; label?: string; invalid?: boolean` + all `<button>` props) and `pickerTileClass(selected: boolean, taken?: boolean): string`.
  - `AreaPicker` default export, props `{ id: string; value: string; onChange: (area: string) => void; invalid?: boolean; afterPick?: () => void }`.
  - `TimePicker` default export, props `{ id: string; value: string; onChange: (iso: string) => void; days: HintDay[]; open: boolean; onOpenChange: (open: boolean) => void; disabled?: boolean; invalid?: boolean; afterPick?: () => void }`.

- [ ] **Step 1: Add the tokens**

In `src/index.css`, at the end of the `:root { … }` block (after `--ai-on-think-container: #2c0051;`):

```css
  /* Orange tonal pair (M3 primary container): picked tiles, filled digit boxes */
  --primary-container: #ffdcc6;
  --on-primary-container: #5a1f00;
```

At the end of the `.dark { … }` block (after `--ai-on-think-container: #f0dbff;`):

```css
  --primary-container: #6b2b05;
  --on-primary-container: #ffdcc6;
```

Inside `@theme inline { … }`, after `--color-ai-on-think: var(--ai-on-think-container);`:

```css
  --color-primary-container: var(--primary-container);
  --color-on-primary-container: var(--on-primary-container);
```

- [ ] **Step 2: Create `picker-parts.tsx`**

```tsx
import type { ComponentProps, ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Tile in a picker grid; picked = orange tonal fill with a primary ring, taken = crossed out. */
export function pickerTileClass(selected: boolean, taken = false): string {
  return cn(
    'flex items-center justify-center gap-1.5 rounded-[14px] text-[13px] font-semibold outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50',
    selected
      ? 'bg-primary-container text-on-primary-container shadow-[inset_0_0_0_2px_var(--primary)]'
      : 'bg-beheer-row hover:bg-beheer-row-high',
    taken && 'cursor-not-allowed line-through opacity-35 hover:bg-beheer-row',
  );
}

interface PickerTriggerProps extends ComponentProps<'button'> {
  /** Area colour dot or icon in front of the value */
  lead: ReactNode;
  placeholder: string;
  /** Chosen value; the muted placeholder shows when empty */
  label?: string;
  invalid?: boolean;
}

/** Card-coloured trigger on the tonal block; the chevron turns and a primary ring shows while its popover is open. */
export function PickerTrigger({ lead, placeholder, label, invalid, className, ...props }: PickerTriggerProps) {
  return (
    <button
      type="button"
      aria-invalid={invalid || undefined}
      className={cn(
        'group flex h-10 w-full min-w-0 items-center gap-2 rounded-lg bg-card px-2.5 text-left text-sm outline-none transition-[background-color,box-shadow,opacity] duration-150 hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-card data-[state=open]:shadow-[inset_0_0_0_2px_var(--primary)] aria-invalid:shadow-[inset_0_0_0_2px_var(--destructive)]',
        className,
      )}
      {...props}
    >
      {lead}
      <span className={cn('min-w-0 flex-1 truncate', !label && 'text-muted-foreground')}>{label ?? placeholder}</span>
      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </button>
  );
}
```

- [ ] **Step 3: Create `AreaPicker.tsx`**

```tsx
import { useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MENU_CARD } from '@/components/settings/menu-parts';
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
import { PickerTrigger, pickerTileClass } from './picker-parts';

interface AreaPickerProps {
  id: string;
  value: string;
  onChange: (area: string) => void;
  invalid?: boolean;
  /** Runs once the popover has closed after a pick (opens the time picker) */
  afterPick?: () => void;
}

/** Deelgebied picker: trigger with the area's map colour, popover with a 3×3 grid of area tiles. */
export default function AreaPicker({ id, value, onChange, invalid, afterPick }: AreaPickerProps) {
  const [open, setOpen] = useState(false);
  const picked = useRef(false);
  const current = areaOptions.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PickerTrigger
          id={id}
          invalid={invalid}
          placeholder="Gebied"
          label={current?.label}
          aria-label={current ? `Deelgebied: ${current.label}` : 'Deelgebied kiezen'}
          lead={<span aria-hidden className="size-2.5 shrink-0 rounded-full transition-colors duration-200" style={{ background: current ? getColorFromArea(current.value) : 'var(--border)' }} />}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className={cn(MENU_CARD, 'w-[300px] p-2.5')}
        // After a pick, focus goes on to the time picker instead of back to this trigger
        onCloseAutoFocus={(event) => {
          if (!picked.current) return;
          picked.current = false;
          event.preventDefault();
          afterPick?.();
        }}
      >
        <div className="grid grid-cols-3 gap-1">
          {areaOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === value}
              className={cn(pickerTileClass(option.value === value), 'h-11')}
              onClick={() => {
                picked.current = true;
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: getColorFromArea(option.value) }} />
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Create `TimePicker.tsx`**

The day shown is reset each time the popover opens (to the chosen hour's day, else `defaultDay`). This uses the "adjust state while rendering" pattern instead of an effect, so the react-hooks lint rules stay quiet.

```tsx
import { useRef, useState } from 'react';
import { ClockIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MENU_CARD } from '@/components/settings/menu-parts';
import Segmented from '@/components/beheer/controls/Segmented';
import { cn } from '@/lib/utils';
import { dayKey, defaultDay, shortLabel, type HintDay } from './hint-times';
import { PickerTrigger, pickerTileClass } from './picker-parts';

interface TimePickerProps {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  days: HintDay[];
  /** Controlled, so picking an area can open it */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Runs once the popover has closed after a pick (focuses X) */
  afterPick?: () => void;
}

/** Tijdstip picker: day switch and a grid of hours; hours that already have a hint for the area are crossed out. */
export default function TimePicker({ id, value, onChange, days, open, onOpenChange, disabled, invalid, afterPick }: TimePickerProps) {
  const [day, setDay] = useState<string>();
  const [wasOpen, setWasOpen] = useState(open);
  const picked = useRef(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDay(value ? dayKey(new Date(value)) : defaultDay(days));
  }

  const shown = days.find((d) => d.key === day) ?? days.find((d) => d.key === defaultDay(days));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <PickerTrigger
          id={id}
          disabled={disabled}
          invalid={invalid}
          placeholder="Tijd"
          label={value ? shortLabel(value) : undefined}
          aria-label={value ? `Tijdstip: ${shortLabel(value)}` : 'Tijdstip kiezen'}
          lead={<ClockIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={8}
        className={cn(MENU_CARD, 'w-[280px] p-2.5')}
        // After a pick, focus goes on to the X digits instead of back to this trigger
        onCloseAutoFocus={(event) => {
          if (!picked.current) return;
          picked.current = false;
          event.preventDefault();
          afterPick?.();
        }}
      >
        {shown ? (
          <div className="flex flex-col gap-2">
            {days.length > 1 && (
              <Segmented
                label="Dag"
                value={shown.key}
                options={days.map((d) => ({ value: d.key, label: d.label }))}
                onChange={setDay}
                className="flex w-full flex-nowrap [&>*]:flex-1 [&>*]:justify-center"
              />
            )}
            <div className="grid grid-cols-4 gap-1">
              {shown.hours.map((hour) => (
                <button
                  key={hour.value}
                  type="button"
                  disabled={hour.taken}
                  aria-pressed={hour.value === value}
                  title={hour.taken ? 'Al geregistreerd' : undefined}
                  className={cn(pickerTileClass(hour.value === value, hour.taken), 'h-[38px] tabular-nums')}
                  onClick={() => {
                    picked.current = true;
                    onChange(hour.value);
                    onOpenChange(false);
                  }}
                >
                  {hour.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">(Nog) geen tijdstip te kiezen</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc -b && npx eslint src/components/cards/hint-entry src/index.css --max-warnings 0`
(If eslint refuses the `.css` path, drop it from the command.)
Expected: no output / exit 0. The pickers are not used yet; that's fine.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/components/cards/hint-entry/picker-parts.tsx src/components/cards/hint-entry/AreaPicker.tsx src/components/cards/hint-entry/TimePicker.tsx
git commit -m "feat(hint-entry): area tile picker and day/hour time picker"
```

---

### Task 3: Digit boxes, status line and the new card layout

**Files:**
- Create: `src/components/cards/hint-entry/DigitBoxes.tsx`
- Create: `src/components/cards/hint-entry/CoordinateStatus.tsx`
- Modify: `src/components/cards/hint-entry/HintEntryCard.tsx` (whole file)

**Interfaces:**
- Consumes: Task 1 helpers (`buildHintHours`, `groupByDay`, `isFreeHour`), Task 2 `AreaPicker` / `TimePicker`, `SWAP` (`@/lib/motion`), `OTPInput`, `OTPInputContext`, `REGEXP_ONLY_DIGITS` (`input-otp`).
- Produces: `DigitBoxes` default export, props `{ id: string; label: string; name: string; value: string; onChange: (value: string) => void; onBlur: () => void; onComplete: () => void; bad: boolean; ref?: Ref<HTMLInputElement>; disabled?: boolean }`; `CoordinateStatus` default export, props `{ state: CoordinateState }` with `type CoordinateState = 'idle' | 'inside' | 'outside'`.

- [ ] **Step 1: Create `DigitBoxes.tsx`**

```tsx
import { useContext, type Ref } from 'react';
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from 'input-otp';
import { cn } from '@/lib/utils';

interface DigitBoxesProps {
  id: string;
  /** "X" or "Y" */
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  /** All 6 digits entered: move focus on */
  onComplete: () => void;
  /** Outside the Netherlands or rejected: filled boxes turn red */
  bad: boolean;
  ref?: Ref<HTMLInputElement>;
  disabled?: boolean;
}

/** One RD coordinate: axis label and 6 digit boxes (input-otp keeps paste, the numeric keyboard and focus handling). */
export default function DigitBoxes({ id, label, bad, ...field }: DigitBoxesProps) {
  return (
    <div className="grid grid-cols-[20px_1fr] items-center gap-1">
      <label htmlFor={id} className="text-sm font-bold text-muted-foreground">{label}</label>
      <OTPInput
        id={id}
        autoComplete="off"
        inputMode="numeric"
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        aria-invalid={bad || undefined}
        containerClassName="grid grid-cols-6 gap-1"
        {...field}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => <DigitSlot key={index} index={index} bad={bad} />)}
      </OTPInput>
    </div>
  );
}

/** Card-coloured box; the box being typed in gets a primary ring, filled boxes an orange (or red) tonal fill. */
function DigitSlot({ index, bad }: { index: number; bad: boolean }) {
  const { char, hasFakeCaret, isActive } = useContext(OTPInputContext).slots[index];
  return (
    <div
      className={cn(
        'relative flex h-[46px] items-center justify-center rounded-[10px] font-mono text-[22px] font-semibold tabular-nums transition-[background-color,color,box-shadow] duration-150',
        !char ? 'bg-card' : bad ? 'bg-fox-error-container text-fox-on-error' : 'bg-primary-container text-on-primary-container',
        isActive && 'shadow-[inset_0_0_0_2px_var(--primary)]',
      )}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `CoordinateStatus.tsx`**

```tsx
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheckIcon, KeyboardIcon, TriangleAlertIcon } from 'lucide-react';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type CoordinateState = 'idle' | 'inside' | 'outside';

const STATES = {
  idle: { Icon: KeyboardIcon, text: 'Tik op de vakjes om te typen', className: 'text-muted-foreground' },
  inside: { Icon: CircleCheckIcon, text: 'Ligt in Nederland', className: 'text-fox-ok' },
  outside: { Icon: TriangleAlertIcon, text: 'Buiten Nederland', className: 'text-fox-error' },
} as const;

/** Live check under the digit boxes: typing hint, inside the Netherlands, or outside. */
export default function CoordinateStatus({ state }: { state: CoordinateState }) {
  const { Icon, text, className } = STATES[state];
  return (
    <p role="status" aria-live="polite" className="min-w-0 flex-1 text-xs font-medium">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state} {...SWAP} className={cn('inline-flex items-center gap-1.5', className)}>
          <Icon aria-hidden className="size-3.5 shrink-0" />
          {text}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}
```

- [ ] **Step 3: Rewrite `HintEntryCard.tsx`**

Replace the whole file with:

```tsx
import {z} from 'zod';
import {Controller, useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button} from '../../ui/button.tsx';
import {EraserIcon, Pin} from 'lucide-react';
import {useMarkers} from '@/hooks/markers.hook.ts';
import {toast} from 'sonner';
import PropTypes, {InferProps} from 'prop-types';
import {MapRef} from '@/components/Map.tsx';
import {MarkerType} from '@/types/MarkerType.ts';
import {Marker} from '@/types/Marker.ts';
import {areaOptions} from '@/lib/utils.ts';
import {useEffect, useId, useState} from "react";
import {useHintFormBridge} from "@/hooks/hint-bridge.hook.ts";
import {isInNetherlands} from '@/lib/netherlands';
import {fromRD, isPlausibleRD} from '@/lib/rd';
import {apiErrorMessage} from '@/lib/api-error';
import AreaPicker from './AreaPicker';
import TimePicker from './TimePicker';
import DigitBoxes from './DigitBoxes';
import CoordinateStatus, {type CoordinateState} from './CoordinateStatus';
import {buildHintHours, groupByDay, isFreeHour} from './hint-times';

const FormSchema = z.object({
    area: z.enum([...areaOptions.map((option) => option.value)] as [string, ...string[]]),
    time: z.string(),
    x: z.string().length(6),
    y: z.string().length(6),
});

const HUNT_START = new Date(import.meta.env.HUNT_START_TIME);
const HUNT_END = new Date(import.meta.env.HUNT_END_TIME);

export default function HintEntryCard({mapRef}: InferProps<typeof HintEntryCard.propTypes>) {
    const {coords, clear} = useHintFormBridge();
    const fieldId = useId();
    const submitId = `${fieldId}-submit`;
    const {markers, createMarker} = useMarkers();
    const [timeOpen, setTimeOpen] = useState(false);

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            area: '',
            time: '',
            x: '',
            y: '',
        },
    });
    const selectedArea = useWatch({control: form.control, name: 'area'});
    const [xValue, yValue] = useWatch({control: form.control, name: ['x', 'y']});

    // Live check once both coordinates are complete: hints are always in the Netherlands
    const typedLocation = xValue?.length === 6 && yValue?.length === 6 ? fromRD(Number(xValue), Number(yValue)) : undefined;
    const outsideNetherlands = !!typedLocation && !isInNetherlands(typedLocation[0], typedLocation[1]);
    const coordinateState: CoordinateState = outsideNetherlands ? 'outside' : typedLocation ? 'inside' : 'idle';

    // Hours for the chosen area; hours that already have a hint are kept but marked taken
    const days = groupByDay(buildHintHours(HUNT_START, HUNT_END, new Date(), markers, selectedArea));

    // Handle hint bridge
    useEffect(() => {
        if (coords) {
            form.setValue("x", coords.x, { shouldValidate: true, shouldDirty: true });
            form.setValue("y", coords.y, { shouldValidate: true, shouldDirty: true });
            clear();
        }
    }, [coords, clear, form]);

    /**
     * Choose an area; the chosen time stays only while it's still free for the new area.
     */
    function changeArea(area: string) {
        form.setValue('area', area, {shouldValidate: true, shouldDirty: true});
        const time = form.getValues('time');
        if (time && !isFreeHour(buildHintHours(HUNT_START, HUNT_END, new Date(), markers, area), time)) {
            form.setValue('time', '', {shouldDirty: true});
        }
    }

    /**
     * When submitted, create a new marker.
     * Checks if the coördinates are valid.
     */
    async function onSubmit(data: z.infer<typeof FormSchema>) {
        // Convert RD coordinates to WGS84
        const x = Number(data.x);
        const y = Number(data.y);
        if (!isPlausibleRD(x, y)) {
            form.setError('x', {message: 'Ongeldige coördinaten'});
            form.setError('y', {message: 'Ongeldige coördinaten'});
            toast.error('Ongeldige coördinaten', {description: "Deze coördinaten zijn ongeldig. Controleer of de ingevoerde waarden correct zijn."});
            return;
        }
        const converted = fromRD(x, y);
        if (!isInNetherlands(converted[0], converted[1])) {
            form.setError('y', {message: 'Dit coördinaat ligt buiten Nederland'});
            toast.error('Coördinaat buiten Nederland', {description: 'Controleer de X- en Y-waarden; een hint ligt altijd in Nederland.'});
            return;
        }

        const marker: Marker = {
            area: data.area,
            time: new Date(data.time),
            location: {
                type: 'Point',
                coordinates: [converted[0], converted[1]],
            },
            type: MarkerType.Hint,
        };

        const error = await createMarker(marker);
        if (!error) {
            form.reset();
            toast.success('Hint geregistreerd!', {
                description: 'De hint is succesvol geregistreerd.'
            });
            mapRef.current?.flyTo({
                center: [converted[0], converted[1]],
                duration: 2000,
                zoom: 12,
            });
        } else {
            toast.error('Fout bij registreren hint.', {
                description: apiErrorMessage(error, 'Er is een fout opgetreden bij het registreren van de hint.')
            });
        }
    }

    /** Wissen: empty both coordinates. */
    function clearCoordinates() {
        form.setValue('x', '');
        form.setValue('y', '');
    }

    /**
     * One RD coordinate row: axis label and 6 digit boxes.
     * Calls onComplete once all 6 digits are entered, so focus can move on.
     */
    const coordinateField = (name: 'x' | 'y', label: string, onComplete: () => void) => (
        <Controller
            control={form.control}
            name={name}
            render={({field, fieldState}) => (
                <DigitBoxes id={`${fieldId}-${name}`} label={label} onComplete={onComplete}
                            bad={outsideNetherlands || fieldState.invalid} {...field}/>
            )}
        />
    );

    return (
        <form onSubmit={(e) => form.handleSubmit(onSubmit)(e)} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5 rounded-[20px] bg-beheer-row p-3.5">
                <div className="mb-1.5 flex gap-1.5">
                    <Controller
                        control={form.control}
                        name="area"
                        render={({field, fieldState}) => (
                            <div className="min-w-0 flex-1">
                                <AreaPicker id={`${fieldId}-area`} value={field.value} onChange={changeArea}
                                            invalid={fieldState.invalid} afterPick={() => setTimeOpen(true)}/>
                            </div>
                        )}
                    />
                    <Controller
                        control={form.control}
                        name="time"
                        render={({field, fieldState}) => (
                            <div className="min-w-0 flex-1">
                                <TimePicker id={`${fieldId}-time`} value={field.value} onChange={field.onChange}
                                            days={days} open={timeOpen} onOpenChange={setTimeOpen}
                                            disabled={!selectedArea} invalid={fieldState.invalid}
                                            afterPick={() => document.getElementById(`${fieldId}-x`)?.focus()}/>
                            </div>
                        )}
                    />
                </div>
                {coordinateField('x', 'X', () => document.getElementById(`${fieldId}-y`)?.focus())}
                {coordinateField('y', 'Y', () => setTimeout(() => document.getElementById(submitId)?.focus()))}
                <div className="mt-1 flex items-center justify-between gap-2">
                    <CoordinateStatus state={coordinateState}/>
                    <button type="button" onClick={clearCoordinates}
                            className="inline-flex items-center gap-1.5 rounded-md px-1 text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                        <EraserIcon aria-hidden className="size-3.5"/> Wissen
                    </button>
                </div>
            </div>
            <Button id={submitId} type="submit" className="h-11 text-[15px]" disabled={!form.formState.isValid || outsideNetherlands}>
                <Pin data-icon="inline-start"/> Registreren
            </Button>
        </form>
    );
}

HintEntryCard.propTypes = {
    mapRef: PropTypes.object.isRequired as PropTypes.Validator<React.RefObject<MapRef | null>>,
};
```

Notes for the implementer:
- `Field`, `FieldGroup`, `FieldLabel`, `Select*`, `InputOTP*` and `TrashIcon` imports are gone on purpose; `ui/select.tsx` and `ui/input-otp.tsx` stay (used elsewhere or harmless).
- `{...field}` from the Controller passes `name`, `value`, `onChange`, `onBlur`, `ref`, `disabled` into `DigitBoxes`, matching its props.

- [ ] **Step 4: Typecheck, lint, run all tests**

Run: `npx tsc -b && npx eslint src/components/cards/hint-entry --max-warnings 0 && npx --yes bun test`
Expected: exit 0; all tests pass (including Task 1's).

- [ ] **Step 5: Commit**

```bash
git add src/components/cards/hint-entry/
git commit -m "feat(hint-entry): tonal block with pickers, digit boxes and live NL status"
```

---

### Task 4: Check it in the browser

**Files:** none unless a fix is needed (fixes go in the file they concern, committed as `fix(hint-entry): …`).

The dev `.env` uses the 2023 hunt times, so in dev every hour of that hunt is listed (handy for the time grid).

- [ ] **Step 1: Start the dev server on a free port** (never restart the docker stack)

Run in the background: `npx vite --port 5179 --strictPort`
Open `http://localhost:5179` with the T3 preview tools (`preview_open`, then `preview_evaluate` for DOM checks; keep each evaluate under 15 s). Log in as you normally would on the dev stack.

- [ ] **Step 2: Walk the flow (light theme, sidebar)**

Check each, fix anything off:
1. Card: one tonal block, two triggers ("Gebied" with grey dot, "Tijd" with clock, dimmed), 2×6 digit boxes, status "Tik op de vakjes om te typen", "Wissen" with eraser, orange "Registreren" disabled.
2. Click "Gebied": rounded-3xl card scales in, 3×3 tiles with colour dots. Pick Alpha → card closes, trigger shows the red dot + "Alpha", **time picker opens by itself**.
3. Time picker: day switch (Zaterdag / Zondag) on the day with the latest free hour, 4-column hour grid; hours with an existing alpha hint crossed out and not clickable. Switch days → grid changes. Pick an hour → closes, trigger shows e.g. "za 14:00", **X box 1 has the ring**.
4. Type `155000` → focus jumps to Y; type `463000` → status swaps to green "Ligt in Nederland", button enabled and focused.
5. Clear with "Wissen", type X `300000`, Y `463000` → filled boxes red, status red "Buiten Nederland", button disabled.
6. Switch area to one where the chosen hour is taken → time resets to "Tijd". Switch to one where it's free → time stays.
7. Right-click on the map → pick location (hint bridge) fills X/Y.
8. Submit a valid hint → toast, form resets, map flies to it. (Uses the dev DB; delete the test hint afterwards via the map popup.)

- [ ] **Step 3: Dark theme + phone width**

Toggle the theme in the sidebar header; repeat a quick pass of steps 1–5: tonal fills readable, orange container `#6b2b05` with light text, red boxes readable. Then `preview_resize` to 390×844 and open the hint page from the mobile menu: popovers sit above the bottom sheet, stay on screen (collision padding), digit boxes fit without overflow.

- [ ] **Step 4: Final checks and commit fixes**

Run: `npx tsc -b && npx eslint . --max-warnings 0 && npx --yes bun test`
Expected: exit 0.

```bash
git status --short   # only intended files
git commit -am "fix(hint-entry): <what the browser pass found>"   # only if there were fixes
```

Stop the dev server by its PID (not `pkill -f`). Leave the branch unmerged for review.
