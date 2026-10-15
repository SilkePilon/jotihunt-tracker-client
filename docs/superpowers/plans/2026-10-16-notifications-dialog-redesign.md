# Meldingen Dialog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Meldingen dialog into design B: 2-column toggle tiles, an "Alles" switch row, a dashed HQ note and 12px-radius buttons, in the app's tonal style.

**Architecture:** Pure data/helpers stay in `src/lib/notifications.ts` (new `short` field + `toggleType` / `setAllTypes` helpers, unit tested with bun). The tile is its own component `NotificationTile.tsx`; `NotificationsDialog.tsx` keeps all existing save/close/push logic and only swaps its markup.

**Tech Stack:** React 19, Tailwind v4, lucide-react, motion/react, Radix (via shadcn), bun test.

Spec: `docs/superpowers/specs/2026-10-16-notifications-dialog-redesign-design.md`

## Global Constraints

- Only `src/lib/notifications.ts` (+ its test), `src/components/notifications/NotificationsDialog.tsx` and the new `src/components/notifications/NotificationTile.tsx` change. No changes to prefs, push, server, `NOTIFICATIONS_PROMPT_VERSION` or `ResponsiveDialog`.
- Buttons: `h-11 rounded-xl` (12px), never `rounded-full`.
- Every state change animates (motion/react); `MotionConfig reducedMotion="user"` is already global.
- Tokens: `bg-beheer-row`, `bg-beheer-row-high`, `--map-selected-bg` / `--map-selected-fg`, `bg-primary`. Same in light and dark.
- Dutch UI copy exactly as written in this plan.
- Branch: `feat/notifications-dialog-redesign` off local `main`.

---

### Task 1: Data — `short` texts and toggle helpers

**Files:**
- Modify: `src/lib/notifications.ts` (the `NOTIFICATION_OPTIONS` block, ~line 24-31)
- Test: `src/lib/notifications.test.ts`

**Interfaces:**
- Produces:
  - `NOTIFICATION_OPTIONS: { type: OptionalNotificationType; label: string; short: string; description: string }[]`
  - `toggleType(disabled: readonly OptionalNotificationType[], type: OptionalNotificationType, on: boolean): OptionalNotificationType[]`
  - `setAllTypes(on: boolean): OptionalNotificationType[]` — the new `disabledTypes` list (`[]` when on, every optional type when off)

- [ ] **Step 1: Create the branch**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
git switch -c feat/notifications-dialog-redesign
```

- [ ] **Step 2: Write the failing tests**

Add `NOTIFICATION_OPTIONS, setAllTypes, toggleType` to the existing import line at the top of `src/lib/notifications.test.ts`, then append:

```ts
describe('notification option toggles', () => {
  test('every option has a short text', () => {
    for (const option of NOTIFICATION_OPTIONS) expect(option.short.length).toBeGreaterThan(0);
  });

  test('toggleType adds and removes one type without duplicates', () => {
    expect(toggleType([], 'hint', false)).toEqual(['hint']);
    expect(toggleType(['hint'], 'hint', false)).toEqual(['hint']);
    expect(toggleType(['hint', 'article'], 'hint', true)).toEqual(['article']);
  });

  test('setAllTypes turns everything on or off', () => {
    expect(setAllTypes(true)).toEqual([]);
    expect(setAllTypes(false)).toEqual(NOTIFICATION_OPTIONS.map((option) => option.type));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx bun test src/lib/notifications.test.ts`
Expected: FAIL (`toggleType` / `setAllTypes` not exported, `short` undefined).

- [ ] **Step 4: Implement**

Replace the `NOTIFICATION_OPTIONS` declaration in `src/lib/notifications.ts` with:

```ts
/** `short` is the one-liner on the tile; `description` stays as its tooltip and screen-reader text. */
export const NOTIFICATION_OPTIONS: { type: OptionalNotificationType; label: string; short: string; description: string }[] = [
  { type: 'fox-status', label: 'Vossen status', short: 'Rood, oranje of groen', description: 'Als een deelgebied rood, oranje of groen wordt (groen = jagen mag).' },
  { type: 'hint', label: 'Nieuwe hint', short: 'Zodra hij er is', description: 'Zodra de organisatie een hint publiceert.' },
  { type: 'article', label: 'Opdrachten en nieuws', short: 'Nieuwe berichten', description: 'Nieuwe opdrachten en nieuwsberichten.' },
  { type: 'hunt-deadline', label: 'Hunt deadline', short: '10 min van tevoren', description: '10 minuten voordat een hunt ingestuurd moet zijn.' },
  { type: 'counter-hunt', label: 'Tegenhunt', short: 'Met richting', description: 'Als de Jotihunt-bot een tegenhunt meldt, en uit welke richting.' },
  { type: 'happy-hour', label: 'Happy hour', short: 'Hunts tellen dubbel', description: 'Als er een happy hour begint: hunts tellen dan dubbel.' },
];

/** The disabled list after switching one type on or off. */
export function toggleType(disabled: readonly OptionalNotificationType[], type: OptionalNotificationType, on: boolean): OptionalNotificationType[] {
  const rest = disabled.filter((item) => item !== type);
  return on ? rest : [...rest, type];
}

/** The disabled list for the "Alles" switch: nothing disabled, or every optional type. */
export function setAllTypes(on: boolean): OptionalNotificationType[] {
  return on ? [] : NOTIFICATION_OPTIONS.map((option) => option.type);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx bun test src/lib/notifications.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications.ts src/lib/notifications.test.ts
git commit -m "feat(notifications): short tile texts and toggle helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tile component + restyled dialog

**Files:**
- Create: `src/components/notifications/NotificationTile.tsx`
- Modify: `src/components/notifications/NotificationsDialog.tsx` (whole render + `toggle`)

**Interfaces:**
- Consumes: `NOTIFICATION_OPTIONS`, `toggleType`, `setAllTypes` from Task 1; `POP` from `@/lib/motion`; `Reveal` from `@/components/motion/Reveal`; `BeheerSwitch` from `@/components/beheer/controls/BeheerSwitch` (default export, Radix Switch props).
- Produces: `NotificationTile` default export, props `{ icon: LucideIcon; label: string; short: string; description: string; on: boolean; onToggle: () => void }`.

- [ ] **Step 1: Create `NotificationTile.tsx`**

```tsx
import type { LucideIcon } from 'lucide-react';
import { CheckIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface NotificationTileProps {
  icon: LucideIcon;
  label: string;
  short: string;
  /** Full explanation: tooltip and screen-reader text */
  description: string;
  on: boolean;
  onToggle: () => void;
}

/** Toggle tile in the Meldingen dialog: light orange with a check badge when on, tonal grey when off. */
export default function NotificationTile({ icon: Icon, label, short, description, on, onToggle }: NotificationTileProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={description}
      onClick={onToggle}
      className={cn(
        'relative flex min-h-[104px] cursor-pointer flex-col items-start gap-2 rounded-2xl p-3 text-left outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
        on ? 'bg-(--map-selected-bg) text-(--map-selected-fg) hover:brightness-[.97]' : 'bg-beheer-row text-muted-foreground hover:bg-beheer-row-high',
      )}
    >
      <Icon className="size-5" aria-hidden />
      <AnimatePresence initial={false}>
        {on && (
          <motion.span key="check" {...POP} aria-hidden className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-3" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
      <span className={cn('text-[13px] font-semibold', !on && 'text-foreground')}>{label}</span>
      <span className="-mt-1 text-[11px] leading-snug opacity-80">{short}</span>
      <span className="sr-only">{description}</span>
    </button>
  );
}
```

- [ ] **Step 2: Rewrite the dialog render in `NotificationsDialog.tsx`**

Imports — replace the `Button`, `Switch` and `Label` imports and the `@/lib/notifications` import with:

```tsx
import { FlagIcon, LightbulbIcon, MegaphoneIcon, NewspaperIcon, PartyPopperIcon, SwordsIcon, TimerIcon, type LucideIcon } from 'lucide-react';
import BeheerSwitch from '@/components/beheer/controls/BeheerSwitch';
import Reveal from '@/components/motion/Reveal';
import NotificationTile from '@/components/notifications/NotificationTile';
import { NOTIFICATION_OPTIONS, NOTIFICATIONS_PROMPT_VERSION, setAllTypes, toggleType, type OptionalNotificationType } from '@/lib/notifications';
```

Below `RESULT_MESSAGE` add:

```tsx
const ICONS: Record<OptionalNotificationType, LucideIcon> = {
  'fox-status': FlagIcon,
  hint: LightbulbIcon,
  article: NewspaperIcon,
  'hunt-deadline': TimerIcon,
  'counter-hunt': SwordsIcon,
  'happy-hour': PartyPopperIcon,
};

// Desktop shell: 28px card with the layers-popover shadow; the built-in close X becomes a 34×32 tonal button like the sidebar header buttons
const SHELL =
  'sm:max-w-sm rounded-[28px] border-0 bg-card p-5 shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/0.35)] [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4 [&>[data-slot=dialog-close]]:grid [&>[data-slot=dialog-close]]:h-8 [&>[data-slot=dialog-close]]:w-[34px] [&>[data-slot=dialog-close]]:place-items-center [&>[data-slot=dialog-close]]:rounded-xl [&>[data-slot=dialog-close]]:bg-beheer-row [&>[data-slot=dialog-close]]:text-muted-foreground [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:ring-0 [&>[data-slot=dialog-close]]:ring-offset-0 [&>[data-slot=dialog-close]]:transition-colors [&>[data-slot=dialog-close]:hover]:bg-beheer-row-high [&>[data-slot=dialog-close]:focus-visible]:ring-[3px] [&>[data-slot=dialog-close]:focus-visible]:ring-ring/50';

const NOTICE = 'mt-2.5 rounded-2xl bg-beheer-row p-3 text-xs';
```

Replace the `toggle` function with:

```tsx
  function toggle(type: OptionalNotificationType, on: boolean) {
    setDisabled(toggleType(current, type, on));
  }
```

After `const iosInstall = ...` add:

```tsx
  const total = NOTIFICATION_OPTIONS.length;
  const onCount = total - current.length;
  const blocked = !iosInstall && pushPermission() === 'denied';
```

Replace the whole `return (...)` with:

```tsx
  return (
    <ResponsiveDialog open={open} onClose={() => void close()} title="Meldingen" description="Tik aan waarvoor je een melding en geluid wilt." className={SHELL} compact onClosed={() => setDisabled(null)}>
      <div className="flex flex-col">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-beheer-row px-3.5 py-3">
          <span className="flex-1 text-sm font-semibold">Alles</span>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {onCount} van {total}
          </span>
          <BeheerSwitch checked={onCount === total} onCheckedChange={(on) => setDisabled(setAllTypes(on))} aria-label="Alle meldingen" />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {NOTIFICATION_OPTIONS.map((option) => {
            const on = !current.includes(option.type);
            return <NotificationTile key={option.type} icon={ICONS[option.type]} label={option.label} short={option.short} description={option.description} on={on} onToggle={() => toggle(option.type, !on)} />;
          })}
        </div>

        <p className="mt-2.5 flex items-center gap-2 rounded-[14px] border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
          <MegaphoneIcon className="size-4 shrink-0" aria-hidden />
          Berichten van HQ krijg je altijd.
        </p>

        <Reveal>
          {iosInstall && (
            <p className={NOTICE}>
              Op een iPhone werken pushmeldingen alleen als de app op je beginscherm staat: tik op <strong>Deel</strong> en dan <strong>Zet op beginscherm</strong>. Geluiden in de app werken wel.
            </p>
          )}
        </Reveal>
        <Reveal>{blocked && <p className={NOTICE}>{RESULT_MESSAGE.denied}</p>}</Reveal>

        <div className="mt-3.5 flex gap-2">
          <button type="button" onClick={() => void close()} className="h-11 flex-1 cursor-pointer rounded-xl bg-beheer-row-high text-sm font-semibold outline-none transition-colors hover:bg-beheer-row-high/70 focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Later
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !prefs}
            className="h-11 flex-1 cursor-pointer rounded-xl bg-primary text-sm font-semibold text-primary-foreground outline-none transition-[filter,opacity] hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Opslaan
          </button>
        </div>
      </div>
    </ResponsiveDialog>
  );
```

Note: the container has no flex gap, so `Reveal` gets no `gap`; the notice carries its own `mt-2.5` inside the folding (overflow-hidden) wrapper, so a hidden notice takes no space.

- [ ] **Step 3: Typecheck, lint, tests**

Run: `npx tsc -b && npm run lint && npx bun test`
Expected: no type errors, lint clean (`--max-warnings 0`), all tests pass. If lint flags the unused `Label`/`Switch`/`Button` imports, they were not removed — remove them.

- [ ] **Step 4: Visual check in the browser**

Run the dev client (`npm run dev`, see the dev-environment notes for server/Mongo) and open the dialog via the settings menu → Meldingen tile. Check, in light and dark, at desktop width and at a phone width (≤ 767px, bottom drawer):
- Tiles toggle on click and with Space/Enter; colour fades, check badge pops in/out.
- "Alles" switch: on when 6 van 6; switching off greys all tiles (0 van 6), on restores all; toggling one tile updates the counter and switch.
- Close X is a 34×32 tonal 12px-corner button; Later closes; Opslaan saves (toast) and the switches don't snap back mid-close.
- Notices: force by temporarily blocking notifications for the site in the browser → the blocked notice unfolds.

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/NotificationTile.tsx src/components/notifications/NotificationsDialog.tsx
git commit -m "feat(notifications): tile-based Meldingen dialog in app style

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
