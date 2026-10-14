# Beheer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every pane of the admin "Beheer" window (`src/components/beheer/`) in the app's tonal-card language (N1 nav, D1 cards, G3/I5/H1/B4/K1 panes) without changing what the panes can do, plus the interactions the spec lists.

**Architecture:** First a set of Beheer-only building blocks (pills, M3 switch, segmented picker, tonal card + segmented rows, expandable row, inline confirm) replaces the old `BeheerLayout` primitives; a temporary `BeheerGroup` shim keeps the old panes compiling. Then the shell (N1 nav) and one task per pane, each pane task starting with the pure helpers it needs (bun-tested in `src/lib/`). Frontend only; the server API is unchanged.

**Tech Stack:** React 19, TypeScript 6, Tailwind v4 (tokens in `src/index.css`), `motion/react` 14 (+ `src/lib/motion.ts` SWAP/POP/REVEAL), Radix (`radix-ui` Switch / ToggleGroup primitives), lucide-react, sonner toasts, SWR hooks, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-10-14-beheer-redesign-design.md` (+ the Algemeen card of `docs/superpowers/specs/2026-10-14-huntable-areas-design.md`).
**Mockups (visual source of truth):** `.superpowers/brainstorm/752618-1791974615/content/` — `beheer-nav.html` (N1), `beheer-vossen-w5.html` (card 2), `p1-gebruikers-v2.html` (G3), `p2-invites.html` (I5, without the Telegram button), `p3-hunters.html` (H1), `p4-bericht.html` (B4), `p5-koppelingen.html` (K1, with the real `TelegramLogo` / `Life360Logo`). Open them in a browser while working on a task.

## Global Constraints

- **No avatar / profile circles. No icons in card titles.** (Koppelingen's brand logo circle sits in the card body, per K1.)
- Every UI state change animates: `motion/react` + `src/lib/motion.ts` (`SWAP`, `POP`, `REVEAL_TRANSITION`, `SWAP_TRANSITION`); rows that come and go fold in/out (height + opacity); `prefers-reduced-motion` is respected via the global `<MotionConfig reducedMotion="user">` in `src/main.tsx` and `motion-safe:` / `motion-reduce:` for CSS animations.
- Dutch copy as today unless the spec states new copy.
- Keep every current handler and behaviour (toasts, error texts, demo confirm dialog, reload-teams dialog, invite revoke confirm dialog, clipboard fallbacks, link flows).
- Frontend only. Server API unchanged. Sidebar cards (`src/components/cards/*`) are out of scope: the shared `TelegramLinkPanel` / `Life360LinkPanel` are only wrapped, not edited.
- Card: `bg-card rounded-3xl p-4`; card title 15px bold, `· count` muted; pane title 22px bold + one muted line; pane stack gap 14px.
- Rows: separate tonal blocks, 2px gap, first row top radius 16, last row bottom radius 16, inner radius 6. One open expandable row per card.
- Pills `rounded-full`: primary = orange, secondary = soft fill, destructive-outline = red ring + red text, destructive = solid red (only inside confirms).
- Switch: M3 look, track 44×26, thumb grows when on, orange track when on.
- Segmented picker: pill group on a soft background, selected segment = card colour + shadow.
- Tooling: bun is not on PATH. Tests `npx --yes bun test`, types `npx tsc -b`, lint `npm run lint` (max 0 warnings). Run all from `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client`.
- Branch `feat/beheer-redesign`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Task 10 (huntable areas card) **depends on the separate huntable-areas plan** (hook `useHuntableAreas()` → `{ allowed: string[] | null | undefined, setAllowed(areas: string[]): Promise<void>, isForbidden(area) }` in `src/hooks/huntable-areas.hook.ts`, and `useHomeTeam()?.area`). Tasks 1–9 don't.

---

## File Structure

**Create**
- `src/hooks/timed-value.hook.ts` — `useTimedValue<T>(ms)`: a value that clears itself (copy ✓, "Link gekopieerd ✓").
- `src/components/beheer/controls/Pill.tsx` — `Pill` (text pill, optional label morph), `IconPill` (34px round icon button), `Tag` (small status/role pill).
- `src/components/beheer/controls/BeheerSwitch.tsx` — M3 switch on the Radix Switch primitive.
- `src/components/beheer/controls/Segmented.tsx` — segmented picker on the Radix ToggleGroup primitive, sliding selected segment.
- `src/components/beheer/WhatsAppLogo.tsx` — WhatsApp glyph (simple-icons) in currentColor.
- `src/lib/koppelingen.ts` + `src/lib/koppelingen.test.ts` — pure status → card view for Telegram / Life360.

**Rewrite**
- `src/components/beheer/BeheerLayout.tsx` — `BeheerPane`, `BeheerCard`, `BeheerRows`, `RowFrame`, `BeheerRow`, `BeheerExpandableRow`, `InlineConfirm`, `BeheerSkeleton`, `FadeSwap`, `CountSwap`, `Chevron` (+ temporary `BeheerGroup` shim, removed in Task 9).
- `src/components/beheer/BeheerDialog.tsx` — N1 nav (desktop + phone).
- `src/components/beheer/AlgemeenPane.tsx`, `UsersPane.tsx`, `InvitesPane.tsx`, `HuntersPane.tsx`, `BroadcastPane.tsx`, `KoppelingenPane.tsx`.

**Modify**
- `src/index.css` — Beheer surface tokens + new-invite ring keyframes.
- `src/components/ResponsiveDialog.tsx` — `drawerClassName` prop; Escape inside an inline editor doesn't close the window.
- `src/lib/beheer.ts` + `src/lib/beheer.test.ts` — user/invite/share/send/huntable helpers.
- `src/lib/hunters.ts` + `src/lib/hunters.test.ts` — meta without battery, summary, icon, low battery.
- `src/lib/marker-style.ts` — export `AREAS` (Task 10).

**Delete**
- `src/components/beheer/RenameUserDialog.tsx`, `src/components/admin/RecoveryLinkDialog.tsx` (Task 5), `src/components/beheer/InviteQrDialog.tsx` (Task 6).

---

### Task 1: Branch, surface tokens and controls (pills, switch, segmented, timed value)

**Files:**
- Modify: `src/index.css` (the `body.dark { --map-warn … }` block, and the `@theme inline` block)
- Create: `src/hooks/timed-value.hook.ts`
- Create: `src/components/beheer/controls/Pill.tsx`
- Create: `src/components/beheer/controls/BeheerSwitch.tsx`
- Create: `src/components/beheer/controls/Segmented.tsx`

**Interfaces:**
- Consumes: `SWAP_TRANSITION`, `POP_SPRING` from `@/lib/motion`; `cn` from `@/lib/utils`.
- Produces:
  - Tailwind colours `bg-beheer-window`, `bg-beheer-row`, `bg-beheer-row-high` (+ any utility using them); animation `animate-beheer-ring`.
  - `useTimedValue<T>(ms: number): [T | null, (value: T) => void, () => void]` from `@/hooks/timed-value.hook`.
  - `Pill(props: HTMLMotionProps<'button'> & { variant?: 'primary' | 'secondary' | 'danger-soft' | 'danger-outline' | 'danger' | 'success' | 'warn' | 'whatsapp'; size?: 'sm' | 'md'; morphKey?: string; children: ReactNode })`, `IconPill(props: ComponentProps<'button'> & { variant?: 'ghost' | 'soft' | 'success' | 'active'; 'aria-label': string })`, `Tag({ tone?: 'primary' | 'neutral' | 'ok' | 'warn'; className?; children })` from `./controls/Pill`.
  - default `BeheerSwitch(props: ComponentProps<typeof SwitchPrimitive.Root>)` from `./controls/BeheerSwitch`.
  - default `Segmented<T extends string>({ value: T | undefined; options: SegmentOption<T>[]; onChange(value: T): void; label: string; disabled?: boolean; className?: string })` and `type SegmentOption<T> = { value: T; label: string; icon?: ReactNode }` from `./controls/Segmented`.

- [ ] **Step 1: Create the branch**

The huntable-areas plan runs first. If its branch is merged into local `main`, branch from `main`; otherwise branch from that branch (only Task 10 needs it).

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
git checkout main
git log --oneline -20 | grep -i -E "huntable|huntbare" || echo "huntable-areas not merged yet"
git checkout -b feat/beheer-redesign
```

If the grep printed "not merged yet" and a `feat/huntable-areas` branch exists, use `git checkout -b feat/beheer-redesign feat/huntable-areas` instead (and merge `main` later as usual).

- [ ] **Step 2: Add the Beheer surface tokens to `src/index.css`**

Insert right after the existing block that ends the map tokens (the `body.dark { --map-warn: #ffb68a; … --map-success-bg: rgb(22 163 74 / 0.2); }` block), before `/* MapLibre popup styling …`:

```css
/* Beheer window: in light mode the window is a step darker than its (white) cards; rows are a tonal step above the
   card (M3 surface containers). Declared on body because the theme's `.dark` class sits on body. */
body {
  --beheer-window: color-mix(in oklab, var(--foreground) 5%, var(--background));
  --beheer-row: color-mix(in oklab, var(--foreground) 4%, var(--card));
  --beheer-row-high: color-mix(in oklab, var(--foreground) 9%, var(--card));
}

body.dark {
  --beheer-window: var(--background);
}
```

In the `@theme inline { … }` block, after the line `  --color-fox-chip: var(--fox-chip);` add:

```css
  --color-beheer-window: var(--beheer-window);
  --color-beheer-row: var(--beheer-row);
  --color-beheer-row-high: var(--beheer-row-high);
```

In the same `@theme inline` block, after the line `  --animate-collapsible-up: collapsible-up 0.2s cubic-bezier(0.2, 0, 0, 1);` add:

```css
  /* Beheer → Invites: a new invite's row pulses an orange ring twice */
  --animate-beheer-ring: beheer-ring 1s ease-out 2;

  @keyframes beheer-ring {
    from {
      box-shadow: 0 0 0 0 color-mix(in oklab, var(--primary) 70%, transparent);
    }
    to {
      box-shadow: 0 0 0 10px color-mix(in oklab, var(--primary) 0%, transparent);
    }
  }
```

- [ ] **Step 3: Create `src/hooks/timed-value.hook.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

/**
 * A value that clears itself `ms` after it was last set, e.g. the id of the invite whose copy button shows a check.
 * Setting it again (also to the same value) restarts the timer.
 * @returns [value or null, set, clear]
 */
export function useTimedValue<T>(ms: number): [T | null, (value: T) => void, () => void] {
  const [state, setState] = useState<{ value: T | null; round: number }>({ value: null, round: 0 });

  useEffect(() => {
    if (state.value === null) return;
    const timeout = setTimeout(() => setState((current) => ({ value: null, round: current.round })), ms);
    return () => clearTimeout(timeout);
  }, [state, ms]);

  const set = useCallback((value: T) => setState((current) => ({ value, round: current.round + 1 })), []);
  const clear = useCallback(() => setState((current) => ({ value: null, round: current.round })), []);
  return [state.value, set, clear];
}
```

- [ ] **Step 4: Create `src/components/beheer/controls/Pill.tsx`**

```tsx
import type { ComponentProps, ReactNode } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';

const pill = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-beheer-row-high text-foreground hover:bg-beheer-row-high/70',
        'danger-soft': 'bg-destructive/15 text-destructive hover:bg-destructive/20 dark:text-red-300',
        'danger-outline':
          'text-destructive shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--destructive)_60%,transparent)] hover:bg-destructive/10 dark:text-red-300',
        danger: 'bg-destructive text-white hover:bg-destructive/90',
        success: 'bg-green-500/20 text-green-700 dark:text-green-300',
        warn: 'bg-amber-700 text-white hover:bg-amber-700/90',
        whatsapp: 'bg-[#25D366]/15 text-[#128C7E] hover:bg-[#25D366]/25 dark:text-[#4ade80]',
      },
      size: {
        sm: 'h-8 px-3 text-[12.5px]',
        md: 'h-9 px-4 text-[13px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'sm' },
  },
);

type PillProps = Omit<HTMLMotionProps<'button'>, 'children'> &
  VariantProps<typeof pill> & {
    children: ReactNode;
    /**
     * Set when the label changes between states (e.g. "Versturen…" → "Verstuurd"): the old label swaps out and the pill
     * eases to its new width. Leave undefined for a pill whose label never changes.
     */
    morphKey?: string;
  };

/** Beheer's text button: a full pill. */
export function Pill({ variant, size, className, children, morphKey, style, type = 'button', ...props }: PillProps) {
  return (
    <motion.button
      type={type}
      layout={morphKey !== undefined}
      // Set as a style so motion corrects the corners while the width animates
      style={{ borderRadius: 999, ...style }}
      className={cn(pill({ variant, size }), className)}
      {...props}
    >
      {morphKey === undefined ? (
        children
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={morphKey}
            layout="position"
            className="inline-flex items-center gap-1.5"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SWAP_TRANSITION}
          >
            {children}
          </motion.span>
        </AnimatePresence>
      )}
    </motion.button>
  );
}

const iconPill = cva(
  "inline-grid size-[34px] shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        ghost: 'text-muted-foreground hover:bg-beheer-row-high hover:text-foreground',
        soft: 'bg-beheer-row-high text-foreground hover:bg-beheer-row-high/70',
        success: 'bg-green-500/20 text-green-700 dark:text-green-300',
        active: 'bg-primary/20 text-orange-700 dark:text-orange-300',
      },
    },
    defaultVariants: { variant: 'ghost' },
  },
);

/** Round 34px icon button; always give it an aria-label. */
export function IconPill({ variant, className, type = 'button', ...props }: ComponentProps<'button'> & VariantProps<typeof iconPill> & { 'aria-label': string }) {
  return <button type={type} className={cn(iconPill({ variant }), className)} {...props} />;
}

const tag = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] leading-4 font-extrabold [&_svg]:size-3', {
  variants: {
    tone: {
      primary: 'bg-primary/20 text-orange-700 dark:text-orange-300',
      neutral: 'bg-beheer-row-high text-muted-foreground',
      ok: 'bg-green-500/15 text-green-700 dark:text-green-300',
      warn: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

/** Small pill next to a name or title: "Admin", "jij", "vol", "Verbonden". */
export function Tag({ tone, className, children }: VariantProps<typeof tag> & { className?: string; children: ReactNode }) {
  return <span className={cn(tag({ tone }), className)}>{children}</span>;
}
```

- [ ] **Step 5: Create `src/components/beheer/controls/BeheerSwitch.tsx`**

```tsx
import type { ComponentProps } from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/**
 * Material 3 switch: a 44×26 track with an outline when off and orange when on; the thumb grows from 12 to 20 px as it
 * slides over. CSS transitions (off for reduced motion).
 */
export default function BeheerSwitch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-[26px] w-11 shrink-0 items-center rounded-full outline-none transition-[background-color,box-shadow] duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-beheer-row data-[state=unchecked]:shadow-[inset_0_0_0_2px_color-mix(in_oklab,var(--muted-foreground)_70%,transparent)]',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-3 translate-x-[7px] rounded-full bg-muted-foreground transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none data-[state=checked]:size-5 data-[state=checked]:translate-x-[21px] data-[state=checked]:bg-white" />
    </SwitchPrimitive.Root>
  );
}
```

- [ ] **Step 6: Create `src/components/beheer/controls/Segmented.tsx`**

```tsx
import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { POP_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T | undefined;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Geldig" */
  label: string;
  disabled?: boolean;
  className?: string;
}

/** Pill group on a soft background; the selected segment is card-coloured with a shadow and slides to a new choice. Wraps on narrow screens. */
export default function Segmented<T extends string>({ value, options, onChange, label, disabled, className }: SegmentedProps<T>) {
  const id = useId();
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value ?? ''}
      // Radix sends '' when the selected segment is tapped again: keep one selected
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      disabled={disabled}
      className={cn('inline-flex max-w-full flex-wrap gap-0.5 rounded-[18px] bg-beheer-row p-[3px]', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <ToggleGroupPrimitive.Item
            key={option.value}
            value={option.value}
            className={cn(
              'relative inline-flex h-[30px] items-center rounded-full px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
              selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {selected && <motion.span layoutId={`${id}-selected`} aria-hidden className="absolute inset-0 rounded-full bg-card shadow-[0_1px_3px_rgb(0_0_0/0.25)]" transition={POP_SPRING} />}
            <span className="relative inline-flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors, no warnings (the new files are not used yet; unused exports are fine).

- [ ] **Step 8: Commit**

```bash
git add src/index.css src/hooks/timed-value.hook.ts src/components/beheer/controls
git commit -m "feat(beheer): surface tokens, pills, M3 switch, segmented picker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: BeheerLayout building blocks (cards, segmented rows, expandable row, inline confirm)

**Files:**
- Rewrite: `src/components/beheer/BeheerLayout.tsx`

**Interfaces:**
- Consumes: `Pill` from `./controls/Pill` (Task 1); `AutoHeight` (`@/components/motion/AutoHeight`, props `scene`, `children`, `className?`), `Reveal` (`@/components/motion/Reveal`, props `children`, `gap?`); `SWAP`, `SWAP_TRANSITION`, `REVEAL_TRANSITION`.
- Produces (all named exports of `./BeheerLayout`):
  - `FadeSwap({ children: ReactNode; className?: string })`
  - `CountSwap({ value: number })`
  - `Chevron({ open: boolean })`
  - `BeheerPane({ title: string; description: ReactNode; action?: ReactNode; children: ReactNode })`
  - `BeheerCard({ title?: string; count?: number; description?: ReactNode; right?: ReactNode; onToggle?: () => void; open?: boolean; className?: string; children?: ReactNode })`
  - `BeheerRows({ children: ReactNode; className?: string })` — wraps children in `<AnimatePresence initial={false}>`; children must be keyed rows.
  - `type RowTone = 'default' | 'open' | 'danger' | 'muted'`
  - `RowFrame({ tone?: RowTone; className?: string; children: ReactNode })` — the folding tonal block (for custom rows like the invite QR).
  - `BeheerRow({ leading?: ReactNode; title: ReactNode; meta?: ReactNode; children?: ReactNode /* trailing */; tone?: RowTone; className?: string })`
  - `BeheerExpandableRow({ id: string; leading?; title; meta?; trailing?: ReactNode; children: ReactNode /* unfolded pills */; indentClassName?: string; headerStatic?: boolean; confirm?: ReactNode; className?: string })`
  - `InlineConfirm({ title: ReactNode; description: ReactNode; confirmLabel: string; confirmIcon?: ReactNode; onCancel: () => void; onConfirm: () => Promise<unknown> | unknown; className?: string })`
  - `BeheerSkeleton({ groups?: number })`
  - `BeheerGroup({ title: string; note?: ReactNode; children: ReactNode })` — **temporary** shim (old panes), removed in Task 9.

- [ ] **Step 1: Replace `src/components/beheer/BeheerLayout.tsx` with**

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDownIcon, Loader2Icon } from 'lucide-react';
import AutoHeight from '@/components/motion/AutoHeight';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/media.hook';
import { REVEAL_TRANSITION, SWAP, SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Pill } from './controls/Pill';

/** Text that fades over when it changes; keyed by the text, so other content (e.g. a skeleton) counts as one state. */
export function FadeSwap({ children, className }: { children: ReactNode; className?: string }) {
  const key = typeof children === 'string' || typeof children === 'number' ? String(children) : 'node';
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={key} className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** A count that rolls to its new value. */
export function CountSwap({ value }: { value: number }) {
  return (
    <span className="relative inline-flex overflow-hidden align-bottom tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: '60%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-60%', opacity: 0 }} transition={SWAP_TRANSITION}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Down chevron that turns over when open. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <motion.span aria-hidden className="inline-grid shrink-0 text-muted-foreground" animate={{ rotate: open ? 180 : 0 }} transition={SWAP_TRANSITION}>
      <ChevronDownIcon className="size-4" />
    </motion.span>
  );
}

/** One Beheer section: 22px title and one muted line (plus an optional action on the right), then its cards 14px apart. */
export function BeheerPane({ title, description, action, children }: { title: string; description: ReactNode; action?: ReactNode; children: ReactNode }) {
  // On phones the back-arrow header above the pane already shows the title
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col">
      <div className="mb-[18px] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={isMobile ? 'sr-only' : 'text-[22px] leading-tight font-bold'}>{title}</h2>
          <FadeSwap className="mt-0.5 text-[13px] text-muted-foreground">{description}</FadeSwap>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

interface BeheerCardProps {
  /** 15px bold; no icon. Leave out for a card that draws its own header (Koppelingen). */
  title?: string;
  /** Shown as "· n" after the title */
  count?: number;
  /** Muted line under the title */
  description?: ReactNode;
  /** Right of the header */
  right?: ReactNode;
  /** Makes the header a toggle (e.g. "Gestopt"): the body folds in/out and a chevron shows */
  onToggle?: () => void;
  open?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Tonal card (bg-card, 24px corners): header row, then the body (rows, chips, a form). */
export function BeheerCard({ title, count, description, right, onToggle, open = false, className, children }: BeheerCardProps) {
  const header =
    title !== undefined ? (
      <>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">
            {title}
            {count !== undefined && (
              <span className="font-semibold text-muted-foreground">
                {' · '}
                <CountSwap value={count} />
              </span>
            )}
          </h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {right}
        {onToggle && <Chevron open={open} />}
      </>
    ) : null;

  return (
    <section className={cn('rounded-3xl bg-card p-4', className)}>
      {header &&
        (onToggle ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            className="flex w-full items-center gap-2.5 rounded-2xl px-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {header}
          </button>
        ) : (
          <div className="mx-1 flex items-center gap-2.5">{header}</div>
        ))}
      {onToggle ? (
        <Reveal>{open && <div className="pt-3">{children}</div>}</Reveal>
      ) : (
        children && <div className={header ? 'mt-3' : undefined}>{children}</div>
      )}
    </section>
  );
}

type RowsState = { openId: string | null; setOpenId: (id: string | null) => void };
const RowsContext = createContext<RowsState | null>(null);

/**
 * A card's rows: separate tonal blocks 2px apart, outer corners 16px and inner 6px (M3 segmented list). Rows fold in
 * and out (children must be keyed rows); at most one BeheerExpandableRow inside is open.
 */
export function BeheerRows({ children, className }: { children: ReactNode; className?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <RowsContext.Provider value={{ openId, setOpenId }}>
      <div className={cn('flex flex-col gap-0.5', className)}>
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </div>
    </RowsContext.Provider>
  );
}

export type RowTone = 'default' | 'open' | 'danger' | 'muted';

const TONE: Record<RowTone, string> = {
  default: 'bg-beheer-row',
  open: 'bg-beheer-row-high',
  danger: 'bg-destructive/12',
  // motion owns the block's opacity (fold in/out), so dim the content instead
  muted: 'bg-beheer-row [&>*]:opacity-60',
};

/**
 * The tonal block every row kind sits in: folds in and away (height + opacity). The padding sits inside, so the height
 * animates to zero without a jump. `className` goes on the block (e.g. the new-invite ring).
 */
export function RowFrame({ tone = 'default', className, children }: { tone?: RowTone; className?: string; children: ReactNode }) {
  return (
    <motion.div
      className={cn('overflow-hidden rounded-md transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl', TONE[tone], className)}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={REVEAL_TRANSITION}
    >
      {children}
    </motion.div>
  );
}

function RowContent({ leading, title, meta, trailing }: { leading?: ReactNode; title: ReactNode; meta?: ReactNode; trailing?: ReactNode }) {
  return (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold">{title}</div>
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
    </>
  );
}

interface BeheerRowProps {
  /** E.g. a muted icon or the hunter marker; no avatar circles */
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Trailing controls (pills, a switch, a tag) */
  children?: ReactNode;
  tone?: RowTone;
  className?: string;
}

/** One row: optional leading element, title, muted meta, trailing controls. Put it in BeheerRows with a key. */
export function BeheerRow({ leading, title, meta, children, tone, className }: BeheerRowProps) {
  return (
    <RowFrame tone={tone} className={className}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <RowContent leading={leading} title={title} meta={meta} trailing={children} />
      </div>
    </RowFrame>
  );
}

interface BeheerExpandableRowProps {
  /** Unique within its BeheerRows (one open row per card) */
  id: string;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Non-interactive extras before the chevron (e.g. the battery) */
  trailing?: ReactNode;
  /** The unfolded part: action pills */
  children: ReactNode;
  /** Full left padding of the unfolded part, lining it up with the text column: 12px row padding + leading width + 12px gap, e.g. "pl-8" */
  indentClassName?: string;
  /** The header isn't a button while true (e.g. while it holds the rename input) */
  headerStatic?: boolean;
  /** Replaces the whole row with this (e.g. an InlineConfirm): the row turns red and the content swaps */
  confirm?: ReactNode;
  className?: string;
}

/** A row that opens on tap (chevron turns); the open part unfolds under the row content and holds action pills. */
export function BeheerExpandableRow({ id, leading, title, meta, trailing, children, indentClassName, headerStatic, confirm, className }: BeheerExpandableRowProps) {
  const rows = useContext(RowsContext);
  const [ownOpen, setOwnOpen] = useState(false);
  const open = rows ? rows.openId === id : ownOpen;
  const toggle = () => (rows ? rows.setOpenId(open ? null : id) : setOwnOpen(!open));
  const headerClass = 'flex w-full items-center gap-3 px-3 py-2.5 text-left';
  const header = (
    <>
      <RowContent leading={leading} title={title} meta={meta} trailing={trailing} />
      <Chevron open={open} />
    </>
  );

  return (
    <RowFrame tone={confirm ? 'danger' : open ? 'open' : 'default'} className={className}>
      <AutoHeight scene={confirm ? 'confirm' : 'row'}>
        <AnimatePresence mode="wait" initial={false}>
          {confirm ? (
            <motion.div key="confirm" className="px-3 py-2.5" {...SWAP}>
              {confirm}
            </motion.div>
          ) : (
            <motion.div key="row" {...SWAP}>
              {headerStatic ? (
                <div className={headerClass}>{header}</div>
              ) : (
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={toggle}
                  className={cn(headerClass, 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset')}
                >
                  {header}
                </button>
              )}
              <Reveal>{open && <div className={cn('flex flex-wrap items-center gap-1.5 px-3 pb-3', indentClassName)}>{children}</div>}</Reveal>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>
    </RowFrame>
  );
}

interface InlineConfirmProps {
  /** Bold question, e.g. "Jesse verwijderen?" */
  title: ReactNode;
  /** Muted consequence line */
  description: ReactNode;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  onCancel: () => void;
  /** Runs on confirm; both pills stay disabled (spinner) until it settles. Handle errors (toast) inside. */
  onConfirm: () => Promise<unknown> | unknown;
  /** E.g. the red box when it sits in a card instead of a row */
  className?: string;
}

/** A red-tinted question in place of a row or a card section: question, consequence, "Annuleer" + a destructive pill. */
export function InlineConfirm({ title, description, confirmLabel, confirmIcon, onCancel, onConfirm, className }: InlineConfirmProps) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alertdialog" aria-label={typeof title === 'string' ? title : undefined} className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-[13.5px] font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Pill variant="secondary" onClick={onCancel} disabled={busy} autoFocus>
          Annuleer
        </Pill>
        <Pill variant="danger" morphKey={busy ? 'busy' : 'idle'} onClick={() => void confirm()} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : confirmIcon}
          {confirmLabel}
        </Pill>
      </div>
    </div>
  );
}

/** Stands in for a pane's cards while their data loads. */
export function BeheerSkeleton({ groups = 1 }: { groups?: number }) {
  return (
    <div className="flex flex-col gap-3.5">
      {Array.from({ length: groups }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-3xl bg-card p-4">
          <Skeleton className="mx-1 h-5 w-28 bg-beheer-row-high" />
          <Skeleton className="h-28 w-full rounded-2xl bg-beheer-row" />
        </div>
      ))}
    </div>
  );
}

/** @deprecated Temporary bridge for panes not yet redesigned; removed once every pane uses BeheerCard + BeheerRows. */
export function BeheerGroup({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <BeheerCard title={title} description={note}>
      <BeheerRows>{children}</BeheerRows>
    </BeheerCard>
  );
}
```

- [ ] **Step 2: Type-check, lint and run the unit tests**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: tsc and lint clean; all existing tests pass (the old panes still compile: `BeheerRow`'s `title`/`meta`/`children`/`className` and `BeheerSkeleton`'s `groups` kept their meaning, `BeheerGroup` is the shim).

- [ ] **Step 3: Commit**

```bash
git add src/components/beheer/BeheerLayout.tsx
git commit -m "feat(beheer): tonal cards, segmented rows, expandable row, inline confirm

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shell N1 (nav desktop + phone) and the dialog frame

**Files:**
- Modify: `src/components/ResponsiveDialog.tsx`
- Rewrite: `src/components/beheer/BeheerDialog.tsx`

**Interfaces:**
- Consumes: `IconPill` (Task 1); `keepOpenWhileEditing(event: KeyboardEvent)` from `@/lib/inline-edit` (prevents Escape from closing the dialog while the focused element has `data-inline-edit`); `SWAP`, `SWAP_TRANSITION`, `EASE_OUT`.
- Produces: `ResponsiveDialog` prop `drawerClassName?: string` (classes on the phone drawer surface). Escape inside an element with `data-inline-edit` no longer closes any `ResponsiveDialog` (Task 5's rename input relies on this).

- [ ] **Step 1: Edit `src/components/ResponsiveDialog.tsx`**

Add the import below the existing imports:

```tsx
import { keepOpenWhileEditing } from '@/lib/inline-edit';
```

In `interface ResponsiveDialogProps`, after `className?: string;` add:

```tsx
  /** Extra classes for the phone drawer surface, e.g. its background */
  drawerClassName?: string;
```

Change the function signature line to:

```tsx
export default function ResponsiveDialog({ open, onClose, title, description, children, className, drawerClassName, hideHeader, compact, onClosed }: ResponsiveDialogProps) {
```

Replace the `<Drawer.Content …>` opening tag with:

```tsx
          <Drawer.Content
            // Escape inside an inline editor cancels the edit instead of closing the drawer
            onEscapeKeyDown={keepOpenWhileEditing}
            className={cn('fixed inset-x-0 bottom-0 z-50 flex flex-col', compact ? 'max-h-[92dvh]' : 'h-[92dvh]', 'rounded-t-2xl border-t bg-background outline-none', drawerClassName)}
          >
```

Replace the `<DialogContent …>` opening tag with:

```tsx
      <DialogContent onEscapeKeyDown={keepOpenWhileEditing} className={cn('flex max-h-[80dvh] flex-col gap-4 sm:max-w-4xl', !compact && 'h-[80dvh]', className)}>
```

- [ ] **Step 2: Replace `src/components/beheer/BeheerDialog.tsx` with**

```tsx
import { useEffect, useState, type ComponentType, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  MapPinIcon,
  MegaphoneIcon,
  MonitorIcon,
  PlugIcon,
  SlidersHorizontalIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import type { MapRef } from '@/components/Map';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useAdmin } from '@/hooks/admin.hook';
import { useDevices } from '@/hooks/devices.hook';
import { useInvites } from '@/hooks/invites.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { EASE_OUT, SWAP, SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useAdminStore, { type AdminDialogId } from '@/stores/admin.store';
import type { User } from '@/types/User';
import AlgemeenPane from './AlgemeenPane';
import BroadcastPane from './BroadcastPane';
import { IconPill } from './controls/Pill';
import HuntersPane from './HuntersPane';
import InvitesPane from './InvitesPane';
import KoppelingenPane from './KoppelingenPane';
import UsersPane from './UsersPane';

interface BeheerDialogProps {
  /** For the Hunters pane's "Toon op kaart" */
  mapRef: RefObject<MapRef | null>;
}

type Icon = ComponentType<{ className?: string }>;

const SECTIONS: { id: AdminDialogId; title: string; icon: Icon }[] = [
  { id: 'algemeen', title: 'Algemeen', icon: SlidersHorizontalIcon },
  { id: 'users', title: 'Gebruikers', icon: UsersIcon },
  { id: 'invites', title: 'Invites', icon: UserPlusIcon },
  { id: 'hunters', title: 'Hunters', icon: MapPinIcon },
  { id: 'broadcast', title: 'Bericht versturen', icon: MegaphoneIcon },
  { id: 'koppelingen', title: 'Koppelingen', icon: PlugIcon },
];

const titleOf = (id: AdminDialogId) => SECTIONS.find((section) => section.id === id)?.title ?? '';

/** Phone: the list slides out one way and the pane in from the other (and back) */
const SLIDE = {
  enter: (direction: number) => ({ opacity: 0, x: 24 * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: -24 * direction }),
};
const SLIDE_TRANSITION = { duration: 0.22, ease: EASE_OUT };

function openHq() {
  window.open('/hq', '_blank', 'noopener');
}

/** Gear menu → Beheer: settings, users, invites, hunters, broadcast and integrations in one window (admins only). */
export default function BeheerDialog({ mapRef }: BeheerDialogProps) {
  const user = useAuthUser<User>();
  const open = useAdminStore((state) => state.dialog !== null);
  const close = useAdminStore((state) => state.close);

  // The store is global: Layout unmounts on /login, and a window left open would pop up again after the next login
  useEffect(() => () => useAdminStore.getState().close(), []);

  if (!user?.admin) return null;
  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      title="Beheer"
      description="Instellingen, gebruikers, invites, hunters en koppelingen."
      hideHeader
      className="h-[640px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[960px] sm:rounded-[20px]"
      drawerClassName="bg-beheer-window"
    >
      <BeheerWindow mapRef={mapRef} />
    </ResponsiveDialog>
  );
}

/** The window's content; only mounted while the window is open (or closing), so the counts are only fetched then. */
function BeheerWindow({ mapRef }: BeheerDialogProps) {
  const isMobile = useIsMobile();
  const dialog = useAdminStore((state) => state.dialog);
  const openDialog = useAdminStore((state) => state.openDialog);

  // Keeps the last section while the window closes (the store is already null then)
  const [section, setSection] = useState<AdminDialogId>(dialog ?? 'algemeen');
  // Phone: the list first, unless the window was opened on a specific section (e.g. the /users route)
  const startView = (opened: AdminDialogId | null) => (opened && opened !== 'algemeen' ? 'pane' : 'list');
  const [phoneView, setPhoneView] = useState<'list' | 'pane'>(startView(dialog));
  const [direction, setDirection] = useState(1);
  if (dialog && dialog !== section) {
    setSection(dialog);
    // Phone: a section opened from elsewhere while the list shows (e.g. the /users route) shows that pane
    if (dialog !== 'algemeen') {
      setDirection(1);
      setPhoneView('pane');
    }
  }
  // Reopened before the close finished (the content stays mounted then): start over like a fresh open
  const open = dialog !== null;
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPhoneView(startView(dialog));
  }

  const counts = useCounts();

  function select(id: AdminDialogId) {
    openDialog(id);
    setDirection(1);
    setPhoneView('pane');
  }

  function back() {
    setDirection(-1);
    setPhoneView('list');
  }

  const pane = <SectionPane section={section} mapRef={mapRef} />;
  const hqTrailing = <ExternalLinkIcon className="size-3.5 shrink-0" />;

  if (isMobile) {
    return (
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {phoneView === 'list' ? (
          <motion.div
            key="list"
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
            custom={direction}
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDE_TRANSITION}
          >
            <div className="px-3 pt-1 pb-3 text-lg font-bold">Beheer</div>
            {SECTIONS.map(({ id, title, icon }) => (
              <NavItem key={id} icon={icon} title={title} count={counts[id]} onClick={() => select(id)} className="h-12 text-foreground" />
            ))}
            <NavItem icon={MonitorIcon} title="HQ-scherm" trailing={hqTrailing} onClick={openHq} className="mt-auto h-12 text-foreground" />
          </motion.div>
        ) : (
          <motion.div
            key="pane"
            className="flex min-h-0 flex-1 flex-col"
            custom={direction}
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDE_TRANSITION}
          >
            <div className="flex items-center gap-2 pb-3">
              <IconPill aria-label="Terug" onClick={back}>
                <ArrowLeftIcon />
              </IconPill>
              <span className="text-lg font-bold">{titleOf(section)}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={section} {...SWAP}>
                  {pane}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr] grid-rows-[minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 px-3 py-[18px]" aria-label="Beheer">
        <div className="px-3 pt-0.5 pb-3.5 text-[17px] font-bold">Beheer</div>
        {SECTIONS.map(({ id, title, icon }) => (
          <NavItem key={id} icon={icon} title={title} count={counts[id]} active={id === section} indicatorId="beheer-nav-active" onClick={() => openDialog(id)} />
        ))}
        <NavItem icon={MonitorIcon} title="HQ-scherm" trailing={hqTrailing} onClick={openHq} className="mt-auto" />
      </nav>
      <div className="min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={section} className="h-full overflow-y-auto px-7 py-6" {...SWAP}>
            {pane}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: Icon;
  title: string;
  count?: number;
  active?: boolean;
  trailing?: ReactNode;
  /** layoutId of the soft fill behind the active item, so it slides to a newly picked item */
  indicatorId?: string;
  onClick: () => void;
  className?: string;
}

/** N1 item: icon + name, 40px, rounded-xl; active = soft grey fill + semibold (no pill, no orange). */
function NavItem({ icon: ItemIcon, title, count, active, trailing, indicatorId, onClick, className }: NavItemProps) {
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
        <ItemIcon className="size-[18px] shrink-0" />
        <span className="truncate">{title}</span>
        <Count value={count} />
        {trailing}
      </span>
    </button>
  );
}

/** Menu counts; undefined (shows nothing) until known. */
function useCounts(): Partial<Record<AdminDialogId, number>> {
  const { users } = useAdmin();
  const { invites } = useInvites(true);
  const { devices } = useDevices();
  return {
    users: users?.length,
    invites: invites?.filter((invite) => invite.state === 'active').length,
    hunters: devices?.length,
  };
}

/** Fades in once the number is known */
function Count({ value }: { value: number | undefined }) {
  return (
    <AnimatePresence initial={false}>
      {value !== undefined && (
        <motion.span
          key="count"
          className="ml-auto text-xs font-normal text-muted-foreground tabular-nums"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {value}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function SectionPane({ section, mapRef }: { section: AdminDialogId; mapRef: RefObject<MapRef | null> }) {
  switch (section) {
    case 'algemeen':
      return <AlgemeenPane />;
    case 'users':
      return <UsersPane />;
    case 'invites':
      return <InvitesPane />;
    case 'hunters':
      return <HuntersPane mapRef={mapRef} />;
    case 'broadcast':
      return <BroadcastPane />;
    case 'koppelingen':
      return <KoppelingenPane />;
  }
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ResponsiveDialog.tsx src/components/beheer/BeheerDialog.tsx
git commit -m "feat(beheer): N1 navigation and window surface

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Algemeen pane (Functies + Gegevens)

**Files:**
- Rewrite: `src/components/beheer/AlgemeenPane.tsx`

**Interfaces:**
- Consumes: `BeheerPane`, `BeheerCard`, `BeheerRows`, `BeheerRow` (Task 2); `BeheerSwitch`, `Pill` (Task 1); existing `usePredictionSetting`, `useDemo`, `useInvitesPaused`, `DemoModeDialog`, `ReloadTeamsDialog`.
- Produces: `AlgemeenPane` (default export). Task 10 adds a first card to it.

- [ ] **Step 1: Replace `src/components/beheer/AlgemeenPane.tsx` with**

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { MonitorPlayIcon, PauseIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import DemoModeDialog from '@/components/settings/DemoModeDialog';
import ReloadTeamsDialog from '@/components/settings/ReloadTeamsDialog';
import { useDemo } from '@/hooks/demo.hook';
import { useInvitesPaused } from '@/hooks/invites.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows } from './BeheerLayout';
import BeheerSwitch from './controls/BeheerSwitch';
import { Pill } from './controls/Pill';

/** Leading icon of a settings row (muted, like the mockup) */
const ROW_ICON = 'size-[18px] shrink-0 text-muted-foreground';

/** Beheer → Algemeen: switches that apply to everyone, and reloading the teams. */
export default function AlgemeenPane() {
  const { enabled: predictionEnabled, setEnabled: setPredictionEnabled } = usePredictionSetting();
  const { demo } = useDemo();
  const { paused, setPaused } = useInvitesPaused();
  const [savingPrediction, setSavingPrediction] = useState(false);
  const [savingPaused, setSavingPaused] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);

  async function handlePrediction(enabled: boolean) {
    setSavingPrediction(true);
    try {
      await setPredictionEnabled(enabled);
    } catch {
      toast.error('AI-voorspelling wisselen is mislukt');
    } finally {
      setSavingPrediction(false);
    }
  }

  async function handlePaused(next: boolean) {
    setSavingPaused(true);
    try {
      await setPaused(next);
      toast.success(next ? 'Invites gepauzeerd' : 'Invites werken weer');
    } catch {
      toast.error('Invites pauzeren is mislukt');
    } finally {
      setSavingPaused(false);
    }
  }

  return (
    <BeheerPane title="Algemeen" description="Instellingen die voor iedereen gelden.">
      <BeheerCard title="Functies">
        <BeheerRows>
          <BeheerRow key="prediction" leading={<SparklesIcon className={ROW_ICON} />} title="AI-voorspelling" meta="Laat Gemini bij elke hint voorspellen waar de vos zit.">
            <BeheerSwitch
              aria-label="AI-voorspelling"
              checked={predictionEnabled !== false}
              disabled={predictionEnabled === undefined || savingPrediction}
              onCheckedChange={(checked) => void handlePrediction(checked)}
            />
          </BeheerRow>
          <BeheerRow key="demo" leading={<MonitorPlayIcon className={ROW_ICON} />} title="Demo mode" meta="Iedereen ziet demo-gegevens. De echte gegevens blijven bewaard.">
            {/* Stays as it is until the confirmation switches demo mode (and reloads the page) */}
            <BeheerSwitch aria-label="Demo mode" checked={!!demo?.enabled} disabled={!demo} onCheckedChange={() => setDemoOpen(true)} />
          </BeheerRow>
          <BeheerRow key="invites-paused" leading={<PauseIcon className={ROW_ICON} />} title="Invites pauzeren" meta="Alle invite-links werken tijdelijk niet.">
            <BeheerSwitch
              aria-label="Invites pauzeren"
              checked={!!paused}
              disabled={paused === undefined || savingPaused}
              onCheckedChange={(checked) => void handlePaused(checked)}
            />
          </BeheerRow>
        </BeheerRows>
      </BeheerCard>

      <BeheerCard title="Gegevens">
        <BeheerRows>
          <BeheerRow key="reload-teams" leading={<RefreshCwIcon className={ROW_ICON} />} title="Teams herladen uit API" meta="Reset alle ingevulde deelgebieden. Kan niet ongedaan worden gemaakt.">
            <Pill variant="danger-soft" onClick={() => setReloadOpen(true)}>
              Herladen
            </Pill>
          </BeheerRow>
        </BeheerRows>
      </BeheerCard>

      <DemoModeDialog open={demoOpen} onOpenChange={setDemoOpen} />
      <ReloadTeamsDialog open={reloadOpen} onOpenChange={setReloadOpen} />
    </BeheerPane>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/beheer/AlgemeenPane.tsx
git commit -m "feat(beheer): Algemeen pane in tonal cards with M3 switches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Gebruikers pane (G3)

**Files:**
- Modify: `src/lib/beheer.ts` (replace `userMeta`)
- Modify: `src/lib/beheer.test.ts`
- Rewrite: `src/components/beheer/UsersPane.tsx`
- Delete: `src/components/beheer/RenameUserDialog.tsx`, `src/components/admin/RecoveryLinkDialog.tsx`

**Interfaces:**
- Consumes: `BeheerCard`, `BeheerRows`, `BeheerExpandableRow`, `InlineConfirm`, `BeheerPane`, `BeheerSkeleton` (Task 2); `Pill`, `Tag` (Task 1); `useTimedValue` (Task 1); `useAdmin()` → `{ users, isError, updateUser(id, changes): Promise<unknown /* null on success */>, deleteUser(id): Promise<unknown>, createRecoveryLink(id): Promise<{ url: string; expiresAt: string }> }`; `writeClipboard`, `copyToClipboard`; `formatClock`; the `data-inline-edit` Escape handling from Task 3.
- Produces (in `@/lib/beheer`): `isActiveNow(user: { lastActiveAt?: string | null }, now: number): boolean`, `userActivity(user, now): string`, `passkeyText(count: number | undefined): string`, `usersSummary(users: { lastActiveAt?: string | null }[], now: number): string`. `userMeta` is removed.

- [ ] **Step 1: Write the failing tests**

In `src/lib/beheer.test.ts`, replace the import block at the top with:

```ts
import { describe, expect, test } from 'bun:test';
import {
  broadcastMeta,
  DEFAULT_EXPIRY,
  DEFAULT_MAX_USES,
  EXPIRY_OPTIONS,
  formatTimeLeft,
  inviteMeta,
  isActiveNow,
  MAX_USES_OPTIONS,
  passkeyText,
  splitUsers,
  userActivity,
  usersSummary,
  type AdminInvite,
} from './beheer';
```

Replace the whole `describe('userMeta', () => { … });` block with:

```ts
describe('users', () => {
  test('passkeyText', () => {
    expect(passkeyText(undefined)).toBe('geen passkey');
    expect(passkeyText(0)).toBe('geen passkey');
    expect(passkeyText(1)).toBe('1 passkey');
    expect(passkeyText(2)).toBe('2 passkeys');
  });

  test('isActiveNow: active in the last 5 minutes', () => {
    expect(isActiveNow({ lastActiveAt: ago(5 * MIN - SEC) }, now)).toBe(true);
    expect(isActiveNow({ lastActiveAt: ago(5 * MIN) }, now)).toBe(false);
    expect(isActiveNow({ lastActiveAt: null }, now)).toBe(false);
    expect(isActiveNow({}, now)).toBe(false);
  });

  test('userActivity: never, now (under 5 min), else time ago', () => {
    expect(userActivity({ lastActiveAt: null }, now)).toBe('nooit actief');
    expect(userActivity({}, now)).toBe('nooit actief');
    expect(userActivity({ lastActiveAt: ago(MIN) }, now)).toBe('nu actief');
    expect(userActivity({ lastActiveAt: ago(5 * MIN) }, now)).toBe('5 min geleden');
    expect(userActivity({ lastActiveAt: ago(3 * DAY) }, now)).toBe('3 dagen geleden');
  });

  test('usersSummary: accounts and how many are active now', () => {
    expect(usersSummary([{ lastActiveAt: ago(MIN) }, { lastActiveAt: ago(HOUR) }, {}], now)).toBe('3 accounts · 1 nu actief');
    expect(usersSummary([{ lastActiveAt: null }], now)).toBe('1 account · 0 nu actief');
    expect(usersSummary([], now)).toBe('0 accounts · 0 nu actief');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx --yes bun test src/lib/beheer.test.ts`
Expected: FAIL — `SyntaxError: Export named 'isActiveNow' not found in module` (or similar for `passkeyText`).

- [ ] **Step 3: Implement the helpers in `src/lib/beheer.ts`**

Replace the whole `userMeta` function (from the `/** "2 passkeys · nu actief", …` comment to its closing brace) with:

```ts
/** Active within the last 5 minutes ("nu actief"). */
export function isActiveNow(user: { lastActiveAt?: string | null }, now: number): boolean {
  return !!user.lastActiveAt && now - Date.parse(user.lastActiveAt) < ACTIVE_NOW_MS;
}

/** "nu actief", "3 dagen geleden", "nooit actief" */
export function userActivity(user: { lastActiveAt?: string | null }, now: number): string {
  if (!user.lastActiveAt) return 'nooit actief';
  return isActiveNow(user, now) ? 'nu actief' : formatAgo(user.lastActiveAt, now);
}

/** "geen passkey" (shown amber), "1 passkey", "2 passkeys" */
export function passkeyText(count: number | undefined): string {
  const n = count ?? 0;
  if (n === 0) return 'geen passkey';
  return n === 1 ? '1 passkey' : `${n} passkeys`;
}

/** Gebruikers header line: "5 accounts · 2 nu actief" ("1 account"). */
export function usersSummary(users: { lastActiveAt?: string | null }[], now: number): string {
  const accounts = users.length === 1 ? '1 account' : `${users.length} accounts`;
  return `${accounts} · ${users.filter((user) => isActiveNow(user, now)).length} nu actief`;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx --yes bun test src/lib/beheer.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Replace `src/components/beheer/UsersPane.tsx` with**

```tsx
import { useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, LinkIcon, Loader2Icon, PencilIcon, ShieldIcon, ShieldOffIcon, Trash2Icon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import Reveal from '@/components/motion/Reveal';
import { useAdmin, type UserChanges } from '@/hooks/admin.hook';
import { useTimedValue } from '@/hooks/timed-value.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { isActiveNow, passkeyText, splitUsers, userActivity, usersSummary } from '@/lib/beheer';
import { copyToClipboard, writeClipboard } from '@/lib/clipboard';
import { formatClock } from '@/lib/format';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { User } from '@/types/User';
import { BeheerCard, BeheerExpandableRow, BeheerPane, BeheerRows, BeheerSkeleton, InlineConfirm } from './BeheerLayout';
import { Pill, Tag } from './controls/Pill';

/** The pane's card gap (gap-3.5), so a card folding away doesn't leave a gap behind */
const CARD_GAP = 14;
/** The rows' "nu actief" / "… geleden" only needs a refresh now and then */
const CLOCK_TICK_MS = 15_000;
/** "Link gekopieerd ✓" stays this long */
const LINK_DONE_MS = 1800;

/** Beheer → Gebruikers (G3): admins and members; tap a row for herstel-link, rename, admin and delete. */
export default function UsersPane() {
  const me = useAuthUser<User>();
  const { users, isError, updateUser, deleteUser, createRecoveryLink } = useAdmin();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [linkDoneId, setLinkDone] = useTimedValue<string>(LINK_DONE_MS);

  const view = users ? 'content' : isError ? 'error' : 'loading';
  const { admins, members } = splitUsers(users ?? []);

  async function toggleAdmin(user: User) {
    const error = await updateUser(user._id, { admin: !user.admin });
    if (error) toast.error(apiErrorMessage(error, 'Opslaan is mislukt.'));
    else toast.success(user.admin ? `${user.name} is geen admin meer` : `${user.name} is nu admin`);
  }

  async function confirmDelete(user: User) {
    const error = await deleteUser(user._id);
    // On failure the confirm stays, so trying again is one tap; on success the row folds away with it
    if (error) {
      toast.error(apiErrorMessage(error, 'De gebruiker kon niet worden verwijderd.'));
      return;
    }
    toast.success(`${user.name} verwijderd`);
  }

  /** A fresh one-time herstel-link, straight to the clipboard (the pill confirms). */
  async function recoveryLink(user: User) {
    if (linkBusyId) return;
    setLinkBusyId(user._id);
    try {
      const link = await createRecoveryLink(user._id);
      const description = `Geldig tot ${formatClock(link.expiresAt)}, werkt één keer.`;
      if (await writeClipboard(link.url)) {
        setLinkDone(user._id);
        toast.success(`Herstel-link voor ${user.name} gekopieerd`, { description });
      } else {
        // iOS Safari refuses clipboard writes this long after the tap: offer a copy button (a fresh tap)
        toast.success(`Herstel-link voor ${user.name} gemaakt`, {
          description,
          action: { label: 'Kopieer link', onClick: () => void copyToClipboard(link.url, 'Link gekopieerd') },
        });
      }
    } catch (failure) {
      toast.error(apiErrorMessage(failure, 'Herstel-link maken is mislukt, probeer het opnieuw.'));
    } finally {
      setLinkBusyId(null);
    }
  }

  function row(user: User) {
    const isMe = user._id === me?._id;
    const renaming = renamingId === user._id;
    const linkBusy = linkBusyId === user._id;
    const linkDone = linkDoneId === user._id;
    return (
      <BeheerExpandableRow
        key={user._id}
        id={user._id}
        // 12px padding + 8px dot + 12px gap
        indentClassName="pl-8"
        headerStatic={renaming}
        leading={
          <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-full transition-colors duration-300', isActiveNow(user, now) ? 'bg-green-500 shadow-[0_0_0_3px_rgb(34_197_94/0.18)]' : 'bg-muted-foreground/50')}
          />
        }
        title={
          <>
            {renaming ? <NameInput user={user} updateUser={updateUser} onDone={() => setRenamingId(null)} /> : <span className="truncate">{user.name}</span>}
            {user.admin && <Tag tone="primary">Admin</Tag>}
            {isMe && <Tag>jij</Tag>}
          </>
        }
        meta={
          <>
            <span className={cn(!user.passkeyCount && 'text-amber-600 dark:text-amber-400')}>{passkeyText(user.passkeyCount)}</span> · {userActivity(user, now)}
          </>
        }
        confirm={
          deletingId === user._id && (
            <InlineConfirm
              title={`${user.name} verwijderen?`}
              description="Account en alle sessies worden verwijderd."
              confirmLabel="Verwijder"
              confirmIcon={<Trash2Icon />}
              onCancel={() => setDeletingId(null)}
              onConfirm={() => confirmDelete(user)}
            />
          )
        }
      >
        <Pill morphKey={linkDone ? 'done' : linkBusy ? 'busy' : 'idle'} variant={linkDone ? 'success' : 'secondary'} disabled={linkBusy} onClick={() => void recoveryLink(user)}>
          {linkDone ? (
            <>
              <CheckIcon />
              Link gekopieerd
            </>
          ) : linkBusy ? (
            <>
              <Loader2Icon className="animate-spin" />
              Link maken…
            </>
          ) : (
            <>
              <LinkIcon />
              Herstel-link
            </>
          )}
        </Pill>
        <Pill disabled={renaming} onClick={() => setRenamingId(user._id)}>
          <PencilIcon />
          Naam wijzigen
        </Pill>
        {!isMe && (
          <>
            <Pill onClick={() => void toggleAdmin(user)}>
              {user.admin ? <ShieldOffIcon /> : <ShieldIcon />}
              {user.admin ? 'Geen admin meer' : 'Admin maken'}
            </Pill>
            <Pill variant="danger-outline" onClick={() => setDeletingId(user._id)}>
              <Trash2Icon />
              Verwijderen
            </Pill>
          </>
        )}
      </BeheerExpandableRow>
    );
  }

  return (
    <BeheerPane title="Gebruikers" description={view === 'content' ? usersSummary(users ?? [], now) : view === 'loading' ? 'Laden…' : 'Nieuwe mensen komen binnen via een invite.'}>
      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton groups={2} />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.p key="error" className="text-sm text-muted-foreground" {...SWAP}>
            Kan de gebruikers niet laden.
          </motion.p>
        )}
        {view === 'content' && (
          <motion.div key="content" className="flex flex-col gap-3.5" {...SWAP}>
            {/* A role change folds the row out of one card and into the other */}
            <Reveal gap={CARD_GAP}>
              {admins.length > 0 && (
                <BeheerCard title="Admins" count={admins.length}>
                  <BeheerRows>{admins.map(row)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
            <Reveal gap={CARD_GAP}>
              {members.length > 0 && (
                <BeheerCard title="Leden" count={members.length}>
                  <BeheerRows>{members.map(row)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>
    </BeheerPane>
  );
}

/** The name in the row while renaming: Enter or leaving the field saves, Escape cancels (the window stays open). */
function NameInput({ user, onDone, updateUser }: { user: User; onDone: () => void; updateUser: (id: string, changes: UserChanges) => Promise<unknown> }) {
  const [value, setValue] = useState(user.name);
  const [saving, setSaving] = useState(false);
  // Escape unmounts the field; a blur that may follow must not save
  const cancelled = useRef(false);

  async function save() {
    if (saving || cancelled.current) return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === user.name) {
      onDone();
      return;
    }
    setSaving(true);
    const failure = await updateUser(user._id, { name: trimmed });
    setSaving(false);
    if (failure) {
      toast.error(apiErrorMessage(failure, 'De naam kon niet worden opgeslagen.'));
      return;
    }
    toast.success('Naam opgeslagen');
    onDone();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelled.current = true;
      onDone();
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        data-inline-edit
        maxLength={40}
        value={value}
        disabled={saving}
        aria-label={`Nieuwe naam voor ${user.name}`}
        autoComplete="off"
        data-1p-ignore
        onFocus={(event) => event.target.select()}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void save()}
        className="h-7 w-40 rounded-lg border-[1.5px] border-primary bg-card px-2 text-[13.5px] font-semibold outline-none disabled:opacity-60"
      />
      {saving && <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />}
    </span>
  );
}
```

- [ ] **Step 6: Delete the replaced dialogs**

```bash
git rm src/components/beheer/RenameUserDialog.tsx src/components/admin/RecoveryLinkDialog.tsx
grep -rn "RenameUserDialog\|RecoveryLinkDialog\|userMeta" src || echo "no references left"
```

Expected: `no references left`.

- [ ] **Step 7: Type-check, lint, test**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: clean, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/beheer.ts src/lib/beheer.test.ts src/components/beheer/UsersPane.tsx
git commit -m "feat(beheer): Gebruikers as expandable rows with inline rename and confirm

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Invites pane (I5, no Telegram button)

**Files:**
- Modify: `src/lib/beheer.ts`, `src/lib/beheer.test.ts`
- Create: `src/components/beheer/WhatsAppLogo.tsx`
- Rewrite: `src/components/beheer/InvitesPane.tsx`
- Delete: `src/components/beheer/InviteQrDialog.tsx`

**Interfaces:**
- Consumes: `BeheerCard` (with `onToggle`/`open`), `BeheerRows`, `BeheerRow`, `RowFrame`, `BeheerPane`, `BeheerSkeleton` (Task 2); `Pill`, `IconPill`, `Tag`, `Segmented`, `useTimedValue` (Task 1); `useInvites(true)` → `{ invites, error, create(expiry, maxUses): Promise<AdminInvite>, revoke(id): Promise<void> }`; `TrackerQrCode({ value, size?, label? })`; `ConfirmDialog`; the `animate-beheer-ring` animation (Task 1).
- Produces (in `@/lib/beheer`): `inviteUses(invite: AdminInvite): string`, `inviteStateText(state: 'expired' | 'revoked' | 'full'): string`, `stoppedInviteMeta(invite: AdminInvite): string`, `whatsAppShareUrl(text: string): string`, `inviteShareText(url: string): string`. `inviteMeta` keeps its output.

- [ ] **Step 1: Write the failing tests**

In `src/lib/beheer.test.ts`, extend the import list with `inviteShareText, inviteStateText, inviteUses, stoppedInviteMeta, whatsAppShareUrl,` so the block reads:

```ts
import {
  broadcastMeta,
  DEFAULT_EXPIRY,
  DEFAULT_MAX_USES,
  EXPIRY_OPTIONS,
  formatTimeLeft,
  inviteMeta,
  inviteShareText,
  inviteStateText,
  inviteUses,
  isActiveNow,
  MAX_USES_OPTIONS,
  passkeyText,
  splitUsers,
  stoppedInviteMeta,
  userActivity,
  usersSummary,
  whatsAppShareUrl,
  type AdminInvite,
} from './beheer';
```

Append at the end of the file:

```ts
describe('invite rows and sharing', () => {
  test('inviteUses', () => {
    expect(inviteUses(invite({ maxUses: 1, uses: 0 }))).toBe('Eenmalig');
    expect(inviteUses(invite({ maxUses: 1, uses: 1 }))).toBe('Gebruikt');
    expect(inviteUses(invite({ maxUses: 25, uses: 7 }))).toBe('7 van 25 gebruikt');
    expect(inviteUses(invite({ maxUses: null, uses: 3 }))).toBe('3 gebruikt');
  });

  test('inviteStateText', () => {
    expect(inviteStateText('expired')).toBe('verlopen');
    expect(inviteStateText('revoked')).toBe('ingetrokken');
    expect(inviteStateText('full')).toBe('vol');
  });

  test('stoppedInviteMeta leaves the state out (it shows as a pill)', () => {
    expect(stoppedInviteMeta(invite({ state: 'full', maxUses: 3, uses: 3 }))).toBe('3 van 3 gebruikt · Silke');
    expect(stoppedInviteMeta(invite({ state: 'revoked', createdBy: null, maxUses: null, uses: 2 }))).toBe('2 gebruikt');
  });

  test('whatsAppShareUrl encodes the whole message', () => {
    expect(whatsAppShareUrl('Hoi & welkom: https://x.test/invite/AB?c=1')).toBe('https://wa.me/?text=Hoi%20%26%20welkom%3A%20https%3A%2F%2Fx.test%2Finvite%2FAB%3Fc%3D1');
  });

  test('inviteShareText ends with the link', () => {
    expect(inviteShareText('https://example.test/invite/ABCD2345')).toBe('Maak met deze link een account voor onze Jotihunt-app: https://example.test/invite/ABCD2345');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx --yes bun test src/lib/beheer.test.ts`
Expected: FAIL — `Export named 'inviteShareText' not found` (or another of the new names).

- [ ] **Step 3: Implement in `src/lib/beheer.ts`**

Replace the `inviteMeta` function (keep `STOPPED_TEXT` above it) with:

```ts
/** "7 van 25 gebruikt", "Eenmalig", "Gebruikt", "3 gebruikt" */
export function inviteUses(invite: AdminInvite): string {
  if (invite.maxUses === 1) return invite.uses >= 1 ? 'Gebruikt' : 'Eenmalig';
  if (invite.maxUses !== null) return `${invite.uses} van ${invite.maxUses} gebruikt`;
  return `${invite.uses} gebruikt`;
}

/** "verlopen", "ingetrokken", "vol" */
export function inviteStateText(state: Exclude<AdminInvite['state'], 'active'>): string {
  return STOPPED_TEXT[state];
}

/** "7 van 25 gebruikt · nog 6 uur · Silke", "Eenmalig · nog 52 min · Silke", "3 van 3 gebruikt · vol · Silke" */
export function inviteMeta(invite: AdminInvite, now: number): string {
  let time: string;
  if (invite.state !== 'active') time = STOPPED_TEXT[invite.state];
  else if (invite.expiresAt === null) time = 'verloopt nooit';
  else time = formatTimeLeft(invite.expiresAt, now);

  return [inviteUses(invite), time, invite.createdBy?.name].filter(Boolean).join(' · ');
}

/** Gestopt row: "3 van 3 gebruikt · Silke" (the state shows as a pill). */
export function stoppedInviteMeta(invite: AdminInvite): string {
  return [inviteUses(invite), invite.createdBy?.name].filter(Boolean).join(' · ');
}

/** wa.me share link: WhatsApp opens with `text` ready to send to a chat of choice. */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** The WhatsApp message for an invite link. */
export function inviteShareText(url: string): string {
  return `Maak met deze link een account voor onze Jotihunt-app: ${url}`;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx --yes bun test src/lib/beheer.test.ts`
Expected: PASS (the existing `inviteMeta` tests too).

- [ ] **Step 5: Create `src/components/beheer/WhatsAppLogo.tsx`**

```tsx
/** WhatsApp logo (simple-icons), in currentColor. */
export default function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}
```

- [ ] **Step 6: Replace `src/components/beheer/InvitesPane.tsx` with**

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, CopyIcon, Loader2Icon, PlusIcon, QrCodeIcon, SquareIcon } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import Reveal from '@/components/motion/Reveal';
import TrackerQrCode from '@/components/tracker/TrackerQrCode';
import { useInvites } from '@/hooks/invites.hook';
import { useTimedValue } from '@/hooks/timed-value.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { apiErrorMessage } from '@/lib/api-error';
import {
  DEFAULT_EXPIRY,
  DEFAULT_MAX_USES,
  EXPIRY_OPTIONS,
  inviteMeta,
  inviteShareText,
  inviteStateText,
  MAX_USES_OPTIONS,
  stoppedInviteMeta,
  whatsAppShareUrl,
  type AdminInvite,
  type InviteExpiry,
} from '@/lib/beheer';
import { copyToClipboard, writeClipboard } from '@/lib/clipboard';
import { POP, SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows, BeheerSkeleton, RowFrame } from './BeheerLayout';
import { IconPill, Pill, Tag } from './controls/Pill';
import Segmented, { type SegmentOption } from './controls/Segmented';
import WhatsAppLogo from './WhatsAppLogo';

/** The pane's card gap (gap-3.5), so a card folding away doesn't leave a gap behind */
const CARD_GAP = 14;
/** A new invite's row pulses (2 × 1 s) once it shows up */
const HIGHLIGHT_MS = 2000;
/** The rows' "nog …" only needs a refresh now and then */
const CLOCK_TICK_MS = 15_000;
/** The copy button shows its check this long */
const COPIED_MS = 1500;
/** The segmented picker works with strings, so "Onbeperkt" travels as this value */
const UNLIMITED = 'onbeperkt';

const usesToValue = (value: number | null) => (value === null ? UNLIMITED : String(value));
const valueToUses = (value: string) => (value === UNLIMITED ? null : Number(value));
const newestFirst = (a: AdminInvite, b: AdminInvite) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

const EXPIRY_SEGMENTS: SegmentOption<InviteExpiry>[] = EXPIRY_OPTIONS.map(({ value, label }) => ({ value, label }));
const USES_SEGMENTS: SegmentOption<string>[] = MAX_USES_OPTIONS.map(({ value, label }) => ({ value: usesToValue(value), label }));

/** A label + control line of the "Nieuwe invite" card (stacked on phones). */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-[13px] font-semibold sm:w-24 sm:shrink-0">{label}</span>
      {children}
    </div>
  );
}

/** Beheer → Invites (I5): make invite links; share (WhatsApp), copy, QR or stop the active ones; the stopped ones of the last 24 h. */
export default function InvitesPane() {
  const { invites, error: loadError, create, revoke } = useInvites(true);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

  const [expiry, setExpiry] = useState<InviteExpiry>(DEFAULT_EXPIRY);
  const [maxUses, setMaxUses] = useState<number | null>(DEFAULT_MAX_USES);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [copiedId, setCopied] = useTimedValue<string>(COPIED_MS);
  const [showStopped, setShowStopped] = useState(false);
  // The confirm dialog keeps its invite while it fades out
  const [revoking, setRevoking] = useState<AdminInvite | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const view = invites ? 'content' : loadError ? 'error' : 'loading';
  const active = (invites ?? []).filter((invite) => invite.state === 'active').sort(newestFirst);
  const stopped = (invites ?? []).filter((invite) => invite.state !== 'active').sort(newestFirst);

  // The pulse starts once the new row is on screen (it arrives with the list refresh after creating)
  const highlightShown = highlightId !== null && active.some((invite) => invite._id === highlightId);
  useEffect(() => {
    if (!highlightShown) return;
    const timeout = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timeout);
  }, [highlightShown]);

  async function submitCreate() {
    if (busy) return;
    setBusy(true);
    setCreateError(null);
    try {
      const invite = await create(expiry, maxUses);
      setHighlightId(invite._id);
      // One toast: iOS Safari refuses clipboard writes this long after the tap, so then offer a copy button (a fresh tap)
      if (await writeClipboard(invite.url)) toast.success('Invite gemaakt', { description: 'De link staat op je klembord.' });
      else toast.success('Invite gemaakt', { action: { label: 'Kopieer link', onClick: () => void copyToClipboard(invite.url, 'Link gekopieerd') } });
    } catch (failure) {
      setCreateError(apiErrorMessage(failure, 'Invite maken is mislukt.'));
    } finally {
      setBusy(false);
    }
  }

  async function copy(invite: AdminInvite) {
    if (await copyToClipboard(invite.url, 'Link gekopieerd')) setCopied(invite._id);
  }

  async function confirmRevoke() {
    if (!revoking) return;
    try {
      await revoke(revoking._id);
      setRevokeOpen(false);
      toast.success('Invite ingetrokken');
    } catch (failure) {
      toast.error(apiErrorMessage(failure, 'Intrekken is mislukt.'));
    }
  }

  const activeRow = (invite: AdminInvite) => {
    const copied = copiedId === invite._id;
    const qrOpen = qrId === invite._id;
    return (
      <BeheerRow
        key={invite._id}
        title={<span className="font-mono">{invite.code}</span>}
        meta={inviteMeta(invite, now)}
        className={cn(invite._id === highlightId && 'relative z-10 motion-safe:animate-beheer-ring')}
      >
        <Pill variant="whatsapp" aria-label={`Invite ${invite.code} delen via WhatsApp`} onClick={() => window.open(whatsAppShareUrl(inviteShareText(invite.url)), '_blank', 'noopener')}>
          <WhatsAppLogo className="size-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Pill>
        <IconPill variant={copied ? 'success' : 'soft'} aria-label={copied ? 'Link gekopieerd' : `Link van invite ${invite.code} kopiëren`} onClick={() => void copy(invite)}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={copied ? 'check' : 'copy'} className="inline-grid" {...POP}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </motion.span>
          </AnimatePresence>
        </IconPill>
        <IconPill variant={qrOpen ? 'active' : 'soft'} aria-expanded={qrOpen} aria-label={`QR-code van invite ${invite.code}`} onClick={() => setQrId(qrOpen ? null : invite._id)}>
          <QrCodeIcon />
        </IconPill>
        <IconPill
          aria-label={`Invite ${invite.code} stoppen`}
          onClick={() => {
            setRevoking(invite);
            setRevokeOpen(true);
          }}
        >
          <SquareIcon />
        </IconPill>
      </BeheerRow>
    );
  };

  /** The invite's QR code, unfolded as its own block under the row */
  const qrRow = (invite: AdminInvite) => (
    <RowFrame key={`${invite._id}-qr`}>
      <div className="flex flex-col items-center gap-2 px-3 py-4">
        <TrackerQrCode value={invite.url} size={160} label={`QR-code van invite ${invite.code}`} />
        <p className="text-center text-xs text-muted-foreground">Laat iemand deze code scannen om een account te maken.</p>
      </div>
    </RowFrame>
  );

  const stoppedRow = (invite: AdminInvite) => (
    <BeheerRow
      key={invite._id}
      tone="muted"
      title={<span className="font-mono text-muted-foreground line-through decoration-muted-foreground">{invite.code}</span>}
      meta={stoppedInviteMeta(invite)}
    >
      {invite.state !== 'active' && <Tag>{inviteStateText(invite.state)}</Tag>}
    </BeheerRow>
  );

  return (
    <BeheerPane title="Invites" description="Iedereen met een link kan een account maken.">
      <BeheerCard title="Nieuwe invite" description="Iedereen met de link kan een account maken.">
        <div className="flex flex-col gap-2.5 px-1">
          <Field label="Geldig">
            <Segmented label="Geldig" value={expiry} options={EXPIRY_SEGMENTS} onChange={setExpiry} disabled={busy} />
          </Field>
          <Field label="Aantal keer">
            <Segmented label="Aantal keer" value={usesToValue(maxUses)} options={USES_SEGMENTS} onChange={(value) => setMaxUses(valueToUses(value))} disabled={busy} />
          </Field>
          <Reveal gap={10}>
            {createError && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {createError}
              </p>
            )}
          </Reveal>
          <div className="flex justify-end">
            <Pill variant="primary" size="md" morphKey={busy ? 'busy' : 'idle'} disabled={busy} onClick={() => void submitCreate()}>
              {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              Invite maken
            </Pill>
          </div>
        </div>
      </BeheerCard>

      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.p key="error" className="text-sm text-muted-foreground" {...SWAP}>
            Kan de invites niet laden.
          </motion.p>
        )}
        {view === 'content' && (
          <motion.div key="content" className="flex flex-col gap-3.5" {...SWAP}>
            <BeheerCard title="Actief" count={active.length}>
              <BeheerRows>
                {active.flatMap((invite) => (qrId === invite._id ? [activeRow(invite), qrRow(invite)] : [activeRow(invite)]))}
                {active.length === 0 && <BeheerRow key="empty" title={<span className="font-normal text-muted-foreground">Geen actieve invites.</span>} />}
              </BeheerRows>
            </BeheerCard>
            <Reveal gap={CARD_GAP}>
              {stopped.length > 0 && (
                <BeheerCard title="Gestopt" count={stopped.length} open={showStopped} onToggle={() => setShowStopped((open) => !open)}>
                  <BeheerRows>{stopped.map(stoppedRow)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={`Invite ${revoking?.code} intrekken?`}
        description="De link werkt daarna niet meer. Accounts die er al mee gemaakt zijn blijven bestaan."
        confirmLabel="Intrekken"
        destructive
        onConfirm={confirmRevoke}
      />
    </BeheerPane>
  );
}
```

- [ ] **Step 7: Delete the QR dialog**

```bash
git rm src/components/beheer/InviteQrDialog.tsx
grep -rn "InviteQrDialog" src || echo "no references left"
```

Expected: `no references left`.

- [ ] **Step 8: Type-check, lint, test**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: clean, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/beheer.ts src/lib/beheer.test.ts src/components/beheer/WhatsAppLogo.tsx src/components/beheer/InvitesPane.tsx
git commit -m "feat(beheer): Invites with segmented composer, WhatsApp share, copy check and inline QR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hunters pane (H1)

**Files:**
- Modify: `src/lib/hunters.ts`, `src/lib/hunters.test.ts`
- Rewrite: `src/components/beheer/HuntersPane.tsx`

**Interfaces:**
- Consumes: `BeheerCard`, `BeheerRows`, `BeheerExpandableRow`, `BeheerPane`, `BeheerSkeleton` (Task 2); `Pill`, `Segmented`, `SegmentOption` (Task 1); `useMarkerPalette()` from `@/components/layers/marker-icons` (→ `MarkerPalette` with `secondaryContainer`, `onSecondaryContainer`, `surfaceContainerHighest`, `onSurfaceVariant`); `MarkerGlyph({ name: GlyphName; className? })` from `@/components/map/popup/MarkerGlyph`; `vehicleGlyph(icon: HunterIcon): GlyphName`, `type HunterIcon` from `@/lib/marker-style`; `useAdmin().setDeviceVehicle(deviceId: number, vehicle: Vehicle): Promise<void>`.
- Produces (in `@/lib/hunters`): `hunterMeta(row, now)` now **without** battery; `huntersSummary(rows: HunterRow[]): string`; `hunterIcon(row: HunterRow): HunterIcon`; `isLowBattery(percent: number | undefined): boolean`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/hunters.test.ts`, change the import from `./hunters` to:

```ts
import { googleMapsUrl, hunterIcon, hunterMeta, hunterRows, huntersSummary, isLowBattery, vehicleForGroupId, vehicleGroupIdsFromEnv } from './hunters';
```

Replace the whole existing `test('hunterMeta: user (when named differently), vehicle, update, battery, speed only while live; unknowns left out', () => { … });` block (inside `describe('hunterRows', …)`) with:

```ts
  test('hunterMeta: user (when named differently), vehicle, update, speed only while live; no battery (shown apart); unknowns left out', () => {
    const [live, stale, never] = hunterRows(devices, positions, users, groups, NOW);
    expect(hunterMeta(live, NOW)).toBe('Merida · Auto · 2 min geleden · 19 km/u');
    expect(hunterMeta(stale, NOW)).toBe('Fiets · 10 min geleden');
    expect(hunterMeta(never, NOW)).toBe('Lopend');
    const named = hunterRows([device(2, '2026-10-17T11:58:00Z', 3)], positions, [{ ...users[0], name: 'Toestel 2' }], groups, NOW);
    expect(hunterMeta(named[0], NOW)).toBe('Auto · 2 min geleden · 19 km/u');
  });

  test('huntersSummary counts live and not live', () => {
    expect(huntersSummary(hunterRows(devices, positions, users, groups, NOW))).toBe('1 live · 2 niet live');
    expect(huntersSummary([])).toBe('0 live · 0 niet live');
  });

  test('hunterIcon: the vehicle, else a phone', () => {
    const [live] = hunterRows(devices, positions, users, groups, NOW);
    expect(hunterIcon(live)).toBe('car');
    const [plain] = hunterRows([device(4, null, 99)], undefined, undefined, groups, NOW);
    expect(hunterIcon(plain)).toBe('phone');
  });
```

Append at the end of the file:

```ts
test('isLowBattery: under 20 %', () => {
  expect(isLowBattery(19)).toBe(true);
  expect(isLowBattery(20)).toBe(false);
  expect(isLowBattery(undefined)).toBe(false);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx --yes bun test src/lib/hunters.test.ts`
Expected: FAIL — `Export named 'hunterIcon' not found` (or the hunterMeta expectation mismatch "… · 64% · 19 km/u").

- [ ] **Step 3: Implement in `src/lib/hunters.ts`**

Replace the two import lines

```ts
import { joinParts } from '@/lib/format';
import { formatBattery, formatLastUpdate, formatSpeed, isActive, VEHICLE_OPTIONS } from '@/lib/tracker';
```

with

```ts
import { joinParts } from '@/lib/format';
import type { HunterIcon } from '@/lib/marker-style';
import { formatLastUpdate, formatSpeed, isActive, VEHICLE_OPTIONS } from '@/lib/tracker';
```

Replace the `hunterMeta` function and its doc comment with:

```ts
/**
 * Beheer → Hunters meta line, e.g. "Jesse · Lopend · zojuist · 5 km/u": the linked user (when named differently from
 * the device), vehicle, last update and, while live, speed. The battery shows apart on the right. Unknown parts are left out.
 */
export function hunterMeta(row: HunterRow, now: number): string {
  const vehicle = VEHICLE_OPTIONS.find((option) => option.value === row.vehicle)?.label;
  return joinParts(
    row.user && row.user.name !== row.device.name ? row.user.name : undefined,
    vehicle,
    known(formatLastUpdate(row.lastUpdate, now)),
    row.active ? known(formatSpeed(row.speedKmh)) : undefined,
  );
}

/** Hunters header line: "3 live · 1 niet live" */
export function huntersSummary(rows: HunterRow[]): string {
  const live = rows.filter((row) => row.active).length;
  return `${live} live · ${rows.length - live} niet live`;
}

/** The map marker's icon for a hunter: its vehicle, or a phone when the device's group isn't a vehicle. */
export function hunterIcon(row: HunterRow): HunterIcon {
  return row.vehicle ?? 'phone';
}

/** Under 20 %: the battery shows red. */
export function isLowBattery(percent: number | undefined): boolean {
  return percent !== undefined && percent < 20;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx --yes bun test src/lib/hunters.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace `src/components/beheer/HuntersPane.tsx` with**

```tsx
import { useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { ExternalLinkIcon, LocateFixedIcon } from 'lucide-react';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import type { MapRef } from '@/components/Map';
import MarkerGlyph from '@/components/map/popup/MarkerGlyph';
import Reveal from '@/components/motion/Reveal';
import { useAdmin } from '@/hooks/admin.hook';
import { useDevices } from '@/hooks/devices.hook';
import { useIsMobile } from '@/hooks/media.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { googleMapsUrl, hunterIcon, hunterMeta, hunterRows, huntersSummary, isLowBattery, vehicleGroupIdsFromEnv, type HunterRow } from '@/lib/hunters';
import { vehicleGlyph } from '@/lib/marker-style';
import { SWAP } from '@/lib/motion';
import { formatBattery, VEHICLE_OPTIONS } from '@/lib/tracker';
import { cn } from '@/lib/utils';
import useAdminStore from '@/stores/admin.store';
import useSidebarStore from '@/stores/sidebar.store';
import type { Vehicle } from '@/types/Tracker';
import { BeheerCard, BeheerExpandableRow, BeheerPane, BeheerRows, BeheerSkeleton } from './BeheerLayout';
import { Pill } from './controls/Pill';
import Segmented, { type SegmentOption } from './controls/Segmented';

const GROUPS = vehicleGroupIdsFromEnv(import.meta.env);
const CLOCK_TICK_MS = 15_000;
/** The pane's card gap (gap-3.5), so a card folding away doesn't leave a gap behind */
const CARD_GAP = 14;

const VEHICLE_SEGMENTS: SegmentOption<Vehicle>[] = VEHICLE_OPTIONS.map(({ value, label }) => ({
  value,
  label,
  icon: <MarkerGlyph name={vehicleGlyph(value)} />,
}));

type ShowOnMap = (lng: number, lat: number) => void;

/** The map's hunter marker look: the vehicle glyph in the secondary-container circle; grey and dimmed when not live. */
function HunterMarker({ row }: { row: HunterRow }) {
  const palette = useMarkerPalette();
  return (
    <span
      aria-hidden
      className={cn('grid size-9 shrink-0 place-items-center rounded-full transition-opacity duration-300 [&_svg]:size-[19px]', !row.active && 'opacity-60')}
      style={{
        background: row.active ? palette.secondaryContainer : palette.surfaceContainerHighest,
        color: row.active ? palette.onSecondaryContainer : palette.onSurfaceVariant,
      }}
    >
      <MarkerGlyph name={vehicleGlyph(hunterIcon(row))} />
    </span>
  );
}

/** Battery glyph + percentage; red under 20 %. Nothing when unknown. */
function Battery({ percent }: { percent: number | undefined }) {
  if (percent === undefined) return null;
  return (
    <span title="Batterij" className={cn('inline-flex items-center gap-1.5 text-xs font-bold tabular-nums transition-colors', isLowBattery(percent) ? 'text-destructive dark:text-red-300' : 'text-foreground/80')}>
      <span aria-hidden className="relative inline-block h-[11px] w-[22px] rounded-[3px] shadow-[inset_0_0_0_1.5px_currentColor]">
        <span className="absolute inset-y-[2px] left-[2px] rounded-[1px] bg-current transition-[width] duration-300" style={{ width: Math.max(2, (18 * percent) / 100) }} />
      </span>
      {formatBattery(percent)}
    </span>
  );
}

/** Beheer → Hunters (H1): every Traccar device, live ones first; tap for Toon op kaart, Google Maps and the vehicle. */
export default function HuntersPane({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();
  const { devices, positions, isLoading, isError } = useDevices();
  const { users } = useAdmin();
  const close = useAdminStore((state) => state.close);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

  // A failed poll keeps the last list on screen; only show the error when there's nothing to show
  const view = isLoading ? 'loading' : isError && !devices?.length ? 'error' : 'content';
  const rows = hunterRows(devices, positions, users, GROUPS, now);
  const live = rows.filter((row) => row.active);
  const notLive = rows.filter((row) => !row.active);

  function showOnMap(lng: number, lat: number) {
    close();
    if (isMobile) useSidebarStore.getState().setSheetSnap('peek');
    mapRef.current?.flyTo({ center: [lng, lat], duration: 2000, zoom: 16 });
  }

  const row = (hunter: HunterRow) => (
    <BeheerExpandableRow
      key={hunter.device.id}
      id={String(hunter.device.id)}
      // 12px padding + 36px marker + 12px gap
      indentClassName="pl-[60px]"
      leading={<HunterMarker row={hunter} />}
      title={<span className="truncate">{hunter.device.name}</span>}
      meta={<Reveal>{hunterMeta(hunter, now)}</Reveal>}
      trailing={<Battery percent={hunter.batteryPercent} />}
    >
      <HunterActions row={hunter} onShowOnMap={showOnMap} />
    </BeheerExpandableRow>
  );

  return (
    <BeheerPane title="Hunters" description={view === 'content' ? huntersSummary(rows) : view === 'loading' ? 'Laden…' : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton groups={2} />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.p key="error" className="text-sm text-muted-foreground" {...SWAP}>
            Kan de hunters niet laden.
          </motion.p>
        )}
        {view === 'content' && (
          <motion.div key="content" className="flex flex-col gap-3.5" {...SWAP}>
            <Reveal gap={CARD_GAP}>
              {rows.length === 0 && (
                <BeheerCard>
                  <p className="px-1 text-sm text-muted-foreground">Er zijn nog geen trackers.</p>
                </BeheerCard>
              )}
            </Reveal>
            <Reveal gap={CARD_GAP}>
              {live.length > 0 && (
                <BeheerCard title="Live" count={live.length}>
                  <BeheerRows>{live.map(row)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
            <Reveal gap={CARD_GAP}>
              {notLive.length > 0 && (
                <BeheerCard title="Niet live" count={notLive.length}>
                  <BeheerRows>{notLive.map(row)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>
    </BeheerPane>
  );
}

/** The unfolded part of a hunter row: Toon op kaart, Google Maps, and the vehicle (moves the Traccar device to the vehicle's group, i.e. its map icon). */
function HunterActions({ row, onShowOnMap }: { row: HunterRow; onShowOnMap: ShowOnMap }) {
  const { setDeviceVehicle } = useAdmin();
  const [saving, setSaving] = useState(false);
  const position = row.position;
  const name = row.device.name;

  async function changeVehicle(value: Vehicle) {
    if (value === row.vehicle) return;
    setSaving(true);
    try {
      await setDeviceVehicle(row.device.id, value);
      toast.success(`Voertuig van ${name} aangepast`);
    } catch (error) {
      toast.error('Voertuig aanpassen is mislukt', { description: apiErrorMessage(error, 'Probeer het opnieuw.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pill disabled={!position} onClick={() => position && onShowOnMap(position.longitude, position.latitude)}>
        <LocateFixedIcon />
        Toon op kaart
      </Pill>
      <Pill disabled={!position} onClick={() => position && window.open(googleMapsUrl(position.latitude, position.longitude), '_blank', 'noopener')}>
        <ExternalLinkIcon />
        Google Maps
      </Pill>
      <Segmented label={`Voertuig van ${name}`} value={row.vehicle} options={VEHICLE_SEGMENTS} onChange={(value) => void changeVehicle(value)} disabled={saving} className="sm:ml-2" />
    </>
  );
}
```

- [ ] **Step 6: Type-check, lint, test**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/hunters.ts src/lib/hunters.test.ts src/components/beheer/HuntersPane.tsx
git commit -m "feat(beheer): Hunters as expandable rows with marker, battery and vehicle picker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Bericht versturen pane (B4, two-tap send)

**Files:**
- Modify: `src/lib/beheer.ts`, `src/lib/beheer.test.ts`
- Rewrite: `src/components/beheer/BroadcastPane.tsx`

**Interfaces:**
- Consumes: `BeheerCard`, `BeheerRows`, `BeheerRow`, `BeheerPane`, `BeheerSkeleton` (Task 2); `Pill` (Task 1); `useBroadcasts(true)` → `{ broadcasts, error, send(message): Promise<void> }`; `useAdmin().users` (length = recipients).
- Produces (in `@/lib/beheer`): `type SendState = 'idle' | 'confirm' | 'sending' | 'sent'`, `type SendEvent = 'tap' | 'expire' | 'success' | 'failure' | 'reset'`, `sendTransition(state: SendState, event: SendEvent): SendState`, `sendButtonLabel(state: SendState, recipients: number | undefined): string`, `SEND_CONFIRM_MS = 3000`, `SEND_DONE_MS = 1600`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/beheer.test.ts`, extend the import list with `SEND_CONFIRM_MS, SEND_DONE_MS, sendButtonLabel, sendTransition,` and `type SendEvent, type SendState,` so the block reads:

```ts
import {
  broadcastMeta,
  DEFAULT_EXPIRY,
  DEFAULT_MAX_USES,
  EXPIRY_OPTIONS,
  formatTimeLeft,
  inviteMeta,
  inviteShareText,
  inviteStateText,
  inviteUses,
  isActiveNow,
  MAX_USES_OPTIONS,
  passkeyText,
  SEND_CONFIRM_MS,
  SEND_DONE_MS,
  sendButtonLabel,
  sendTransition,
  splitUsers,
  stoppedInviteMeta,
  userActivity,
  usersSummary,
  whatsAppShareUrl,
  type AdminInvite,
  type SendEvent,
  type SendState,
} from './beheer';
```

Append at the end of the file:

```ts
describe('send button (two taps)', () => {
  const run = (events: SendEvent[], from: SendState = 'idle') => events.reduce(sendTransition, from);

  test('first tap asks, second tap sends, success shows "Verstuurd" until reset', () => {
    expect(run(['tap'])).toBe('confirm');
    expect(run(['tap', 'tap'])).toBe('sending');
    expect(run(['tap', 'tap', 'success'])).toBe('sent');
    expect(run(['tap', 'tap', 'success', 'reset'])).toBe('idle');
  });

  test('the question expires; a failure goes back to idle', () => {
    expect(run(['tap', 'expire'])).toBe('idle');
    expect(run(['tap', 'tap', 'failure'])).toBe('idle');
  });

  test('ignores events that do not apply', () => {
    expect(run(['expire', 'success', 'failure', 'reset'])).toBe('idle');
    expect(run(['tap', 'expire', 'expire'])).toBe('idle');
    expect(sendTransition('sending', 'tap')).toBe('sending');
    expect(sendTransition('sending', 'expire')).toBe('sending');
    expect(sendTransition('sent', 'tap')).toBe('confirm');
  });

  test('labels', () => {
    expect(sendButtonLabel('idle', 12)).toBe('Naar 12 mensen sturen');
    expect(sendButtonLabel('idle', 1)).toBe('Naar 1 persoon sturen');
    expect(sendButtonLabel('idle', undefined)).toBe('Naar iedereen sturen');
    expect(sendButtonLabel('idle', 0)).toBe('Naar iedereen sturen');
    expect(sendButtonLabel('confirm', 12)).toBe('Zeker? Tik nogmaals');
    expect(sendButtonLabel('sending', 12)).toBe('Versturen…');
    expect(sendButtonLabel('sent', 12)).toBe('Verstuurd');
  });

  test('timings', () => {
    expect(SEND_CONFIRM_MS).toBe(3000);
    expect(SEND_DONE_MS).toBe(1600);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx --yes bun test src/lib/beheer.test.ts`
Expected: FAIL — `Export named 'SEND_CONFIRM_MS' not found` (or another new name).

- [ ] **Step 3: Implement — append to `src/lib/beheer.ts`**

```ts
/** Beheer → Bericht's send button: the first tap asks "Zeker?" (it reaches everyone with sound), the second sends. */
export type SendState = 'idle' | 'confirm' | 'sending' | 'sent';
export type SendEvent = 'tap' | 'expire' | 'success' | 'failure' | 'reset';

/** How long "Zeker? Tik nogmaals" waits for the second tap */
export const SEND_CONFIRM_MS = 3000;
/** How long "Verstuurd ✓" stays */
export const SEND_DONE_MS = 1600;

export function sendTransition(state: SendState, event: SendEvent): SendState {
  switch (state) {
    case 'idle':
      return event === 'tap' ? 'confirm' : state;
    case 'confirm':
      if (event === 'tap') return 'sending';
      return event === 'expire' ? 'idle' : state;
    case 'sending':
      if (event === 'success') return 'sent';
      return event === 'failure' ? 'idle' : state;
    case 'sent':
      if (event === 'reset') return 'idle';
      return event === 'tap' ? 'confirm' : state;
  }
}

/** "Naar 12 mensen sturen" (or "Naar iedereen sturen" while the count is unknown), "Zeker? Tik nogmaals", "Versturen…", "Verstuurd" */
export function sendButtonLabel(state: SendState, recipients: number | undefined): string {
  switch (state) {
    case 'idle':
      if (!recipients) return 'Naar iedereen sturen';
      return recipients === 1 ? 'Naar 1 persoon sturen' : `Naar ${recipients} mensen sturen`;
    case 'confirm':
      return 'Zeker? Tik nogmaals';
    case 'sending':
      return 'Versturen…';
    case 'sent':
      return 'Verstuurd';
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx --yes bun test src/lib/beheer.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace `src/components/beheer/BroadcastPane.tsx` with**

```tsx
import { useEffect, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, Loader2Icon, RotateCcwIcon, SendIcon } from 'lucide-react';
import { useAdmin } from '@/hooks/admin.hook';
import { useBroadcasts } from '@/hooks/broadcasts.hook';
import { broadcastMeta, SEND_CONFIRM_MS, SEND_DONE_MS, sendButtonLabel, sendTransition, type Broadcast } from '@/lib/beheer';
import { SWAP } from '@/lib/motion';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows, BeheerSkeleton } from './BeheerLayout';
import { Pill } from './controls/Pill';

/** The server's limit */
const MAX_LENGTH = 200;

/** Beheer → Bericht versturen (B4): push + sound to everyone after a second tap, and what was sent in the last 48 h. */
export default function BroadcastPane() {
  const { broadcasts, error, send } = useBroadcasts(true);
  const { users } = useAdmin();
  const [message, setMessage] = useState('');
  const [state, dispatch] = useReducer(sendTransition, 'idle');
  const textarea = useRef<HTMLTextAreaElement>(null);

  const trimmed = message.trim();
  const view = broadcasts ? 'content' : error ? 'error' : 'loading';

  // "Zeker?" falls back after 3 s, "Verstuurd" after 1.6 s
  useEffect(() => {
    if (state !== 'confirm' && state !== 'sent') return;
    const timeout = setTimeout(() => dispatch(state === 'confirm' ? 'expire' : 'reset'), state === 'confirm' ? SEND_CONFIRM_MS : SEND_DONE_MS);
    return () => clearTimeout(timeout);
  }, [state]);

  async function tap() {
    if (!trimmed || state === 'sending') return;
    dispatch('tap');
    // The first tap only asks
    if (state !== 'confirm') return;
    try {
      await send(trimmed);
      dispatch('success');
      setMessage('');
      toast.success('Bericht verstuurd');
    } catch {
      dispatch('failure');
      toast.error('Versturen is mislukt, probeer het opnieuw.');
    }
  }

  /** "Opnieuw": the old message back in the text field */
  function reuse(broadcast: Broadcast) {
    setMessage(broadcast.body.slice(0, MAX_LENGTH));
    textarea.current?.focus();
  }

  const row = (broadcast: Broadcast) => (
    <BeheerRow key={broadcast.id} title={<span className="min-w-0 font-medium break-words">{broadcast.body}</span>} meta={broadcastMeta(broadcast)}>
      <Pill onClick={() => reuse(broadcast)}>
        <RotateCcwIcon />
        Opnieuw
      </Pill>
    </BeheerRow>
  );

  return (
    <BeheerPane title="Bericht versturen" description="Iedereen krijgt dit als melding met geluid.">
      <BeheerCard title="Nieuw bericht" description="Iedereen krijgt dit als melding met geluid.">
        <textarea
          ref={textarea}
          value={message}
          maxLength={MAX_LENGTH}
          rows={3}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Bijv. Iedereen terug naar HQ"
          aria-label="Bericht"
          disabled={state === 'sending'}
          className="block min-h-[84px] w-full resize-none rounded-2xl bg-beheer-row px-3.5 py-3 text-base outline-none transition-shadow placeholder:text-muted-foreground focus-visible:shadow-[inset_0_0_0_1.5px_var(--primary)] disabled:opacity-60 md:text-sm"
        />
        <div className="mt-2.5 flex items-center gap-3">
          <span className="flex-1 px-1 text-xs text-muted-foreground tabular-nums">
            {message.length} / {MAX_LENGTH}
          </span>
          <Pill
            size="md"
            morphKey={state}
            variant={state === 'confirm' ? 'warn' : state === 'sent' ? 'success' : 'primary'}
            disabled={state === 'sending' || (state !== 'sent' && !trimmed)}
            onClick={() => void tap()}
          >
            {state === 'sending' && <Loader2Icon className="animate-spin" />}
            {state === 'sent' && <CheckIcon />}
            {state === 'idle' && <SendIcon />}
            {sendButtonLabel(state, users?.length)}
          </Pill>
        </div>
      </BeheerCard>

      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.p key="error" className="text-sm text-muted-foreground" {...SWAP}>
            Kan de verstuurde berichten niet laden.
          </motion.p>
        )}
        {view === 'content' && (
          <motion.div key="content" {...SWAP}>
            <BeheerCard title="Eerder verstuurd" count={broadcasts?.length}>
              <BeheerRows>
                {broadcasts?.map(row)}
                {broadcasts?.length === 0 && <BeheerRow key="empty" title={<span className="font-normal text-muted-foreground">Nog niets verstuurd in de laatste 48 uur.</span>} />}
              </BeheerRows>
            </BeheerCard>
          </motion.div>
        )}
      </AnimatePresence>
    </BeheerPane>
  );
}
```

Note on `tap()`: `state` is the value from this render, so the `dispatch('tap')` above moves `idle → confirm` (and returns) or `confirm → sending` (and sends).

- [ ] **Step 6: Type-check, lint, test**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/beheer.ts src/lib/beheer.test.ts src/components/beheer/BroadcastPane.tsx
git commit -m "feat(beheer): two-tap broadcast send and Opnieuw refill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Koppelingen pane (K1) and removing the BeheerGroup shim

**Files:**
- Create: `src/lib/koppelingen.ts`, `src/lib/koppelingen.test.ts`
- Rewrite: `src/components/beheer/KoppelingenPane.tsx`
- Modify: `src/components/beheer/BeheerLayout.tsx` (remove `BeheerGroup`)

**Interfaces:**
- Consumes: `BeheerCard`, `BeheerPane`, `FadeSwap`, `InlineConfirm` (Task 2); `Pill`, `IconPill`, `Tag` (Task 1); `useTelegramAdmin(true)` → `{ status?: TelegramAdminStatus, isError, link(), submitPassword(pw), unlink() }`; `useLife360Admin(true)` → `{ status?: Life360AdminStatus, isError, sendCode, verifyCode, chooseCircle, submitToken, requestFreshLocations(): Promise<string>, unlink() }`; `useNow(true): number`; `TelegramLinkPanel`, `Life360LinkPanel` (unchanged); `TelegramLogo({ size?, className? })`, `Life360Logo({ size?, className? })`; `LIFE360_PURPLE`, `refreshAllowed(refreshAvailableAt, now)`, `life360LiveLine(status, now)` from `@/lib/life360`; `formatAgo(iso, now)` from `@/lib/account`; `formatClock` from `@/lib/format`.
- Produces (in `@/lib/koppelingen`): `type IntegrationTone = 'ok' | 'off' | 'warn'`; `interface IntegrationView { tone; pill: 'Verbonden' | 'Niet gekoppeld' | 'Aandacht nodig'; line: string; sync?: string; problem?: string; canLink: boolean; canUnlink: boolean; canRelink: boolean }`; `telegramIntegration(status: TelegramAdminStatus, now: number): IntegrationView`; `life360Integration(status: Life360AdminStatus, now: number): IntegrationView`.

- [ ] **Step 1: Write the failing tests — create `src/lib/koppelingen.test.ts`**

```ts
import { describe, expect, test } from 'bun:test';
import type { Life360AdminStatus } from '@/types/Life360';
import type { TelegramAdminStatus } from '@/types/Telegram';
import { life360Integration, telegramIntegration } from './koppelingen';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

const telegram = (overrides: Partial<TelegramAdminStatus>): TelegramAdminStatus => ({ state: 'linked', connected: true, ...overrides });

describe('telegramIntegration', () => {
  test('not set up on the server', () => {
    expect(telegramIntegration(telegram({ state: 'unavailable' }), NOW)).toEqual({
      tone: 'off',
      pill: 'Niet gekoppeld',
      line: 'Niet ingesteld op de server (TELEGRAM_API_ID/HASH).',
      canLink: false,
      canUnlink: false,
      canRelink: false,
    });
  });

  test('unlinked: what it does, Koppelen', () => {
    const view = telegramIntegration(telegram({ state: 'unlinked' }), NOW);
    expect(view).toMatchObject({ tone: 'off', pill: 'Niet gekoppeld', canLink: true, canUnlink: false });
    expect(view.line).toBe('Leest berichten van @Jotihunt_bot: tegenhunts en happy hours worden automatisch gemeld.');
  });

  test('linking steps', () => {
    expect(telegramIntegration(telegram({ state: 'qr' }), NOW)).toMatchObject({ tone: 'off', line: 'Bezig met koppelen…', canLink: false, canUnlink: false });
    expect(telegramIntegration(telegram({ state: 'password' }), NOW)).toMatchObject({ line: 'Bezig met koppelen…' });
  });

  test('linked and connected: who, last message, Ontkoppelen', () => {
    const view = telegramIntegration(telegram({ account: { name: 'Silke', username: 'silke' }, lastMessageAt: ago(3 * MIN) }), NOW);
    expect(view).toEqual({
      tone: 'ok',
      pill: 'Verbonden',
      line: 'Gekoppeld als Silke (@silke)',
      sync: 'Laatste bericht van @Jotihunt_bot 3 min geleden',
      canLink: false,
      canUnlink: true,
      canRelink: false,
    });
    expect(telegramIntegration(telegram({ account: { name: 'Silke', phoneMasked: '+31 6 •••• 4821' } }), NOW)).toMatchObject({
      line: 'Gekoppeld als Silke (+31 6 •••• 4821)',
      sync: 'Nog geen berichten van @Jotihunt_bot',
    });
    expect(telegramIntegration(telegram({}), NOW).line).toBe('Gekoppeld als Telegram');
  });

  test('linked but not connected: attention with the server error', () => {
    expect(telegramIntegration(telegram({ connected: false, account: { name: 'Silke' }, lastError: 'Sessie verlopen.' }), NOW)).toEqual({
      tone: 'warn',
      pill: 'Aandacht nodig',
      line: 'Gekoppeld als Silke',
      problem: 'Sessie verlopen.',
      canLink: false,
      canUnlink: true,
      canRelink: false,
    });
    expect(telegramIntegration(telegram({ connected: false }), NOW).problem).toBe('Geen verbinding met Telegram. De server probeert het opnieuw.');
  });
});

describe('life360Integration', () => {
  test('not set up, unlinked, linking', () => {
    expect(life360Integration({ state: 'unavailable' }, NOW)).toMatchObject({ tone: 'off', line: 'Niet ingesteld op de server (LIFE360_SESSION_KEY).', canLink: false });
    expect(life360Integration({ state: 'unlinked' }, NOW)).toMatchObject({
      tone: 'off',
      pill: 'Niet gekoppeld',
      line: 'Iedereen in de team-cirkel verschijnt als eigen laag op de kaart.',
      canLink: true,
    });
    expect(life360Integration({ state: 'code', email: 'a@b.nl', resendAt: ago(0) }, NOW)).toMatchObject({ line: 'Bezig met koppelen…', canLink: false, canUnlink: false });
    expect(life360Integration({ state: 'circle', email: 'a@b.nl', circles: [] }, NOW)).toMatchObject({ line: 'Bezig met koppelen…' });
  });

  test('linked: who, live line, Ontkoppelen', () => {
    const status: Life360AdminStatus = { state: 'linked', email: 'team@x.nl', circleName: 'Jotihunt 2026', memberCount: 6, liveCount: 4, lastPollAt: ago(12_000), refreshAvailableAt: null };
    expect(life360Integration(status, NOW)).toEqual({
      tone: 'ok',
      pill: 'Verbonden',
      line: 'Gekoppeld als team@x.nl · Jotihunt 2026',
      sync: '4 van 6 live · 12 s geleden',
      canLink: false,
      canUnlink: true,
      canRelink: false,
    });
  });

  test('paused: attention with the retry time, still Ontkoppelen', () => {
    const status: Life360AdminStatus = { state: 'paused', email: 'team@x.nl', circleName: 'Jotihunt 2026', retryAt: '2026-10-17T12:30:00Z', memberCount: 6, liveCount: 0 };
    expect(life360Integration(status, NOW)).toEqual({
      tone: 'warn',
      pill: 'Aandacht nodig',
      line: 'Gekoppeld als team@x.nl · Jotihunt 2026',
      problem: 'Life360 vraagt ons te wachten. Volgende poging om 14:30.',
      canLink: false,
      canUnlink: true,
      canRelink: false,
    });
  });

  test('logged out: attention, Opnieuw koppelen', () => {
    expect(life360Integration({ state: 'loggedOut', email: 'team@x.nl', circleName: 'Jotihunt 2026' }, NOW)).toEqual({
      tone: 'warn',
      pill: 'Aandacht nodig',
      line: 'Gekoppeld als team@x.nl · Jotihunt 2026',
      problem: 'Life360 heeft de sessie beëindigd. Laatste posities blijven grijs op de kaart.',
      canLink: false,
      canUnlink: false,
      canRelink: true,
    });
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx --yes bun test src/lib/koppelingen.test.ts`
Expected: FAIL — `Cannot find module './koppelingen'`.

- [ ] **Step 3: Create `src/lib/koppelingen.ts`**

```ts
import { formatAgo } from '@/lib/account';
import { formatClock } from '@/lib/format';
import { life360LiveLine } from '@/lib/life360';
import type { Life360AdminStatus } from '@/types/Life360';
import type { TelegramAdminStatus } from '@/types/Telegram';

/** Beheer → Koppelingen (K1): what one integration card shows for a server status. */
export type IntegrationTone = 'ok' | 'off' | 'warn';

export interface IntegrationView {
  tone: IntegrationTone;
  /** The status pill next to the name */
  pill: 'Verbonden' | 'Niet gekoppeld' | 'Aandacht nodig';
  /** Under the name: "Gekoppeld als …", what it does, or "Bezig met koppelen…" */
  line: string;
  /** Last-sync line (only while it works) */
  sync?: string;
  /** The amber bar */
  problem?: string;
  /** "Koppelen" */
  canLink: boolean;
  /** "Ontkoppelen" */
  canUnlink: boolean;
  /** "Opnieuw koppelen" in the amber bar */
  canRelink: boolean;
}

const PILL = { ok: 'Verbonden', off: 'Niet gekoppeld', warn: 'Aandacht nodig' } as const;
const NONE = { canLink: false, canUnlink: false, canRelink: false };
const LINKING = 'Bezig met koppelen…';

/** "Silke (@silke)", "Silke (+31 6 •••• 4821)", "Silke", or "Telegram" when unknown. */
function telegramAccount(status: TelegramAdminStatus): string {
  const account = status.account;
  if (!account) return 'Telegram';
  if (account.username) return `${account.name} (@${account.username})`;
  return account.phoneMasked ? `${account.name} (${account.phoneMasked})` : account.name;
}

export function telegramIntegration(status: TelegramAdminStatus, now: number): IntegrationView {
  switch (status.state) {
    case 'unavailable':
      return { ...NONE, tone: 'off', pill: PILL.off, line: 'Niet ingesteld op de server (TELEGRAM_API_ID/HASH).' };
    case 'unlinked':
      return { ...NONE, tone: 'off', pill: PILL.off, line: 'Leest berichten van @Jotihunt_bot: tegenhunts en happy hours worden automatisch gemeld.', canLink: true };
    case 'qr':
    case 'password':
      return { ...NONE, tone: 'off', pill: PILL.off, line: LINKING };
    case 'linked': {
      const line = `Gekoppeld als ${telegramAccount(status)}`;
      if (status.connected === false) {
        // The server reconnects by itself: no "Opnieuw koppelen" (that would log the account out)
        return { ...NONE, tone: 'warn', pill: PILL.warn, line, problem: status.lastError ?? 'Geen verbinding met Telegram. De server probeert het opnieuw.', canUnlink: true };
      }
      const sync = status.lastMessageAt ? `Laatste bericht van @Jotihunt_bot ${formatAgo(status.lastMessageAt, now)}` : 'Nog geen berichten van @Jotihunt_bot';
      return { ...NONE, tone: 'ok', pill: PILL.ok, line, sync, canUnlink: true };
    }
  }
}

export function life360Integration(status: Life360AdminStatus, now: number): IntegrationView {
  switch (status.state) {
    case 'unavailable':
      return { ...NONE, tone: 'off', pill: PILL.off, line: 'Niet ingesteld op de server (LIFE360_SESSION_KEY).' };
    case 'unlinked':
      return { ...NONE, tone: 'off', pill: PILL.off, line: 'Iedereen in de team-cirkel verschijnt als eigen laag op de kaart.', canLink: true };
    case 'code':
    case 'circle':
      return { ...NONE, tone: 'off', pill: PILL.off, line: LINKING };
    case 'linked':
      return { ...NONE, tone: 'ok', pill: PILL.ok, line: `Gekoppeld als ${status.email} · ${status.circleName}`, sync: life360LiveLine(status, now), canUnlink: true };
    case 'paused':
      return {
        ...NONE,
        tone: 'warn',
        pill: PILL.warn,
        line: `Gekoppeld als ${status.email} · ${status.circleName}`,
        problem: `Life360 vraagt ons te wachten. Volgende poging om ${formatClock(status.retryAt)}.`,
        canUnlink: true,
      };
    case 'loggedOut':
      return {
        ...NONE,
        tone: 'warn',
        pill: PILL.warn,
        line: `Gekoppeld als ${status.email} · ${status.circleName}`,
        problem: 'Life360 heeft de sessie beëindigd. Laatste posities blijven grijs op de kaart.',
        canRelink: true,
      };
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx --yes bun test src/lib/koppelingen.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace `src/components/beheer/KoppelingenPane.tsx` with**

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckIcon, LinkIcon, Loader2Icon, RefreshCwIcon, TriangleAlertIcon, UnlinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import Life360LinkPanel, { type Life360LinkView } from '@/components/cards/life360/Life360LinkPanel';
import Life360Logo from '@/components/cards/life360/Life360Logo';
import TelegramLinkPanel from '@/components/cards/telegram/TelegramLinkPanel';
import TelegramLogo from '@/components/cards/telegram/TelegramLogo';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { useLife360Admin } from '@/hooks/life360.hook';
import { useNow } from '@/hooks/now.hook';
import { revalidateTelegramViews, useTelegramAdmin } from '@/hooks/telegram.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { life360Integration, telegramIntegration, type IntegrationTone, type IntegrationView } from '@/lib/koppelingen';
import { LIFE360_PURPLE, refreshAllowed } from '@/lib/life360';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Life360LinkedStatus } from '@/types/Life360';
import { BeheerCard, BeheerPane, FadeSwap, InlineConfirm } from './BeheerLayout';
import { IconPill, Pill, Tag } from './controls/Pill';

/** Telegram's brand blue (as TELEGRAM_BUTTON in TelegramLinkPanel) */
const TELEGRAM_BLUE = '#229ED9';
/** The inline confirm sits in the card as a red box */
const CONFIRM_BOX = 'rounded-[18px] bg-destructive/12 px-3.5 py-3';

const TAG_TONE: Record<IntegrationTone, 'ok' | 'neutral' | 'warn'> = { ok: 'ok', off: 'neutral', warn: 'warn' };

/** Runs `action`; null when it succeeded, else the server's (Dutch) error text (as in Life360Section). */
async function errorText(action: () => Promise<unknown>, fallback: string): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return apiErrorMessage(error, fallback);
  }
}

/** Calls `onLinked` when `state` turns 'linked' from one of the link steps (not e.g. paused → linked). */
function useLinkedTransition(state: string | undefined, steps: string[], onLinked: () => void) {
  const previous = useRef(state);
  // The latest callback, so the effect only runs when the state changes
  const onLinkedRef = useRef(onLinked);
  useEffect(() => {
    onLinkedRef.current = onLinked;
  });
  useEffect(() => {
    if (state === 'linked' && previous.current && steps.includes(previous.current)) onLinkedRef.current();
    previous.current = state;
  }, [state, steps]);
}

const TELEGRAM_STEPS = ['qr', 'password'];
// A token links straight from unlinked / loggedOut, without the code and circle steps
const LIFE360_STEPS = ['code', 'circle', 'unlinked', 'loggedOut'];

/** Life360's "ververs": asks for fresh fixes (max 1 per minute); spins while it runs. */
function RefreshButton({ status, onRefresh }: { status: Life360LinkedStatus; onRefresh: () => Promise<void> }) {
  const now = useNow(true);
  const [refreshing, setRefreshing] = useState(false);
  const canRefresh = !refreshing && refreshAllowed(status.refreshAvailableAt, now);

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <IconPill className="size-[26px]" aria-label="Life360 verversen" disabled={!canRefresh} onClick={() => void refresh()}>
      <RefreshCwIcon className={cn('size-3.5', refreshing && 'animate-spin')} />
    </IconPill>
  );
}

interface IntegrationCardProps {
  name: string;
  /** Fill of the logo circle */
  brand: string;
  logo: ReactNode;
  view: IntegrationView | undefined;
  isError: boolean;
  /** Koppelen / Ontkoppelen (null for none) and a key that changes with it */
  action: ReactNode;
  actionKey: string;
  /** After the sync line, e.g. the refresh button */
  syncAction?: ReactNode;
  onRelink?: () => void;
  /** The inline confirm while asking to unlink */
  confirm?: ReactNode;
  /** The link steps while linking */
  panel?: ReactNode;
}

/** K1: one card per integration — logo, name + status pill, "gekoppeld als …", sync line, amber problem bar, confirm, link steps. */
function IntegrationCard({ name, brand, logo, view, isError, action, actionKey, syncAction, onRelink, confirm, panel }: IntegrationCardProps) {
  return (
    <BeheerCard>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full text-white" style={{ background: brand }}>
          {logo}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold">{name}</h3>
            <AnimatePresence mode="popLayout" initial={false}>
              {view && (
                <motion.span key={view.tone} className="inline-flex" {...POP}>
                  <Tag tone={TAG_TONE[view.tone]}>
                    {view.tone === 'ok' && <CheckIcon />}
                    {view.tone === 'warn' && <TriangleAlertIcon />}
                    {view.pill}
                  </Tag>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <FadeSwap className="text-[12.5px] text-muted-foreground">{view ? view.line : isError ? 'Status ophalen is mislukt.' : <Skeleton className="mt-1 h-3 w-40" />}</FadeSwap>
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          {action && (
            <motion.div key={actionKey} className="shrink-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {action}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Reveal>
        {view?.sync && (
          // Lined up with the text (44px logo + 12px gap)
          <div className="flex items-center gap-1 pt-1.5 pl-14 text-xs text-muted-foreground">
            <span className="tabular-nums">{view.sync}</span>
            {syncAction}
          </div>
        )}
      </Reveal>
      <Reveal>
        {view?.problem && (
          <div className="pt-3">
            <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-amber-500/15 px-3 py-2.5 text-amber-800 dark:text-amber-200">
              <TriangleAlertIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 basis-48 text-[12.5px]">{view.problem}</span>
              {view.canRelink && onRelink && (
                <Pill variant="warn" onClick={onRelink}>
                  Opnieuw koppelen
                </Pill>
              )}
            </div>
          </div>
        )}
      </Reveal>
      <Reveal>{confirm && <div className="pt-3">{confirm}</div>}</Reveal>
      <Reveal>
        {panel && (
          <div className="pt-3">
            <div className="rounded-[18px] bg-beheer-row p-4">{panel}</div>
          </div>
        )}
      </Reveal>
    </BeheerCard>
  );
}

/** Beheer → Koppelingen (K1): the group's Telegram and Life360 accounts, one card each. "Koppelen" unfolds the same steps as the sidebar cards. */
export default function KoppelingenPane() {
  const telegram = useTelegramAdmin(true);
  const life360 = useLife360Admin(true);
  const now = useNow(true);
  const [confirming, setConfirming] = useState<'telegram' | 'life360' | null>(null);

  // Telegram: "Koppelen" starts the QR login; the panel shows while the server is in a link step
  const [telegramStarting, setTelegramStarting] = useState(false);
  const telegramState = telegram.status?.state;
  const telegramPanel = telegramState === 'qr' || telegramState === 'password';

  useLinkedTransition(telegramState, TELEGRAM_STEPS, () => {
    // The QR scan completes on the server: refresh the "linked" views too
    revalidateTelegramViews();
    toast.success('Telegram gekoppeld');
  });

  async function startTelegram() {
    setTelegramStarting(true);
    try {
      await telegram.link();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Koppelen starten is mislukt, probeer het opnieuw.'));
    } finally {
      setTelegramStarting(false);
    }
  }

  async function unlinkTelegram() {
    try {
      await telegram.unlink();
      setConfirming(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
    }
  }

  // Life360: "Koppelen" opens the e-mail step (local only, as in Life360Card); the server's code / circle steps follow
  const [emailStep, setEmailStep] = useState(false);
  const [emailPrefill, setEmailPrefill] = useState('');
  const life360Status = life360.status;
  const life360State = life360Status?.state;
  // Any server step change closes the e-mail step (a sent code moves on to the code step)
  const [previousLife360State, setPreviousLife360State] = useState(life360State);
  if (life360State !== previousLife360State) {
    setPreviousLife360State(life360State);
    setEmailStep(false);
  }
  const canLinkLife360 = life360State === 'unlinked' || life360State === 'loggedOut';
  const life360Step: Life360LinkView | null = emailStep && canLinkLife360 ? 'email' : life360State === 'code' || life360State === 'circle' ? life360State : null;

  useLinkedTransition(life360State, LIFE360_STEPS, () => toast.success('Life360 gekoppeld'));

  async function cancelLife360() {
    try {
      await life360.unlink();
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Annuleren is mislukt, probeer het opnieuw.'));
      return false;
    }
  }

  /** "ander adres": cancel the pending login and reopen the e-mail step with the old address (as in Life360Card). */
  async function otherAddress() {
    const email = life360Status && 'email' in life360Status ? life360Status.email : undefined;
    if (!(await cancelLife360())) return;
    if (email !== undefined) setEmailPrefill(email);
    setEmailStep(true);
  }

  /** "Koppelen", and "Opnieuw koppelen" when logged out (starts from the address that was linked) */
  function openLife360() {
    if (life360Status?.state === 'loggedOut') setEmailPrefill(life360Status.email);
    setEmailStep(true);
  }

  async function unlinkLife360() {
    try {
      await life360.unlink();
      setConfirming(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
    }
  }

  async function refreshLife360() {
    try {
      await life360.requestFreshLocations();
      toast.success('Life360 vraagt nieuwe locaties op');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Verversen is mislukt, probeer het later opnieuw.'));
    }
  }

  const telegramView = telegram.status && telegramIntegration(telegram.status, now);
  const life360Card = life360Status && life360Integration(life360Status, now);

  let telegramAction: ReactNode = null;
  if (telegramView?.canUnlink) {
    telegramAction = (
      <Pill variant="danger-outline" disabled={confirming === 'telegram'} onClick={() => setConfirming('telegram')}>
        Ontkoppelen
      </Pill>
    );
  } else if (telegramView?.canLink) {
    telegramAction = (
      <Pill variant="primary" morphKey={telegramStarting ? 'busy' : 'idle'} disabled={telegramStarting} onClick={() => void startTelegram()}>
        {telegramStarting ? <Loader2Icon className="animate-spin" /> : <LinkIcon />}
        Koppelen
      </Pill>
    );
  }

  let life360Action: ReactNode = null;
  if (life360Card?.canUnlink) {
    life360Action = (
      <Pill variant="danger-outline" disabled={confirming === 'life360'} onClick={() => setConfirming('life360')}>
        Ontkoppelen
      </Pill>
    );
  } else if (life360Card?.canLink && !emailStep) {
    life360Action = (
      <Pill variant="primary" onClick={openLife360}>
        <LinkIcon />
        Koppelen
      </Pill>
    );
  }

  return (
    <BeheerPane title="Koppelingen" description="Accounts van de groep.">
      <IntegrationCard
        name="Telegram"
        brand={TELEGRAM_BLUE}
        logo={<TelegramLogo className="size-[22px]" />}
        view={telegramView}
        isError={telegram.isError}
        action={telegramAction}
        actionKey={telegramView?.canUnlink ? 'unlink' : 'link'}
        confirm={
          confirming === 'telegram' && (
            <InlineConfirm
              className={CONFIRM_BOX}
              title="Telegram ontkoppelen?"
              description="De server logt uit bij Telegram. Tegenhunts worden dan niet meer automatisch gemeld, tot iemand opnieuw koppelt."
              confirmLabel="Ontkoppel"
              confirmIcon={<UnlinkIcon />}
              onCancel={() => setConfirming(null)}
              onConfirm={unlinkTelegram}
            />
          )
        }
        panel={
          telegramPanel &&
          telegram.status && (
            <TelegramLinkPanel
              status={telegram.status}
              onLink={startTelegram}
              onCancel={async () => {
                try {
                  await telegram.unlink();
                } catch (error) {
                  toast.error(apiErrorMessage(error, 'Annuleren is mislukt, probeer het opnieuw.'));
                }
              }}
              onSubmitPassword={async (password) => {
                try {
                  await telegram.submitPassword(password);
                  return null;
                } catch (error) {
                  const message = apiErrorMessage(error, 'Koppelen is mislukt, probeer het opnieuw.');
                  // Also as a toast: when the login was cancelled (409) or failed (502), the next poll replaces this step
                  toast.error(message);
                  return message;
                }
              }}
            />
          )
        }
      />

      <IntegrationCard
        name="Life360"
        brand={LIFE360_PURPLE}
        logo={<Life360Logo className="size-[22px]" />}
        view={life360Card}
        isError={life360.isError}
        action={life360Action}
        actionKey={life360Card?.canUnlink ? 'unlink' : 'link'}
        syncAction={life360Status?.state === 'linked' && <RefreshButton status={life360Status} onRefresh={refreshLife360} />}
        onRelink={openLife360}
        confirm={
          confirming === 'life360' && (
            <InlineConfirm
              className={CONFIRM_BOX}
              title="Life360 ontkoppelen?"
              description="De server vergeet de Life360-sessie. De Life360-laag verdwijnt van de kaart, tot iemand opnieuw koppelt."
              confirmLabel="Ontkoppel"
              confirmIcon={<UnlinkIcon />}
              onCancel={() => setConfirming(null)}
              onConfirm={unlinkLife360}
            />
          )
        }
        panel={
          life360Step &&
          life360Status && (
            <Life360LinkPanel
              view={life360Step}
              status={life360Status}
              emailPrefill={emailPrefill}
              onOpenEmail={() => setEmailStep(true)}
              onCloseEmail={() => setEmailStep(false)}
              onOtherAddress={() => void otherAddress()}
              onSendCode={(email) => errorText(() => life360.sendCode(email), 'Code versturen is mislukt, probeer het opnieuw.')}
              onVerifyCode={(code) => errorText(() => life360.verifyCode(code), 'Koppelen is mislukt, probeer het opnieuw.')}
              onChooseCircle={(circleId) => errorText(() => life360.chooseCircle(circleId), 'Cirkel kiezen is mislukt, probeer het opnieuw.')}
              onSubmitToken={(token) => errorText(() => life360.submitToken(token), 'Koppelen met token is mislukt, probeer het opnieuw.')}
              onCancel={cancelLife360}
            />
          )
        }
      />
    </BeheerPane>
  );
}
```

- [ ] **Step 6: Remove the `BeheerGroup` shim**

Every pane now uses `BeheerCard` + `BeheerRows`. In `src/components/beheer/BeheerLayout.tsx` delete the whole `BeheerGroup` function and its `/** @deprecated … */` comment, then check:

```bash
grep -rn "BeheerGroup" src || echo "no references left"
```

Expected: `no references left`.

- [ ] **Step 7: Type-check, lint, test**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: clean, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/koppelingen.ts src/lib/koppelingen.test.ts src/components/beheer/KoppelingenPane.tsx src/components/beheer/BeheerLayout.tsx
git commit -m "feat(beheer): Koppelingen as one card per integration with status, sync and inline unlink

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Algemeen card "Andere vossen die we mogen hunten" (depends on the huntable-areas plan)

**Dependency:** the huntable-areas plan must be merged into this branch first: it provides `src/hooks/huntable-areas.hook.ts` with `useHuntableAreas()` → `{ allowed: string[] | null | undefined, setAllowed(areas: string[]): Promise<void>, isForbidden(area: string): boolean }` (`undefined` = loading, `null` = not configured = everything allowed; `setAllowed` resolves after the SWR cache holds the new list and throws on failure). Check before starting:

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
git merge main   # or the huntable-areas branch, if it isn't on main yet
grep -n "export" src/hooks/huntable-areas.hook.ts
```

Expected: an `export function useHuntableAreas` (named). If it's a default export, change the import in Step 5 to `import useHuntableAreas from '@/hooks/huntable-areas.hook';`.

**Files:**
- Modify: `src/lib/marker-style.ts` (export `AREAS`)
- Modify: `src/lib/beheer.ts`, `src/lib/beheer.test.ts`
- Modify: `src/components/beheer/AlgemeenPane.tsx`

**Interfaces:**
- Consumes: `useHuntableAreas()` (above); `useHomeTeam(): Team | undefined` (`Team.area?: string`) from `@/hooks/teams.hook`; `BeheerCard`, `CountSwap` (Task 2); `POP`; `getColorFromArea(area: string): string`, `capitalizeFirstLetter(s: string): string` from `@/lib/utils`.
- Produces: `export const AREAS` (`readonly ['alpha', …, 'oscar']`) from `@/lib/marker-style`; in `@/lib/beheer`: `huntableChips(areas: readonly string[], ownArea: string | undefined, allowed: string[] | null | undefined): { chips: { area: string; allowed: boolean }[]; count: number }` and `toggleHuntable(areas, ownArea, allowed, area: string): string[]`.

- [ ] **Step 1: Export the area list**

In `src/lib/marker-style.ts` change

```ts
const AREAS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'oscar'] as const;
```

to

```ts
export const AREAS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'oscar'] as const;
```

(If the huntable-areas plan already exported it, leave it.)

- [ ] **Step 2: Write the failing tests**

In `src/lib/beheer.test.ts`, add `huntableChips,` and `toggleHuntable,` to the import list from `./beheer` (alphabetically: `huntableChips` after `formatTimeLeft`, `toggleHuntable` after `stoppedInviteMeta`), and add below the `bun:test` import:

```ts
import { AREAS } from './marker-style';
```

Append at the end of the file:

```ts
describe('huntable areas card', () => {
  test('not configured: every chip but our own allowed, own area counted', () => {
    const { chips, count } = huntableChips(AREAS, 'Charlie', null);
    expect(chips.map((chip) => chip.area)).toEqual(['alpha', 'bravo', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'oscar']);
    expect(chips.every((chip) => chip.allowed)).toBe(true);
    expect(count).toBe(9);
  });

  test('configured: only the listed ones allowed', () => {
    const { chips, count } = huntableChips(AREAS, 'charlie', ['delta']);
    expect(chips.filter((chip) => chip.allowed).map((chip) => chip.area)).toEqual(['delta']);
    expect(count).toBe(2);
  });

  test('own area unknown: all nine chips, not counted', () => {
    const { chips, count } = huntableChips(AREAS, undefined, ['delta']);
    expect(chips).toHaveLength(9);
    expect(count).toBe(1);
  });

  test('toggleHuntable flips one area, keeps the own area out, sorted', () => {
    expect(toggleHuntable(AREAS, 'charlie', ['delta'], 'alpha')).toEqual(['alpha', 'delta']);
    expect(toggleHuntable(AREAS, 'charlie', ['alpha', 'delta'], 'delta')).toEqual(['alpha']);
    // The first toggle of a not-configured setting stores every other area minus the tapped one
    expect(toggleHuntable(AREAS, 'charlie', null, 'oscar')).toEqual(['alpha', 'bravo', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx --yes bun test src/lib/beheer.test.ts`
Expected: FAIL — `Export named 'huntableChips' not found`.

- [ ] **Step 4: Implement — append to `src/lib/beheer.ts`**

```ts
/**
 * Beheer → Algemeen "Andere vossen die we mogen hunten": a chip for every area but our own (allowed, or locked), and
 * the n/9 count with our own area included when known. `allowed` null/undefined (not configured / loading) = all allowed.
 */
export function huntableChips(
  areas: readonly string[],
  ownArea: string | undefined,
  allowed: string[] | null | undefined,
): { chips: { area: string; allowed: boolean }[]; count: number } {
  const own = ownArea?.toLowerCase();
  const chips = areas.filter((area) => area !== own).map((area) => ({ area, allowed: allowed == null || allowed.includes(area) }));
  const ownCounted = own !== undefined && areas.includes(own) ? 1 : 0;
  return { chips, count: chips.filter((chip) => chip.allowed).length + ownCounted };
}

/** The list to store after tapping `area`: the allowed chips (own area left out) with `area` flipped, sorted. */
export function toggleHuntable(areas: readonly string[], ownArea: string | undefined, allowed: string[] | null | undefined, area: string): string[] {
  const current = huntableChips(areas, ownArea, allowed)
    .chips.filter((chip) => chip.allowed)
    .map((chip) => chip.area);
  const next = current.includes(area) ? current.filter((other) => other !== area) : [...current, area];
  return next.sort();
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx --yes bun test src/lib/beheer.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the card to `src/components/beheer/AlgemeenPane.tsx`**

Replace the import block at the top with:

```tsx
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, LockIcon, MonitorPlayIcon, PauseIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import DemoModeDialog from '@/components/settings/DemoModeDialog';
import ReloadTeamsDialog from '@/components/settings/ReloadTeamsDialog';
import { useDemo } from '@/hooks/demo.hook';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import { useInvitesPaused } from '@/hooks/invites.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';
import { useHomeTeam } from '@/hooks/teams.hook';
import { huntableChips, toggleHuntable } from '@/lib/beheer';
import { AREAS } from '@/lib/marker-style';
import { POP } from '@/lib/motion';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows, CountSwap } from './BeheerLayout';
import BeheerSwitch from './controls/BeheerSwitch';
import { Pill } from './controls/Pill';
```

Add this component above `export default function AlgemeenPane()`:

```tsx
/**
 * Rule 5.1: the other fox teams we may hunt (3 pt); the rest is locked (0 pt). Our own team (6 pt) is always allowed and
 * has no chip. Tapping saves at once (optimistic; a failure toasts and the chip flips back).
 */
function HuntableAreasCard() {
  const { allowed, setAllowed } = useHuntableAreas();
  const ownArea = useHomeTeam()?.area;
  // The list being saved, shown until the hook has it (or the save failed)
  const [draft, setDraft] = useState<string[] | null>(null);
  const shown = draft ?? allowed;
  const { chips, count } = huntableChips(AREAS, ownArea, shown);
  const loading = allowed === undefined;

  async function toggle(area: string) {
    const next = toggleHuntable(AREAS, ownArea, shown, area);
    setDraft(next);
    try {
      await setAllowed(next);
    } catch {
      toast.error('Opslaan is mislukt, probeer het opnieuw.');
    } finally {
      // A newer tap may have replaced the draft meanwhile: leave that one
      setDraft((current) => (current === next ? null : current));
    }
  }

  return (
    <BeheerCard
      title="Andere vossen die we mogen hunten"
      description="3 pt · de rest krijgt een slotje"
      right={
        <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
          <CountSwap value={count} />
          /9
        </span>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.area}
            type="button"
            aria-pressed={chip.allowed}
            aria-label={`${capitalizeFirstLetter(chip.area)}: ${chip.allowed ? 'mogen we hunten' : 'niet toegestaan'}`}
            disabled={loading}
            onClick={() => void toggle(chip.area)}
            className={cn(
              'inline-flex h-[34px] items-center gap-[7px] rounded-full px-3.5 text-[13px] font-semibold outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none',
              chip.allowed ? 'bg-foreground/12 text-foreground' : 'bg-beheer-row text-muted-foreground',
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={chip.allowed ? 'check' : 'lock'} className="inline-grid" {...POP}>
                {chip.allowed ? <CheckIcon className="size-[13px]" strokeWidth={3} /> : <LockIcon className="size-3" strokeWidth={2.6} />}
              </motion.span>
            </AnimatePresence>
            <span aria-hidden className={cn('size-2 rounded-full transition-opacity duration-200', !chip.allowed && 'opacity-40')} style={{ background: getColorFromArea(chip.area) }} />
            {capitalizeFirstLetter(chip.area)}
          </button>
        ))}
      </div>
    </BeheerCard>
  );
}
```

In the `AlgemeenPane` JSX, insert the card as the first child of `<BeheerPane …>`, before `<BeheerCard title="Functies">`:

```tsx
      <HuntableAreasCard />
```

Update the pane's doc comment to: `/** Beheer → Algemeen: which other foxes we may hunt, switches that apply to everyone, and reloading the teams. */`

- [ ] **Step 7: Type-check, lint, test**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: clean, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/marker-style.ts src/lib/beheer.ts src/lib/beheer.test.ts src/components/beheer/AlgemeenPane.tsx
git commit -m "feat(beheer): huntable areas chips card in Algemeen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Browser verification (vite :5174, admin, desktop + phone, light + dark)

**Files:** none (fix-ups found here get their own small commits in the file they concern).

`.env.local` points `API_BASE_URL` at **production** (`https://jotihunt.silkepilon.dev/api`). Everything below runs against real data: **do not** send a broadcast, delete a user, change a role, rename someone else, unlink an integration, reload teams or switch demo mode. Open every confirm and press **Annuleer**. One test invite may be created and must be stopped again at the end.

- [ ] **Step 1: Final automated checks**

Run: `npx tsc -b && npm run lint && npx --yes bun test`
Expected: clean, all tests pass.

- [ ] **Step 2: Start the dev server**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
npx vite --port 5174
```

(run in the background). Open `http://localhost:5174`, log in as an admin (ask the user to log in with their passkey if no session exists), open the gear menu → **Beheer**.

- [ ] **Step 3: Desktop (≥ 1280 px wide), dark theme — check against the mockups**

- Shell (N1, `beheer-nav.html`): 220px nav, "Beheer" title, icon + name items 40px with rounded-xl, active = soft grey fill + semibold (no orange), the fill slides to a newly picked item, counts fade in, "HQ-scherm" at the bottom opens `/hq` in a new tab; panes swap with the SWAP fade; window background darker than the cards.
- Algemeen: Functies rows with muted leading icons and M3 switches (thumb grows + slides, orange track); Demo mode switch opens the confirm dialog (cancel it); "Herladen" is a red-tinted pill and opens the reload dialog (cancel it). After Task 10: the huntable chips card on top (check/lock pop, dot dims, `n/9` rolls); toggle one chip and toggle it back right away (real write; skip if the setting is in active use during the game).
- Gebruikers (G3, `p1-gebruikers-v2.html`): header "n accounts · m nu actief"; Admins / Leden cards with counts; green dot for active-now; Admin (orange) and jij pills; amber "geen passkey"; tap a row → chevron turns, pills unfold under the text column, opening another row closes the first; own row has no admin/delete pills; "Herstel-link" on **your own** row → spinner → "Link gekopieerd ✓" (≈1.8 s, toast with the expiry); "Naam wijzigen" on your own row → inline input, **Escape** cancels without closing the window; another row's "Verwijderen" → row turns red and morphs into "… verwijderen?" with Annuleer / Verwijder → press Annuleer (row morphs back).
- Invites (I5, `p2-invites.html`): "Nieuwe invite" card with Geldig / Aantal keer segments (selected segment slides); create one test invite → it folds in at the top of Actief with two orange ring pulses and the link is on the clipboard; WhatsApp pill opens `wa.me` with the message + link (close that tab); copy icon → ✓ for 1.5 s + toast; QR icon → QR unfolds as a block under the row, again folds it away; Gestopt card collapsed, header toggles it (chevron), rows muted with struck-through code + state pill; finally stop the test invite with the square icon → confirm dialog → Intrekken (it folds out of Actief, into Gestopt).
- Hunters (H1, `p3-hunters.html`): header "n live · m niet live"; Live / Niet live cards; marker circle like the map (grey + dimmed when not live); battery glyph + % (red under 20 %); tap → "Toon op kaart" / "Google Maps" pills + vehicle segments (don't change a vehicle); "Toon op kaart" closes Beheer and flies the map.
- Bericht versturen (B4, `p4-bericht.html`): soft textarea with orange focus ring, counter `n / 200`, pill "Naar N mensen sturen" (N = number of users); type a text, tap once → amber "Zeker? Tik nogmaals", wait 3 s → it reverts (**do not tap twice**); "Opnieuw" on an old message refills the textarea and focuses it; clear the textarea afterwards.
- Koppelingen (K1, `p5-koppelingen.html`): one card per integration with the real Telegram / Life360 logos in brand circles; status pill (Verbonden / Niet gekoppeld / Aandacht nodig); "Gekoppeld als …"; Life360 sync line with the refresh icon (spins while refreshing; disabled within the 60 s limit); "Ontkoppelen" → red inline confirm with the consequence → Annuleer. If an integration is not linked: "Koppelen" unfolds the link steps inside the card (cancel with ✕). For the warn/linking states without touching prod, a Life360 dev fixture can be set in localStorage (see `src/lib/life360-fixtures.ts`).

- [ ] **Step 4: Light theme, desktop**

Switch the app theme to light (app settings, or in the console `document.body.classList.remove('dark')`) and repeat a quick pass over every pane: cards white on the grey window, rows a visible tonal step on the cards, pills/tags readable (orange/green/amber/red tints), segmented selected segment visible, switch outline visible when off.

- [ ] **Step 5: Phone width (390 × 844), light + dark**

Resize the viewport to 390 × 844 (devtools device mode or the preview resize tool). Check: the drawer has the window background; section list items (48px) → tap slides to the pane with the back arrow pill and title, back slides the list in; every pane fits without horizontal scroll (segmented pickers wrap, invite rows show the WhatsApp pill icon-only, expanded pill rows wrap, inline confirms wrap their buttons under the text); Escape is irrelevant on phone but the rename input still saves on blur. Repeat in the other theme.

- [ ] **Step 6: Reduced motion**

Enable "prefers-reduced-motion: reduce" (devtools rendering panel) and check: no slide/scale/ring-pulse/blur movement; content still swaps (fade/instant), switches and rows still change state.

- [ ] **Step 7: Clean up and report**

Stop the dev server by PID (not `pkill -f`). Make sure the test invite is stopped and the textarea was not sent. Fix anything found (each fix its own commit with the attribution line), re-run Step 1, and report what was checked, with screenshots of each pane (desktop dark, phone light) if the tooling allows.

---

## Self-Review

**Spec coverage**
- Global rules: no avatars (users get an activity dot, hunters the marker), no card-title icons (BeheerCard has no icon slot) — Tasks 2, 5, 7; animation everywhere — FadeSwap / CountSwap / Chevron / RowFrame / Pill morph / Segmented slide / nav indicator / POP icon swaps; reduced motion via MotionConfig + `motion-safe:` ring + `motion-reduce:` switch — Tasks 1–2.
- Shell N1 desktop + phone, pane header 22px — Tasks 2–3.
- Building blocks D1 (BeheerPane, BeheerCard, BeheerRows/BeheerRow, BeheerExpandableRow one-open-per-card, inline confirm, pills, M3 switch, segmented) — Tasks 1–2.
- Algemeen (huntable card, Functies, Gegevens) — Tasks 4 and 10.
- Gebruikers G3 (header line, Admins/Leden counts, dot, pills, meta, expand pills, herstel-link morph, inline rename Enter/Esc, admin toggle, delete inline confirm, own row restrictions, role change moves rows) — Task 5.
- Invites I5 (composer segments + primary pill, ring pulse, WhatsApp, copy ✓ 1.5 s + toast, QR under row, stop keeps confirm dialog, no Telegram, Gestopt collapsed) — Task 6.
- Hunters H1 (header line, cards, marker look, meta, battery red < 20 %, chevron, two pills + vehicle segments) — Task 7.
- Bericht B4 (textarea, counter, "Naar N mensen sturen", two-tap amber 3 s, Versturen… → Verstuurd ✓ 1.6 s, clears, Eerder verstuurd with Opnieuw refill, new message animates in) — Task 8.
- Koppelingen K1 (real logos in a circle, status pill, gekoppeld als, sync + spinning refresh for Life360 only, Ontkoppelen → inline confirm with today's texts, amber error bar + Opnieuw koppelen, Koppelen unfolds the existing panels) — Task 9.
- Testing (tsc, lint, unit tests, new helper tests, browser check all panes desktop + phone, light + dark) — every task + Task 11.

**Placeholder scan:** no TBD/TODO; every code step has complete code; the only conditional instruction is the huntable hook's export style (Task 10), with both variants spelled out.

**Type consistency:** `BeheerSkeleton({ groups })`, `BeheerRow` children = trailing, `RowFrame` exported for the QR block, `IconPill` variants `ghost | soft | success | active` (Task 1) used in Tasks 3, 6, 9; `Pill` variants used: primary, secondary, danger-soft, danger-outline, danger, success, warn, whatsapp — all defined; `Tag` tones primary / neutral / ok / warn; `useTimedValue` returns `[value, set, clear]`; `sendTransition` is a valid `useReducer` reducer `(SendState, SendEvent) => SendState`; `IntegrationView` fields match between `lib/koppelingen.ts`, its tests and `KoppelingenPane`.
