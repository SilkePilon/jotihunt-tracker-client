# Dropdowns Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every dropdown, select, menu and popover uses the settings-menu look (spec option A), the trigger of each turns soft orange while open, and the Life360 members dropdown only lists sharing members (option C).

**Architecture:** One class-constant module (`src/lib/menu-styles.ts`) defines the surface, row, checked, label and open-trigger looks. The shared shadcn primitives (`components/ui/dropdown-menu.tsx`, `select.tsx`, `popover.tsx`, `command.tsx`) use those constants as their defaults, so every usage inherits them. Usages then drop overrides that only re-implemented the look, and custom triggers add `TRIGGER_OPEN`.

**Tech Stack:** React 19, Radix (`radix-ui`), cmdk, Tailwind v4 (`@theme inline` in `src/index.css`, no tailwind.config), tw-animate-css, motion/react, bun test.

Spec: `docs/superpowers/specs/2026-10-17-dropdowns-redesign-design.md`. Mockups: `/home/silke/Documents/Jotihunt 2026/.superpowers/brainstorm/174578-1792190559/content/base-style.html` (option A) and `life360.html` (option C, minus green dot and amber time).

## Global Constraints

- Surface: `rounded-3xl border-0 bg-card text-card-foreground shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/0.28)]`; `p-3` for menus/selects, `p-4` for popovers.
- Rows: tonal `bg-beheer-row`, `rounded-md first:rounded-t-2xl last:rounded-b-2xl`, `px-3 py-2.5 text-[13.5px] font-semibold`, `focus:bg-beheer-row-high`, 2px seams (`flex flex-col gap-0.5` on the parent).
- Selected (radio + select item): `bg-(--map-selected-bg) text-(--map-selected-fg)` with a check icon on the right; no left dot/check. Checkbox items show the right-hand check only (no orange fill; the only usage, LayersSubmenu, hides the check and shows a switch).
- Destructive rows: `--map-danger-bg/fg`.
- Every dropdown/popover trigger: `data-[state=open]` → soft orange, chevron (marked `data-chevron`) rotates 180°.
- Life360 trigger: content and text unchanged; only the orange open state is added.
- Life360 ages are always muted gray; no green dot before "Live".
- Dutch UI copy exactly as written in this plan.
- Every state change animates (user rule): Radix enter/exit via tw-animate; value swaps via `SWAP` from `src/lib/motion.ts`.
- Commands: tests `npx --yes bun test`, types+build `npm run build` (runs `vite build && tsc -b`), lint `npm run lint`. Run from `jotihunt-tracker-client/`.
- Never restart the docker stack (client :8080 is the live instance). For visual checks run `npx vite --port 5174` and use the t3 preview tools.

---

### Task 1: Menu style constants + DropdownMenu primitive

**Files:**
- Create: `src/lib/menu-styles.ts`
- Modify: `src/components/ui/dropdown-menu.tsx`
- Modify: `src/components/settings/menu-parts.tsx`
- Modify: `src/components/settings/MapStyleSubmenu.tsx`
- Modify: `src/components/settings/LayersSubmenu.tsx`
- Modify: `src/components/Settings.tsx:67-160`

**Interfaces:**
- Produces (from `@/lib/menu-styles`): `MENU_SURFACE`, `MENU_MOTION`, `MENU_ROW_BASE`, `MENU_ROW_CHECKED`, `MENU_GROUP`, `MENU_LABEL`, `TRIGGER_OPEN` (all `string`). Chevrons inside triggers carry the attribute `data-chevron`.
- `menu-parts.tsx` keeps exporting `MENU_CARD`, `SUBMENU_SIDE_OFFSET`, `MenuRows`, `MenuRow`, `MenuSubRow`, `MenuTile`. `MENU_ROW` is removed (its two users switch to the primitive defaults).

- [ ] **Step 1: Create `src/lib/menu-styles.ts`**

```ts
/**
 * The look of every dropdown, select and popover: the settings menu card with tonal rows
 * (docs/superpowers/specs/2026-10-17-dropdowns-redesign-design.md). The shared ui primitives use these as defaults.
 */

/** Card: 24px corners, hairline + soft shadow instead of a border. Add the padding (p-3 menus, p-4 popovers). */
export const MENU_SURFACE = 'rounded-3xl border-0 bg-card text-card-foreground shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/0.28)]';

/** Radix enter/exit: fade + zoom from 95% + a 2px slide away from the trigger. */
export const MENU_MOTION =
  'duration-200 ease-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

/** Rows sit in a column with 2px seams; first/last rows round to 16px. */
export const MENU_GROUP = 'flex flex-col gap-0.5';

/** Tonal row, 6px corners and 16px on the outer ends of its group. */
export const MENU_ROW_BASE =
  "relative flex cursor-default items-center gap-2.5 rounded-md bg-beheer-row px-3 py-2.5 text-[13.5px] font-semibold outline-hidden select-none transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl focus:bg-beheer-row-high data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";

/** The chosen radio / select row: soft orange, icons included. */
export const MENU_ROW_CHECKED = 'data-[state=checked]:bg-(--map-selected-bg) data-[state=checked]:text-(--map-selected-fg) data-[state=checked]:[&_svg]:text-(--map-selected-fg)!';

/** Small header above a group of rows. */
export const MENU_LABEL = 'px-1 pt-1 pb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase';

/** Any button that opens a dropdown or popover: soft orange while open, its `data-chevron` icon turns. */
export const TRIGGER_OPEN =
  'data-[state=open]:bg-(--map-selected-bg) data-[state=open]:text-(--map-selected-fg) data-[state=open]:hover:bg-(--map-selected-bg) [&_[data-chevron]]:transition-transform [&_[data-chevron]]:duration-200 data-[state=open]:[&_[data-chevron]]:rotate-180 data-[state=open]:[&_svg]:text-(--map-selected-fg)';
```

- [ ] **Step 2: Restyle `src/components/ui/dropdown-menu.tsx`**

Add the import `import { MENU_GROUP, MENU_LABEL, MENU_MOTION, MENU_ROW_BASE, MENU_ROW_CHECKED, MENU_SURFACE } from "@/lib/menu-styles"` and remove `CircleIcon` from the lucide import. Replace these functions (others stay as they are):

```tsx
function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 flex max-h-(--radix-dropdown-menu-content-available-height) min-w-[11rem] origin-(--radix-dropdown-menu-content-transform-origin) flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-3",
          MENU_SURFACE,
          MENU_MOTION,
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" className={cn(MENU_GROUP, className)} {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        MENU_ROW_BASE,
        "data-[inset]:pl-8 data-[variant=destructive]:bg-(--map-danger-bg) data-[variant=destructive]:text-(--map-danger-fg) data-[variant=destructive]:focus:bg-[color-mix(in_oklab,var(--map-danger-bg)_85%,var(--map-danger-fg))] data-[variant=destructive]:*:[svg]:text-(--map-danger-fg)!",
        className
      )}
      {...props}
    />
  )
}

/** Check on the right end of a checkbox / radio row; pops in when chosen. */
function ItemCheck() {
  return (
    <span data-slot="dropdown-menu-item-indicator" className="pointer-events-none ml-auto flex size-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator className="animate-in fade-in-0 zoom-in-50 duration-200">
        <CheckIcon className="size-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(MENU_ROW_BASE, className)}
      checked={checked}
      {...props}
    >
      {children}
      <ItemCheck />
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      className={cn(MENU_GROUP, className)}
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(MENU_ROW_BASE, MENU_ROW_CHECKED, className)}
      {...props}
    >
      {children}
      <ItemCheck />
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(MENU_LABEL, "data-[inset]:pl-8", className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("mx-1 my-1.5 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(MENU_ROW_BASE, "data-[inset]:pl-8 data-[state=open]:bg-beheer-row-high", className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "z-50 flex min-w-[11rem] origin-(--radix-dropdown-menu-content-transform-origin) flex-col gap-0.5 overflow-hidden p-3",
        MENU_SURFACE,
        MENU_MOTION,
        className
      )}
      {...props}
    />
  )
}
```

Note: the `ItemIndicator` className animation is CSS-only on mount; Radix unmounts it when unchecked (acceptable: the row's orange fill fades via `transition-colors`).

- [ ] **Step 3: Simplify `src/components/settings/menu-parts.tsx`**

Replace the file's body with:

```tsx
import type { ComponentProps, ReactNode } from 'react';
import { DropdownMenuItem, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { MENU_GROUP, MENU_SURFACE } from '@/lib/menu-styles';
import { cn } from '@/lib/utils';

/** The menu card (now the default of every dropdown); kept for popovers that show a menu-like card. */
export const MENU_CARD = cn(MENU_SURFACE, 'p-3');

/**
 * Submenus are phone-only and a 290px card leaves no room beside it, so they open over the card instead: shifted back
 * by the row width (290px card minus 2×12px padding) they start at the row's left edge and stay on screen.
 */
export const SUBMENU_SIDE_OFFSET = -266;

/** Groups rows with 2px seams. Conditional rows render nothing, so first/last corners stay right. */
export function MenuRows({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(MENU_GROUP, className)}>{children}</div>;
}

export function MenuRow(props: ComponentProps<typeof DropdownMenuItem>) {
  return <DropdownMenuItem {...props} />;
}

/** Row that opens a submenu (phones: Zichtbare lagen, Kaartstijl); stays highlighted while its submenu is open. */
export function MenuSubRow(props: ComponentProps<typeof DropdownMenuSubTrigger>) {
  return <DropdownMenuSubTrigger {...props} />;
}

/** Quick tile: icon above a short label. Give the icon `size-5` itself. */
export function MenuTile({ className, ...props }: ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn('flex-col justify-center gap-1.5 rounded-2xl px-1 pt-3 pb-2.5 text-[11.5px] first:rounded-2xl last:rounded-2xl duration-200', className)}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Update the settings menus**

`src/components/settings/MapStyleSubmenu.tsx`: drop the `MENU_ROW` import and replace the RadioItem's `className={cn(MENU_ROW, 'pl-3 [&>span:first-child]:hidden data-[state=checked]:...')}` with no className at all (the default is now the orange row + right check). Drop `className="flex flex-col gap-0.5"` from `DropdownMenuRadioGroup` (now default) and the comment `{/* The chosen style ... radio dot hidden */}`. Keep `className={cn(MENU_CARD, 'w-[240px]')}` → change to `className="w-[240px]"`, and drop the `MENU_CARD`/`cn` imports if unused.

`src/components/settings/LayersSubmenu.tsx`: drop the `MENU_ROW` import; CheckboxItem className becomes `"justify-between py-2 [&>[data-slot=dropdown-menu-item-indicator]]:hidden"`; SubContent className becomes `"w-[270px]"`; drop `MENU_CARD`/`cn` if unused.

`src/components/Settings.tsx`:
- `<DropdownMenuContent align="start" className={cn(MENU_CARD, 'w-[290px]')}>` → `className="w-[290px]"`, remove `MENU_CARD` from the import.
- The content is now a flex column with 2px gaps: change the tile grid wrapper `mb-2` → `mb-1.5` and the logout `<MenuRows className="mt-2">` → `className="mt-1.5"`.
- Logout row: replace the long danger className with `variant="destructive"`.

- [ ] **Step 5: Build and lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Visual check**

Start `npx vite --port 5174` (background), open it with the t3 preview, log in, open the header settings menu and, at a phone width (390px), the Zichtbare lagen + Kaartstijl submenus. Expected: same look as before (tiles, tonal rows, orange logout→danger tint, orange chosen map style with a check on the right, switches without a check). Open Account → passkey ⋯ menu: now card + tonal rows, Verwijderen in danger tint.

- [ ] **Step 7: Commit**

```bash
git add src/lib/menu-styles.ts src/components/ui/dropdown-menu.tsx src/components/settings src/components/Settings.tsx
git commit -m "feat(ui): settings-menu look as the default dropdown style"
```

---

### Task 2: Select, Popover and Command primitives + their usages

**Files:**
- Modify: `src/components/ui/select.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/command.tsx`
- Modify: `src/components/beheer/GeneralSettings.tsx` (two Selects, ~lines 307-320 and 376-390)
- Modify: `src/components/intel-window/AssignmentPane.tsx:59-75`
- Modify: `src/components/beheer/ModelPicker.tsx:52-109`
- Modify: `src/components/cards/search/SearchCard.tsx:38-75`
- Modify: `src/components/map/MapLayersControl.tsx:51-60`
- Modify: `src/components/cards/hint-entry/AreaPicker.tsx:34-40`, `src/components/cards/hint-entry/TimePicker.tsx:~58-64`
- Modify: `src/components/happy-hour/HappyHourPill.tsx:23`

**Interfaces:**
- Consumes: `MENU_SURFACE`, `MENU_MOTION`, `MENU_GROUP`, `MENU_ROW_BASE`, `MENU_ROW_CHECKED`, `MENU_LABEL`, `TRIGGER_OPEN` from `@/lib/menu-styles` (Task 1).
- `SelectTrigger` keeps its props (`size: "sm" | "default"`); its chevron gets `data-chevron`.

- [ ] **Step 1: `src/components/ui/select.tsx`**

Import `{ MENU_GROUP, MENU_LABEL, MENU_MOTION, MENU_ROW_BASE, MENU_ROW_CHECKED, MENU_SURFACE, TRIGGER_OPEN } from "@/lib/menu-styles"`.

SelectTrigger className becomes:

```tsx
cn(
  "flex w-fit items-center justify-between gap-2 rounded-lg border-0 bg-beheer-row-high px-3 py-2 text-[13px] font-medium whitespace-nowrap outline-none transition-[color,background-color,box-shadow] duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_12%,var(--card))] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/40 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
  TRIGGER_OPEN,
  className
)
```

and its icon: `<ChevronDownIcon data-chevron className="size-4 opacity-60" />`.

SelectContent className: replace `rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-… zoom-in-95` with `MENU_SURFACE, MENU_MOTION` (keep `relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto` and the popper translate line). Viewport className: `cn("p-3", MENU_GROUP, position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-3")`.

SelectGroup: add `className={cn(MENU_GROUP, className)}` (destructure `className`).

SelectLabel: `className={cn(MENU_LABEL, className)}`.

SelectItem:

```tsx
<SelectPrimitive.Item
  data-slot="select-item"
  className={cn(MENU_ROW_BASE, MENU_ROW_CHECKED, "w-full pr-9 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2", className)}
  {...props}
>
  <span data-slot="select-item-indicator" className="absolute right-3 flex size-4 items-center justify-center">
    <SelectPrimitive.ItemIndicator className="animate-in fade-in-0 zoom-in-50 duration-200">
      <CheckIcon className="size-4" />
    </SelectPrimitive.ItemIndicator>
  </span>
  <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
</SelectPrimitive.Item>
```

SelectSeparator: `"pointer-events-none mx-1 my-1.5 h-px bg-border"`.

- [ ] **Step 2: `src/components/ui/popover.tsx`**

Import `{ MENU_MOTION, MENU_SURFACE } from "@/lib/menu-styles"`. PopoverContent: `sideOffset = 6` and

```tsx
className={cn(
  "z-50 w-72 origin-(--radix-popover-content-transform-origin) p-4 outline-hidden",
  MENU_SURFACE,
  MENU_MOTION,
  className
)}
```

- [ ] **Step 3: `src/components/ui/command.tsx`**

Import `{ MENU_LABEL, MENU_ROW_BASE } from "@/lib/menu-styles"`.
- `Command`: `"flex h-full w-full flex-col overflow-hidden bg-transparent text-card-foreground"`.
- `CommandInput` wrapper: `className="mb-2 flex h-10 shrink-0 items-center gap-2 rounded-[14px] bg-beheer-row-high px-3"`; input: `"flex h-10 w-full bg-transparent text-[13px] outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"`.
- `CommandList`: `"max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto"` (unchanged).
- `CommandEmpty`: `"py-6 text-center text-[13px] text-muted-foreground"`.
- `CommandGroup`: `cn("overflow-hidden text-foreground [&+&]:mt-2 [&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-0.5", "[&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase", className)` (the heading classes mirror `MENU_LABEL`; drop the `MENU_LABEL` import if unused).
- `CommandSeparator`: `"mx-1 my-1.5 h-px bg-border"`.
- `CommandItem`: `cn(MENU_ROW_BASE, "focus:bg-beheer-row data-[selected=true]:bg-beheer-row-high data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50", className)`.
- Leave `CommandDialog` as is.

- [ ] **Step 4: Drop now-redundant overrides in usages**

- `GeneralSettings.tsx`: keep `FIELD` on the triggers (sizes/text), `SelectContent className="max-h-72 rounded-2xl"` → `className="max-h-72"`; `SelectItem className="rounded-lg text-muted-foreground"` → `className="text-muted-foreground"`; `SelectItem className="rounded-lg"` → no className.
- `AssignmentPane.tsx`: SelectTrigger className → `"px-3 text-[12.5px] font-semibold"` (tonal fill/border-0 are now default).
- `ModelPicker.tsx`: trigger button className add `TRIGGER_OPEN` (import from `@/lib/menu-styles`) and replace `<Chevron open={open} />` by `<ChevronDownIcon data-chevron className="size-4 text-muted-foreground" />` (import `ChevronDownIcon` from lucide-react; remove `Chevron` import if unused). `PopoverContent className="w-80 rounded-2xl p-1.5"` → `"w-80 p-3"`. `CommandItem className="gap-2.5 rounded-[10px]"` → remove the className. Keep the leading `CheckIcon` (orange not used for cmdk; primary check stays). Refresh button: `border-t border-border` → `mt-2 rounded-[14px] bg-beheer-row px-3 py-2 hover:bg-beheer-row-high` (remove `border-t border-border px-2.5 pt-2 pb-1 mt-1`).
- `SearchCard.tsx`: trigger className add `TRIGGER_OPEN`; `ChevronsUpDownIcon` → `ChevronDownIcon data-chevron` (update import). `PopoverContent className="w-(--radix-popover-trigger-width) overflow-hidden rounded-2xl p-0"` → `"w-(--radix-popover-trigger-width) p-3"`.
- `MapLayersControl.tsx`: PopoverContent className → `"flex max-h-(--radix-popover-content-available-height) w-[330px] flex-col gap-4 overflow-y-auto"` and `sideOffset={8}` stays; delete the comment line above it about Beheer card (now the default). Trigger is a MapLibre control button: add `data-[state=open]:bg-(--map-selected-bg)! data-[state=open]:text-(--map-selected-fg)` to its className (the `!` beats maplibre's control CSS).
- `AreaPicker.tsx` / `TimePicker.tsx`: `className={cn(MENU_CARD, 'w-[300px] p-2.5')}` → `className="w-[300px] p-2.5"` (TimePicker: `"w-[280px] p-2.5"`); remove the `MENU_CARD` import and `cn` if unused.
- `HappyHourPill.tsx`: PopoverContent className stays; blockquote `rounded-md bg-muted` → `rounded-xl bg-beheer-row`.

- [ ] **Step 5: `PickerTrigger` open state** (`src/components/cards/hint-entry/picker-parts.tsx`)

Replace `data-[state=open]:shadow-[inset_0_0_0_2px_var(--primary)]` with `data-[state=open]:bg-(--map-selected-bg) data-[state=open]:text-(--map-selected-fg) data-[state=open]:hover:bg-(--map-selected-bg)` and the chevron's `text-muted-foreground` with `text-muted-foreground group-data-[state=open]:text-(--map-selected-fg)`. Update the doc comment: "the chevron turns and it turns soft orange while its popover is open."

- [ ] **Step 6: Build and lint**

Run: `npm run build && npm run lint`
Expected: exit 0.

- [ ] **Step 7: Visual check (dev server on :5174)**

Check light + dark: Beheer → Algemeen (thuisteam + voertuiggroep selects), Beheer → AI (ModelPicker), Intel window → item → Eigenaar, map search card, desktop layers button, hint entry area + time pickers, MarkerRegistration selects (`map/MarkerRegistration.tsx`) and the happy-hour popover (only when a happy hour is set; skip if none). Expected: rounded-3xl card, tonal rows with seams, orange chosen row with a right check, orange trigger while open, chevron turned.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui src/components/beheer src/components/intel-window/AssignmentPane.tsx src/components/cards src/components/map/MapLayersControl.tsx src/components/happy-hour/HappyHourPill.tsx
git commit -m "feat(ui): settings-menu look for selects, popovers and comboboxes"
```

---

### Task 3: Orange open state on the remaining custom triggers

**Files:**
- Modify: `src/components/tracker/VehicleMenu.tsx`
- Modify: `src/components/beheer/InvitesPane.tsx:57-82`
- Modify: `src/components/account/AccountDialog.tsx:150-169`
- Modify: `src/components/android-promo/DownloadSplitButton.tsx`

**Interfaces:**
- Consumes: `TRIGGER_OPEN` from `@/lib/menu-styles`; `SWAP` from `@/lib/motion`.

- [ ] **Step 1: `VehicleMenu.tsx`**

Trigger Button: `className={cn('rounded-full', TRIGGER_OPEN)}`; chevron `<ChevronDownIcon data-chevron className="opacity-60" />`. Animate the value swap: wrap icon+phrase in

```tsx
<AnimatePresence mode="wait" initial={false}>
  <motion.span key={saving ? 'saving' : current.value} {...SWAP} className="flex items-center gap-2">
    {saving ? <Loader2Icon className="animate-spin" /> : <Icon />}
    {current.phrase}
  </motion.span>
</AnimatePresence>
```

(imports: `AnimatePresence, motion` from `motion/react`, `SWAP` from `@/lib/motion`, `cn` from `@/lib/utils`, `TRIGGER_OPEN` from `@/lib/menu-styles`). `DropdownMenuContent align="center"` → add `className="w-52"`. RadioItems need no className (default = tonal row, orange when chosen, check right).

- [ ] **Step 2: `InvitesPane.tsx` Picker**

Trigger className: replace `data-[state=open]:bg-beheer-row-high` with `TRIGGER_OPEN` (via `cn(...)`), and the `ChevronDownIcon` gets `data-chevron`; the label span `text-muted-foreground` stays (TRIGGER_OPEN only recolours svgs, so add `group` to the button and `group-data-[state=open]:text-(--map-selected-fg)/70` to the label span). `DropdownMenuContent align="start" className="min-w-40"` stays.

- [ ] **Step 3: `AccountDialog.tsx` passkey menu**

`SmallButton` trigger: add `className={TRIGGER_OPEN}` (check `SmallButton` passes `className` through with `cn`; if not, add that). The Verwijderen item keeps `variant="destructive"`; its subtitle span `text-muted-foreground` → `text-(--map-danger-fg)/70`.

- [ ] **Step 4: `DownloadSplitButton.tsx`**

The chevron button: when `menuOpen`, use `bg-(--map-selected-bg) text-(--map-selected-fg)` instead of `bg-primary-container text-on-primary-container` (`cn` on `menuOpen`, add `transition-colors duration-200`). Menu panel: `rounded-2xl p-1.5 … rgb(0_0_0/.5)` → `rounded-3xl p-3 shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/0.28)]` with a `flex flex-col gap-0.5` body; the two items: `h-[42px] rounded-[10px] … hover:bg-beheer-row-high` → `h-[42px] rounded-md bg-beheer-row first:rounded-t-2xl last:rounded-b-2xl … hover:bg-beheer-row-high transition-colors`.

- [ ] **Step 5: Build, lint, visual check, commit**

Run: `npm run build && npm run lint` → exit 0. In the preview: Mijn tracker card vehicle pill (open = orange, chosen row orange with check, label swaps), Beheer → Invites pickers, Account → passkey ⋯, Android promo split button.

```bash
git add src/components/tracker/VehicleMenu.tsx src/components/beheer/InvitesPane.tsx src/components/account src/components/android-promo/DownloadSplitButton.tsx
git commit -m "feat(ui): orange open state on dropdown triggers"
```

---

### Task 4: Life360 members dropdown (option C)

**Files:**
- Modify: `src/lib/life360.ts` (after `sortMembersForList`, ~line 165)
- Test: `src/lib/life360-members.test.ts`
- Modify: `src/components/cards/life360/Life360MembersMenu.tsx`

**Interfaces:**
- Produces: `membersMenuList<T extends Pick<Life360Member, 'name' | 'location'>>(members: readonly T[]): { sharing: T[]; hiddenCount: number }` and `hiddenMembersText(count: number): string`.

- [ ] **Step 1: Write the failing tests** (append to `src/lib/life360-members.test.ts`, extend the import with `hiddenMembersText, membersMenuList`)

```ts
test('membersMenuList: only sharing members, sorted by name; counts the rest', () => {
  const { sharing, hiddenCount } = membersMenuList([...members].reverse());
  expect(sharing.map((member) => member.name)).toEqual(['Jesse S.', 'Lars B.', 'Mila K.', 'Noor J.', 'Sem D.']);
  expect(hiddenCount).toBe(1);
  expect(membersMenuList([])).toEqual({ sharing: [], hiddenCount: 0 });
});

test('hiddenMembersText: singular and plural', () => {
  expect(hiddenMembersText(1)).toBe('+ 1 lid deelt geen locatie');
  expect(hiddenMembersText(27)).toBe('+ 27 leden delen geen locatie');
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx --yes bun test src/lib/life360-members.test.ts`
Expected: FAIL — `membersMenuList` / `hiddenMembersText` not exported.

- [ ] **Step 3: Implement in `src/lib/life360.ts`**

```ts
/** Members dropdown: only who shares a location (sorted by name), plus how many don't. */
export function membersMenuList<T extends Pick<Life360Member, 'name' | 'location'>>(members: readonly T[]): { sharing: T[]; hiddenCount: number } {
  const sharing = sortMembersForList(members.filter((member) => member.location !== null));
  return { sharing, hiddenCount: members.length - sharing.length };
}

/** Footer under the members dropdown: "+ 27 leden delen geen locatie". */
export function hiddenMembersText(count: number): string {
  return count === 1 ? '+ 1 lid deelt geen locatie' : `+ ${count} leden delen geen locatie`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx --yes bun test src/lib/life360-members.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the dropdown in `Life360MembersMenu.tsx`**

Trigger: same markup, only `className={cn('max-w-full rounded-full', TRIGGER_OPEN)}`, chevron `<ChevronDownIcon data-chevron className="opacity-60" />`, and the avatar rings follow the open colour: `ring-2 ring-secondary [[data-state=open]_&]:ring-(--map-selected-bg)`. Text stays `membersPillText(circleName, memberCount)`; the first three avatars still come from the full sorted list (`sortMembersForList(members ?? [])`).

Content:

```tsx
<DropdownMenuContent align="center" className="w-64">
  {!members ? (
    <DropdownMenuItem disabled>Leden laden…</DropdownMenuItem>
  ) : sharing.length === 0 ? (
    <DropdownMenuItem disabled>Niemand deelt nu locatie</DropdownMenuItem>
  ) : (
    <>
      <DropdownMenuLabel className="flex items-center">
        Live
        <span className="ml-auto font-semibold tabular-nums">{sharing.length}</span>
      </DropdownMenuLabel>
      <DropdownMenuGroup>
        {sharing.map((member) => (
          <DropdownMenuItem key={member.id} onSelect={() => onFlyTo(member)} className="group/row py-2 pl-2">
            <Life360Avatar member={member} size={26} />
            <span className="min-w-0 flex-1 truncate">{member.name}</span>
            <span className="shrink-0 text-[11.5px] font-medium text-muted-foreground tabular-nums">{memberAgeLabel(member, now)}</span>
            <NavigationIcon aria-hidden className="size-3.5 opacity-0 transition-opacity duration-150 group-focus/row:opacity-100" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </>
  )}
  {members && hiddenCount > 0 && <p className="px-1 pt-2 text-center text-[11.5px] text-muted-foreground">{hiddenMembersText(hiddenCount)}</p>}
</DropdownMenuContent>
```

with `const { sharing, hiddenCount } = useMemo(() => membersMenuList(members ?? []), [members]);`. Imports: `DropdownMenuGroup, DropdownMenuLabel` from ui, `NavigationIcon` from lucide-react, `TRIGGER_OPEN` from `@/lib/menu-styles`, `hiddenMembersText, membersMenuList` from `@/lib/life360`; remove `isLocationStale` (no amber any more). Update the component doc comment: "the dropdown lists only sharing members (a click flies to their marker) and counts the rest."

Radix focuses the hovered item, so `group-focus/row` shows the arrow on hover and keyboard focus.

- [ ] **Step 6: Build, lint, tests**

Run: `npm run build && npm run lint && npx --yes bun test`
Expected: all exit 0.

- [ ] **Step 7: Visual check**

Use the Life360 dev fixture (`localStorage['jh-life360-fixture']`, see `src/lib/life360-fixtures.ts` `LIFE360_FIXTURE_KEY` / `life360DevFixture`) in the :5174 preview: open the Life360 card pill. Expected: unchanged pill that turns orange while open; card with "LIVE 5", five rows with gray ages, arrow on hover, footer "+ 1 lid deelt geen locatie". Set the fixture to a state with nobody sharing if one exists, else skip and note it.

- [ ] **Step 8: Commit**

```bash
git add src/lib/life360.ts src/lib/life360-members.test.ts src/components/cards/life360/Life360MembersMenu.tsx
git commit -m "feat(life360): members dropdown lists only sharing members"
```

---

### Task 5: Leftover usages + final sweep

**Files:**
- Modify: `src/components/map/MarkerRegistration.tsx:140-180` (only if needed)
- Modify: `src/components/layers/teams/TeamPopup.tsx:85-98` (only if needed)

- [ ] **Step 1: Sweep for old classes**

Run: `grep -rnE "bg-popover|focus:bg-accent|rounded-sm|ring-secondary" src/components --include=*.tsx | grep -v "components/ui/dialog\|components/ui/sheet"`
Expected: no hits in dropdown/select/popover code. Fix any remaining hit in a dropdown context by deleting the override.

- [ ] **Step 2: MarkerRegistration + TeamPopup**

Both use default `SelectTrigger`/`SelectContent` and now inherit the look. TeamPopup's trigger has `size="sm" className="mt-2 w-full"`: keep. Only open them in the preview to verify (TeamPopup select only with `TEAMS_AREA_EDITING` on; skip if off).

- [ ] **Step 3: Full verification**

Run: `npm run build && npm run lint && npx --yes bun test`
Expected: all exit 0.

- [ ] **Step 4: Commit (if anything changed)**

```bash
git add -A src
git commit -m "chore(ui): drop leftover old dropdown overrides"
```
