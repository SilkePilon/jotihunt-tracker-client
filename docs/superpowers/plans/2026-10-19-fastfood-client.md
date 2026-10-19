# Fastfood layers + map popup restyle — client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three map layers (McDonald's, KFC, Burger King; off by default) with brand-tile markers and an opening-status popup, and every map popup restyled in the new site style.

**Architecture:** The shared popup building blocks (`MapPopup`, `DockedPopup`, `PopupHeader`, new `PopupRows`, `PopupActions`, `CoordRows`) get the new look first and all five existing popups move onto them. Then a pure `lib/fastfood.ts` (status texts, brand constants), a store/toggle/hook layer, a new `fastfood` canvas marker icon with the real logos, and a `FastFood` symbol layer (modelled on `Teams.tsx`) with tooltip and popup.

**Tech Stack:** React 19, react-map-gl/maplibre, zustand, SWR, Tailwind 4, motion/react, lucide-react, bun:test.

Spec: `docs/superpowers/specs/2026-10-19-fastfood-layers-design.md`. Server API: `GET /fastfood` (server plan `jotihunt-tracker-server/docs/superpowers/plans/2026-10-19-fastfood-server.md`).

## Global Constraints

- Popup look (mockup "all-popups"): popup card 248px wide, 24px corners, 14px padding, shadow `0 0 0 1px var(--map-hairline), 0 18px 50px rgb(0 0 0 / 0.35)`; close button 34×32, 12px corners, `--beheer-row` background, at 12px from top/right; header icon 36px (squares 11px corners), title 15px bold, subtitle 12px muted; rows grouped with 2px gaps, 6px inner / 16px outer corners on `--beheer-row`; buttons 40px high, 12px corners, icon buttons 44px wide; primary = `bg-primary-container text-on-primary-container`.
- Every primary map action is **Route** (lucide `NavigationIcon`), opening `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` (6 decimals). In popups that also show the Hunt/Spot buttons (hunter, picked location) Route is the 44px icon-only neutral button and Hunt/Spot stay primary.
- Brand ids `'mcdonalds' | 'kfc' | 'burgerking'`; labels `McDonald's`, `KFC`, `Burger King`; tile colours `#DB0007`, `#E4002B`, `#F5EBDC`; tooltip dot colours `#DB0007`, `#E4002B`, `#D62300`.
- Fastfood marker: 28px rounded square, 9px corners, 2px rim (`surfaceContainerLowest`), brand colour, logo widths McDonald's 15px, KFC 17px, Burger King 19px; closed = greyscale at 60% opacity; unknown hours = full colour.
- Status: closing = open and ending within 30 min. All times in Europe/Amsterdam (`Intl` with `timeZone`), never device time.
- Layers off by default; labels in the layers menu: `McDonald's`, `KFC`, `Burger King` (after the existing rows).
- Every UI state change animates (motion/react or CSS transitions) — rule from the user.
- Commands: tests `npx --yes bun test <file>`, types `npx --yes tsc -b`, lint `npx --yes eslint <files>`. Work in worktree `.worktrees/client-fastfood` on branch `feat/fastfood`.

---

### Task 1: Restyle the popup building blocks

**Files:**
- Modify: `src/index.css` (popup block, `--map-warn-bg`)
- Modify: `src/components/map/MapPopup.tsx`
- Modify: `src/components/mobile/DockedPopup.tsx`
- Modify: `src/components/map/popup/PopupHeader.tsx`
- Create: `src/components/map/popup/PopupRows.tsx`
- Modify: `src/components/map/popup/PopupActions.tsx`
- Modify: `src/components/map/popup/CoordRows.tsx`
- Modify: `src/lib/hunters.ts` (+ `googleRouteUrl`)
- Test: `src/lib/hunters.test.ts`

**Interfaces:**
- Produces:
  - `PopupIcon({ shape?: 'circle' | 'square'; background: string; color: string; rim?: boolean; children })`
  - `PopupRows({ children })`, `PopupRowSplit({ children })`, `PopupRow({ icon?: ReactNode; label?: string; title: ReactNode; meta?: ReactNode; trailing?: ReactNode; tone?: RowTone })`, `type RowTone = 'default' | 'success' | 'warn' | 'danger'`
  - `popupActionClass(variant: 'neutral' | 'primary' | 'danger' | 'success', className?: string)`, `ICON_ACTION` (class string for 44px icon buttons), `RouteAction({ lat, lng, compact? })`
  - `googleRouteUrl(lat: number, lng: number): string`
  - `MapsAction`, `PopupFacts`, `PopupFact`, `FactDot` stay until Task 2 removes them.

- [ ] **Step 1: Failing test for the route URL**

Add to `src/lib/hunters.test.ts` (keep the existing imports; add `googleRouteUrl` to the import from `./hunters`):

```ts
describe('googleRouteUrl', () => {
  test('directions to the point with 6 decimals', () => {
    expect(googleRouteUrl(51.98181234, 5.9089)).toBe('https://www.google.com/maps/dir/?api=1&destination=51.981812,5.908900');
  });
});
```

Run: `npx --yes bun test src/lib/hunters.test.ts` → FAIL (`googleRouteUrl` is not exported).

- [ ] **Step 2: Implement `googleRouteUrl`**

In `src/lib/hunters.ts`, below `googleMapsUrl`:

```ts
/** Google Maps directions to the point (the popups' Route button). */
export function googleRouteUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
```

Run the test again → PASS.

- [ ] **Step 3: CSS**

In `src/index.css`, in the `body { --map-... }` block add `--map-warn-bg: #ffedd5;`, and in `body.dark { ... }` add `--map-warn-bg: rgb(154 74 0 / 0.3);`.

Replace the `.maplibregl-popup-content` and `.maplibregl-popup-close-button` rules (and its `:hover`) with:

```css
/* MapLibre popup styling: the dialog look (DIALOG_SHELL) at popup size */
.maplibregl-popup-content {
  @apply animate-in fade-in zoom-in-95;
  background: var(--map-surface) !important;
  color: var(--map-on-surface);
  font-family: var(--map-font);
  font-size: 13px;
  line-height: 1.35;
  border-radius: 24px !important;
  padding: 14px;
  box-shadow:
    0 0 0 1px var(--map-hairline),
    0 18px 50px rgb(0 0 0 / 0.35);
}

.maplibregl-popup-close-button {
  top: 12px;
  right: 12px;
  width: 34px;
  height: 32px;
  border-radius: 12px;
  font-size: 18px;
  line-height: 1;
  color: var(--map-muted);
  background: var(--beheer-row) !important;
  transition: background-color 150ms;
}

.maplibregl-popup-close-button:hover {
  background: var(--beheer-row-high) !important;
}
```

- [ ] **Step 4: `MapPopup.tsx`**

Change the desktop `Popup` to `maxWidth="248px"` and the inner wrapper to `<div className="flex w-[220px] flex-col">{children}</div>` (248 − 2×14 padding). Update the doc comment: `/** Map card (248px, styled in index.css) above a point; on phones docked above the sheet instead. */`.

- [ ] **Step 5: `DockedPopup.tsx`**

Replace the `motion.div` className and the close button, and drop the `pr-6` on the inner wrapper (the header leaves room itself):

```tsx
      className="pointer-events-auto relative rounded-3xl bg-card p-3.5 text-[13px] leading-[1.35] text-card-foreground shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/.35)]"
    >
      <button
        type="button"
        aria-label="Sluiten"
        onClick={requestClose}
        className="absolute top-3 right-3 grid h-8 w-[34px] place-items-center rounded-xl bg-beheer-row text-muted-foreground transition-colors hover:bg-beheer-row-high"
      >
        <XIcon className="size-4" />
      </button>
      <div className="flex flex-col">{children}</div>
```

- [ ] **Step 6: `PopupHeader.tsx`**

Replace the file with:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 36px header icon in the marker's shape: a circle (hunters, Life360, picked location) or rounded square (fox markers,
 * groups, fastfood); `rim` adds the marker's white rim (fastfood tiles).
 */
export function PopupIcon({ shape = 'circle', background, color, rim, children }: { shape?: 'circle' | 'square'; background: string; color: string; rim?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden text-[15px] font-extrabold [&_svg]:size-[19px]',
        shape === 'circle' ? 'rounded-full' : 'rounded-[11px]',
        rim && 'border-2 border-white shadow-[0_0_0_1px_var(--map-hairline),0_1px_3px_rgb(0_0_0/0.2)]',
      )}
      style={{ background, color }}
    >
      {children}
    </div>
  );
}

/** Icon + title + muted subtitle; `stale` greys the icon and turns the subtitle warn-coloured. Leaves room for the close button. */
export default function PopupHeader({ icon, title, subtitle, stale }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode; stale?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 pr-10">
      <div className={cn('shrink-0 transition-[filter,opacity] duration-200', stale && 'opacity-70 grayscale')}>{icon}</div>
      <div className="min-w-0">
        <h2 className="truncate text-[15px] leading-tight font-bold">{title}</h2>
        {subtitle && <p className={cn('truncate text-xs leading-snug transition-colors duration-200', stale ? 'text-(--map-warn)' : 'text-(--map-muted)')}>{subtitle}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `PopupRows.tsx` (new)**

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type RowTone = 'default' | 'success' | 'warn' | 'danger';

// Tone: row background, then the colour of the icon, title and meta
const TONE: Record<RowTone, string> = {
  default: 'bg-beheer-row',
  success: 'bg-(--map-success-bg) text-(--map-success)',
  warn: 'bg-(--map-warn-bg) text-(--map-warn)',
  danger: 'bg-(--map-danger-bg) text-(--map-danger-fg)',
};

/** Grouped rows like the Beheer/Meldingen dialogs: 2px gaps, 16px outer corners. */
export function PopupRows({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-col gap-0.5 [&>*]:rounded-md [&>*:first-child]:rounded-t-2xl [&>*:last-child]:rounded-b-2xl">{children}</div>;
}

/** Two rows side by side (one fills the width); the group's outer corners clip them. */
export function PopupRowSplit({ children }: { children: ReactNode }) {
  return <div className="grid auto-cols-fr grid-flow-col gap-0.5 overflow-hidden">{children}</div>;
}

/** One row: optional icon, optional uppercase label, title, optional meta line, optional trailing buttons. */
export function PopupRow({ icon, label, title, meta, trailing, tone = 'default' }: { icon?: ReactNode; label?: string; title: ReactNode; meta?: ReactNode; trailing?: ReactNode; tone?: RowTone }) {
  const toned = tone !== 'default';
  return (
    <div className={cn('flex min-h-10 min-w-0 items-center gap-2.5 rounded-md px-3 py-2 transition-colors duration-200', TONE[tone])}>
      {icon && <span className={cn('grid shrink-0 place-items-center [&_svg]:size-4', !toned && 'text-(--map-muted)')}>{icon}</span>}
      <div className="min-w-0 flex-1">
        {label && <div className="text-[10px] tracking-wide text-(--map-muted) uppercase">{label}</div>}
        <div className="truncate text-[13px] font-semibold tabular-nums">{title}</div>
        {meta && <div className={cn('truncate text-[11.5px]', toned ? 'opacity-80' : 'text-(--map-muted)')}>{meta}</div>}
      </div>
      {trailing && <div className="-mr-1.5 flex shrink-0 items-center text-(--map-on-surface-variant)">{trailing}</div>}
    </div>
  );
}
```

- [ ] **Step 8: `PopupActions.tsx`**

Replace `BASE`, `VARIANTS`, `PopupActions` and add `ICON_ACTION` + `RouteAction` (keep `MapsAction` for now; Task 2 deletes it):

```tsx
import type { ReactNode } from 'react';
import { MapIcon, NavigationIcon } from 'lucide-react';
import { googleMapsUrl, googleRouteUrl } from '@/lib/hunters';
import { cn } from '@/lib/utils';

const BASE =
  'inline-flex h-10 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold outline-none transition-[filter,background-color,color] duration-200 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0';

const VARIANTS = {
  neutral: 'bg-beheer-row-high text-(--map-on-surface)',
  primary: 'bg-primary-container text-on-primary-container',
  danger: 'bg-(--map-danger-bg) text-(--map-danger-fg)',
  success: 'bg-(--map-success-bg) text-(--map-success)',
} as const;

/** Classes of a 40px popup action button. */
export function popupActionClass(variant: keyof typeof VARIANTS, className?: string): string {
  return cn(BASE, VARIANTS[variant], className);
}

/** Add to popupActionClass for a 44px icon-only button. */
export const ICON_ACTION = 'w-11 flex-none px-0';

/** The bottom row of buttons. */
export function PopupActions({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex gap-2">{children}</div>;
}

/**
 * Google Maps directions to the point: the soft-orange "Route" button, or (`compact`, next to Hunt/Spot) a 44px
 * neutral icon button.
 */
export function RouteAction({ lat, lng, compact }: { lat: number; lng: number; compact?: boolean }) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      href={googleRouteUrl(lat, lng)}
      aria-label="Route in Google Maps"
      title={compact ? 'Route in Google Maps' : undefined}
      className={compact ? popupActionClass('neutral', ICON_ACTION) : popupActionClass('primary', 'min-w-0 flex-1')}
    >
      <NavigationIcon />
      {!compact && 'Route'}
    </a>
  );
}
```

(Leave the existing `MapsAction` function below it unchanged for now.)

- [ ] **Step 9: `CoordRows.tsx`**

Replace the local `Row` and the returned markup so the coordinates are grouped rows:

```tsx
import { LightbulbIcon } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCoordinates } from '@/lib/hunters';
import { toRD } from '@/lib/rd';
import { PopupRow, PopupRows } from './PopupRows';

const COPIED = 'Coördinaten gekopieerd naar klembord!';

/**
 * WGS84 (5 decimals shown, 7 copied) and RD rows with copy buttons; `onHint` adds the lightbulb that puts the RD
 * coordinates into the hint registration.
 */
export default function CoordRows({ lat, lng, onHint }: { lat: number; lng: number; onHint?: (rd: { x: string; y: string }) => void }) {
  const rdMetres = toRD(lng, lat);
  const rd = { x: rdMetres.x.toFixed(0), y: rdMetres.y.toFixed(0) };

  return (
    <PopupRows>
      <PopupRow label="WGS84" title={formatCoordinates(lat, lng)} trailing={<CopyButton value={`${lat.toFixed(7)}, ${lng.toFixed(7)}`} label="Coördinaten" successMessage={COPIED} variant="ghost" />} />
      <PopupRow
        label="RD"
        title={`${rd.x} · ${rd.y}`}
        trailing={
          <>
            {onHint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label="Plaats coördinaten in hint registratie" onClick={() => onHint(rd)}>
                    <LightbulbIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Plaats coördinaten in hint registratie.</TooltipContent>
              </Tooltip>
            )}
            <CopyButton value={`${rd.x}, ${rd.y}`} label="RD-coördinaten" successMessage={COPIED} variant="ghost" />
          </>
        }
      />
    </PopupRows>
  );
}
```

- [ ] **Step 10: Typecheck, lint, tests**

Run: `npx --yes tsc -b && npx --yes eslint src/components/map src/components/mobile/DockedPopup.tsx src/lib/hunters.ts && npx --yes bun test`
Expected: no type/lint errors; all tests PASS. (Existing popups still compile: `MapsAction`/`PopupFacts` are unchanged.)

- [ ] **Step 11: Commit**

```bash
git add src/index.css src/components/map src/components/mobile/DockedPopup.tsx src/lib/hunters.ts src/lib/hunters.test.ts
git commit -m "feat(popups): new popup building blocks in the dialog style"
```

---

### Task 2: Move every map popup onto the new blocks

**Files:**
- Modify: `src/components/layers/teams/TeamPopup.tsx`
- Modify: `src/components/map/VisitControls.tsx`
- Modify: `src/components/layers/devices/DevicePopup.tsx`
- Modify: `src/components/layers/markers/MarkerPopup.tsx`
- Modify: `src/components/layers/life360/Life360Popup.tsx`
- Modify: `src/components/map/PickedLocationPopup.tsx`
- Modify: `src/components/map/popup/PopupActions.tsx` (delete `MapsAction`)
- Delete: `src/components/map/popup/PopupFacts.tsx`

**Interfaces:**
- Consumes: Task 1 blocks.
- Produces: `VisitStatusRow({ teamApiId })` (replaces `VisitStatusFact`), `VisitToggleButton` (40px, `success` when visited).

- [ ] **Step 1: `VisitControls.tsx`**

Replace `VisitStatusFact` with `VisitStatusRow` and restyle the toggle:

```tsx
import { useState } from 'react';
import { CheckIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useVisits } from '@/hooks/predictions.hook';
import { nextVisitChoice, visitSelection, visitStatusText } from '@/lib/prediction';
import MarkerGlyph from './popup/MarkerGlyph';
import { ICON_ACTION, popupActionClass } from './popup/PopupActions';
import { PopupRow } from './popup/PopupRows';

/** The group's visit status as a row: green with a check when manually visited, sparkles for the AI's view. */
export function VisitStatusRow({ teamApiId }: { teamApiId: number }) {
  const { visits } = useVisits();
  const visit = visits?.find((candidate) => candidate.teamApiId === teamApiId);
  const manualVisited = visitSelection(visit) === 'visited';
  return <PopupRow icon={manualVisited ? <CheckIcon /> : <SparklesIcon />} title={visitStatusText(visit)} tone={manualVisited ? 'success' : 'default'} />;
}
```

In `VisitToggleButton` replace the `className` with:

```tsx
      className={popupActionClass(visited ? 'success' : 'neutral', ICON_ACTION)}
```

and remove the now unused `cn` import.

- [ ] **Step 2: `TeamPopup.tsx`**

Imports: replace the `PopupActions`/`PopupFacts`/`VisitControls`/`joinParts` imports with

```tsx
import { PopupActions, RouteAction } from '../../map/popup/PopupActions';
import { PopupRow, PopupRows } from '../../map/popup/PopupRows';
import { VisitStatusRow, VisitToggleButton } from '../../map/VisitControls';
```

Header icon: `className="size-9 rounded-[11px] border-0 shadow-none"` on `TeamLogo`.

Replace `<PopupFacts>…</PopupFacts>` with:

```tsx
      <PopupRows>
        <PopupRow icon={<MapPinIcon />} title={team.accomodation || address} meta={team.accomodation ? address : undefined} />
        {showVisits && <VisitStatusRow teamApiId={team.apiId} />}
      </PopupRows>
```

`SelectTrigger` className stays `mt-2 w-full`. Replace the actions with:

```tsx
      <PopupActions>
        <RouteAction lat={lat} lng={lng} />
        {showVisits && <VisitToggleButton teamApiId={team.apiId} />}
      </PopupActions>
```

- [ ] **Step 3: `DevicePopup.tsx`**

Imports: drop `MapsAction`, `FactDot`, `PopupFact`, `PopupFacts`; add

```tsx
import { PopupActions, RouteAction } from '../../map/popup/PopupActions';
import { PopupRow, PopupRowSplit, PopupRows } from '../../map/popup/PopupRows';
```

Replace `<PopupFacts>…</PopupFacts>` and the actions with:

```tsx
      <PopupRows>
        <PopupRowSplit>
          {!stale && <PopupRow icon={<GaugeIcon />} title={formatSpeed(knotsToKmh(position.speed))} />}
          <PopupRow icon={<BatteryIcon />} title={formatBattery(position.attributes.batteryLevel)} />
        </PopupRowSplit>
      </PopupRows>
      <PopupActions>
        <RouteAction lat={lat} lng={lng} compact />
        <MarkerRegistration lat={lat} lng={lng} />
      </PopupActions>
```

- [ ] **Step 4: `Life360Popup.tsx`**

Same import change (no `MarkerRegistration`). Replace facts + actions with:

```tsx
      <PopupRows>
        <PopupRowSplit>
          {driving && <PopupRow icon={<GaugeIcon />} title={driving} />}
          <PopupRow icon={<BatteryIcon />} title={battery} />
        </PopupRowSplit>
        {hasUsableAccuracy(location.accuracyM) && <PopupRow icon={<CrosshairIcon />} title={`${formatAccuracy(location.accuracyM)} nauwkeurig`} />}
      </PopupRows>
      <PopupActions>
        <RouteAction lat={location.lat} lng={location.lon} />
      </PopupActions>
```

The avatar: `<Life360Avatar member={member} size={36} />`.

- [ ] **Step 5: `MarkerPopup.tsx`**

Imports: `import { ICON_ACTION, PopupActions, popupActionClass, RouteAction } from '../../map/popup/PopupActions';` (drop `MapsAction`). The estimate note: change `pl-[42px]` to `pl-[46px]` and `text-[11.5px]` to `text-xs`. Actions:

```tsx
      <PopupActions>
        <RouteAction lat={lat} lng={lng} />
        <button type="button" aria-label="Verwijderen" title="Verwijderen" className={popupActionClass('danger', ICON_ACTION)} onClick={() => setConfirmOpen(true)}>
          <Trash2Icon />
        </button>
      </PopupActions>
```

- [ ] **Step 6: `PickedLocationPopup.tsx`**

Import `RouteAction` instead of `MapsAction`; actions:

```tsx
        <PopupActions>
          <RouteAction lat={lat} lng={lng} compact />
          <MarkerRegistration lat={lat} lng={lng} />
        </PopupActions>
```

- [ ] **Step 7: Remove the old pieces**

Delete `src/components/map/popup/PopupFacts.tsx`; delete `MapsAction` (and the `MapIcon`/`googleMapsUrl` imports) from `PopupActions.tsx`. Then:

Run: `grep -rn "PopupFact\|FactDot\|MapsAction\|VisitStatusFact" src` → no output.

- [ ] **Step 8: Typecheck, lint, tests**

Run: `npx --yes tsc -b && npx --yes eslint src/components && npx --yes bun test`
Expected: clean, all PASS.

- [ ] **Step 9: Look at it**

Start the dev client against the local docker server (`npx --yes vite --port 5190`; API base from `.env.local` as usual) and open each popup (group, hunter, fox marker, Life360 if linked, picked location) in light and dark mode at desktop width and at 390px width (docked). Check: nothing overflows 220px content width, close button doesn't overlap the title, rows and buttons match the mockup `.superpowers/brainstorm/98339-1792416537/content/all-popups.html`. Fix spacing issues before committing.

- [ ] **Step 10: Commit**

```bash
git add -A src/components
git commit -m "feat(popups): all map popups in the new grouped-row style with a Route button"
```

---

### Task 3: Fastfood types, brand constants and status texts

**Files:**
- Create: `src/types/Fastfood.ts`
- Create: `src/lib/fastfood.ts`
- Test: `src/lib/fastfood.test.ts`

**Interfaces:**
- Produces:
  - `type Brand = 'mcdonalds' | 'kfc' | 'burgerking'`, `interface FastfoodRestaurant` (API item, below)
  - `BRANDS: Brand[]`, `BRAND_LABEL: Record<Brand, string>`, `BRAND_COLOR: Record<Brand, string>`, `BRAND_DOT: Record<Brand, string>`
  - `type FastfoodState = 'open' | 'closing' | 'closed' | 'unknown'`
  - `interface FastfoodStatus { state: FastfoodState; title: string; meta: string; short?: string }`
  - `fastfoodStatus(intervals: FastfoodRestaurant['intervals'], nowMs: number): FastfoodStatus`
  - `shownBrands(flags: { showMcDonalds: boolean; showKfc: boolean; showBurgerKing: boolean }): Brand[]`
  - `restaurantAddress(r: FastfoodRestaurant): { line1?: string; line2?: string }`

- [ ] **Step 1: Types**

`src/types/Fastfood.ts`:

```ts
export type Brand = 'mcdonalds' | 'kfc' | 'burgerking';

/** One restaurant from GET /fastfood (OpenStreetMap); `intervals` is absent when the opening hours are unknown. */
export interface FastfoodRestaurant {
  /** "node/123" */
  osmId: string;
  brand: Brand;
  /** e.g. "Arnhem Rijnstraat" */
  branch?: string;
  location: { type: 'Point'; coordinates: [number, number] };
  street?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  phone?: string;
  website?: string;
  driveThrough?: boolean;
  openingHours?: string;
  updatedAt: string;
  /** Open times in the next 8 days (ISO); the first may start at "now" */
  intervals?: { start: string; end: string }[];
}
```

- [ ] **Step 2: Failing tests**

`src/lib/fastfood.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { fastfoodStatus, restaurantAddress, shownBrands } from './fastfood';

// Saturday 17 Oct 2026, 23:40 Dutch time
const NOW = Date.parse('2026-10-17T23:40:00+02:00');
const iv = (start: string, end: string) => ({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });

describe('fastfoodStatus', () => {
  test('open with more than 30 minutes left', () => {
    expect(fastfoodStatus([iv('2026-10-17T08:30:00+02:00', '2026-10-18T01:30:00+02:00')], NOW)).toEqual({
      state: 'open',
      title: 'Open tot 01:30',
      meta: 'nog 1 u 50 min',
      short: 'open tot 01:30',
    });
  });
  test('whole hours leave the minutes out', () => {
    expect(fastfoodStatus([iv('2026-10-17T08:30:00+02:00', '2026-10-18T01:40:00+02:00')], NOW).meta).toBe('nog 2 u');
  });
  test('closing within 30 minutes', () => {
    expect(fastfoodStatus([iv('2026-10-17T10:00:00+02:00', '2026-10-18T00:00:00+02:00')], NOW)).toEqual({
      state: 'closing',
      title: 'Sluit om 00:00',
      meta: 'nog 20 min',
      short: 'sluit om 00:00',
    });
  });
  test('exactly 30 minutes left is closing', () => {
    expect(fastfoodStatus([iv('2026-10-17T10:00:00+02:00', '2026-10-18T00:10:00+02:00')], NOW).state).toBe('closing');
  });
  test('closed, opening tomorrow', () => {
    expect(fastfoodStatus([iv('2026-10-18T09:00:00+02:00', '2026-10-18T22:00:00+02:00')], NOW)).toEqual({
      state: 'closed',
      title: 'Dicht',
      meta: 'opent morgen 09:00',
      short: 'dicht',
    });
  });
  test('closed, opening later today', () => {
    const morning = Date.parse('2026-10-17T07:00:00+02:00');
    expect(fastfoodStatus([iv('2026-10-17T08:30:00+02:00', '2026-10-17T22:00:00+02:00')], morning).meta).toBe('opent vandaag 08:30');
  });
  test('closed, opening on a later weekday', () => {
    expect(fastfoodStatus([iv('2026-10-19T10:00:00+02:00', '2026-10-19T22:00:00+02:00')], NOW).meta).toBe('opent maandag 10:00');
  });
  test('closed the whole window', () => {
    expect(fastfoodStatus([], NOW)).toEqual({ state: 'closed', title: 'Dicht', meta: 'opent niet in de komende week', short: 'dicht' });
  });
  test('past intervals are skipped', () => {
    expect(fastfoodStatus([iv('2026-10-17T08:00:00+02:00', '2026-10-17T22:00:00+02:00'), iv('2026-10-18T09:00:00+02:00', '2026-10-18T22:00:00+02:00')], NOW).meta).toBe('opent morgen 09:00');
  });
  test('an interval running to the end of the window is day and night', () => {
    expect(fastfoodStatus([iv('2026-10-17T23:40:00+02:00', '2026-10-25T23:40:00+01:00')], NOW)).toEqual({
      state: 'open',
      title: 'Dag en nacht open',
      meta: 'de hele week',
      short: 'dag en nacht open',
    });
  });
  test('unknown hours', () => {
    expect(fastfoodStatus(undefined, NOW)).toEqual({ state: 'unknown', title: 'Openingstijden onbekend', meta: 'niet bekend in OpenStreetMap' });
  });
});

describe('shownBrands', () => {
  test('in fixed order, only the switched-on ones', () => {
    expect(shownBrands({ showMcDonalds: true, showKfc: false, showBurgerKing: true })).toEqual(['mcdonalds', 'burgerking']);
    expect(shownBrands({ showMcDonalds: false, showKfc: false, showBurgerKing: false })).toEqual([]);
  });
});

describe('restaurantAddress', () => {
  test('street + number, then postcode + city', () => {
    const base = { osmId: 'node/1', brand: 'kfc' as const, location: { type: 'Point' as const, coordinates: [5, 52] as [number, number] }, updatedAt: '' };
    expect(restaurantAddress({ ...base, street: 'Rijnstraat', houseNumber: '36', postcode: '6811EW', city: 'Arnhem' })).toEqual({ line1: 'Rijnstraat 36', line2: '6811 EW Arnhem' });
    expect(restaurantAddress({ ...base, city: 'Arnhem' })).toEqual({ line1: undefined, line2: 'Arnhem' });
  });
});
```

Run: `npx --yes bun test src/lib/fastfood.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/lib/fastfood.ts`:

```ts
import { formatClock } from './format';
import type { Brand, FastfoodRestaurant } from '@/types/Fastfood';

export type { Brand } from '@/types/Fastfood';

export const BRANDS: Brand[] = ['mcdonalds', 'kfc', 'burgerking'];
export const BRAND_LABEL: Record<Brand, string> = { mcdonalds: "McDonald's", kfc: 'KFC', burgerking: 'Burger King' };
/** Marker tile and popup icon fill */
export const BRAND_COLOR: Record<Brand, string> = { mcdonalds: '#DB0007', kfc: '#E4002B', burgerking: '#F5EBDC' };
/** Tooltip dot (Burger King's cream tile colour is invisible as a dot) */
export const BRAND_DOT: Record<Brand, string> = { mcdonalds: '#DB0007', kfc: '#E4002B', burgerking: '#D62300' };

export type FastfoodState = 'open' | 'closing' | 'closed' | 'unknown';

export interface FastfoodStatus {
  state: FastfoodState;
  /** Bold status row text, e.g. "Open tot 01:30" */
  title: string;
  /** Second line, e.g. "nog 1 u 50 min" */
  meta: string;
  /** Tooltip text, absent when unknown */
  short?: string;
}

/** Open but closing within this: orange */
export const CLOSING_SOON_MS = 30 * 60_000;
/** An open interval ending further away than this is the window's end (24/7) */
const ALWAYS_OPEN_MS = 6 * 24 * 60 * 60_000;
const ZONE = 'Europe/Amsterdam';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const weekday = new Intl.DateTimeFormat('nl-NL', { timeZone: ZONE, weekday: 'long' });

function formatLeft(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} u ${rest} min` : `${hours} u`;
}

/** "vandaag", "morgen" or the weekday of `ms`, seen from `nowMs` (Dutch calendar days). */
function dayLabel(ms: number, nowMs: number): string {
  const days = Math.round((Date.parse(dayKey.format(ms)) - Date.parse(dayKey.format(nowMs))) / 86_400_000);
  if (days <= 0) return 'vandaag';
  if (days === 1) return 'morgen';
  return weekday.format(ms);
}

/** Open / closing soon / closed (and when it opens) / unknown, from the server's open intervals. */
export function fastfoodStatus(intervals: FastfoodRestaurant['intervals'], nowMs: number): FastfoodStatus {
  if (!intervals) return { state: 'unknown', title: 'Openingstijden onbekend', meta: 'niet bekend in OpenStreetMap' };
  const parsed = intervals.map(({ start, end }) => ({ start: Date.parse(start), end: Date.parse(end) }));
  const current = parsed.find(({ start, end }) => start <= nowMs && nowMs < end);
  if (current) {
    const left = current.end - nowMs;
    if (left > ALWAYS_OPEN_MS) return { state: 'open', title: 'Dag en nacht open', meta: 'de hele week', short: 'dag en nacht open' };
    const clock = formatClock(current.end);
    if (left <= CLOSING_SOON_MS) return { state: 'closing', title: `Sluit om ${clock}`, meta: `nog ${formatLeft(left)}`, short: `sluit om ${clock}` };
    return { state: 'open', title: `Open tot ${clock}`, meta: `nog ${formatLeft(left)}`, short: `open tot ${clock}` };
  }
  const next = parsed.filter(({ start }) => start > nowMs).sort((a, b) => a.start - b.start)[0];
  if (!next) return { state: 'closed', title: 'Dicht', meta: 'opent niet in de komende week', short: 'dicht' };
  return { state: 'closed', title: 'Dicht', meta: `opent ${dayLabel(next.start, nowMs)} ${formatClock(next.start)}`, short: 'dicht' };
}

/** The brands whose layer is on, in menu order. */
export function shownBrands(flags: { showMcDonalds: boolean; showKfc: boolean; showBurgerKing: boolean }): Brand[] {
  return BRANDS.filter((brand) => (brand === 'mcdonalds' ? flags.showMcDonalds : brand === 'kfc' ? flags.showKfc : flags.showBurgerKing));
}

/** "Rijnstraat 36" and "6811 EW Arnhem" (a Dutch postcode gets its space). */
export function restaurantAddress(restaurant: FastfoodRestaurant): { line1?: string; line2?: string } {
  const line1 = [restaurant.street, restaurant.houseNumber].filter(Boolean).join(' ') || undefined;
  const postcode = restaurant.postcode?.replace(/^(\d{4})\s*([A-Za-z]{2})$/, '$1 $2');
  const line2 = [postcode, restaurant.city].filter(Boolean).join(' ') || undefined;
  return { line1, line2 };
}
```

- [ ] **Step 4: Run tests**

Run: `npx --yes bun test src/lib/fastfood.test.ts`
Expected: PASS. (`formatClock` already formats in Europe/Amsterdam, so the test is device-time-zone independent.)

- [ ] **Step 5: Lint + commit**

Run: `npx --yes eslint src/lib/fastfood.ts src/lib/fastfood.test.ts src/types/Fastfood.ts`

```bash
git add src/types/Fastfood.ts src/lib/fastfood.ts src/lib/fastfood.test.ts
git commit -m "feat(fastfood): brand constants and opening status texts"
```

---

### Task 4: Layer switches, menu rows and data hook

**Files:**
- Modify: `src/stores/layers.store.ts`
- Modify: `src/components/settings/layer-toggles.ts`
- Create: `src/hooks/fastfood.hook.ts`
- Modify: `src/lib/response-shape.ts` (+ `/fastfood` in `LIST_PATHS`)
- Test: `src/lib/response-shape.test.ts`

**Interfaces:**
- Consumes: `FastfoodRestaurant` (Task 3).
- Produces: store fields `showMcDonalds`, `showKfc`, `showBurgerKing` (default `false`) + `toggleMcDonalds`, `toggleKfc`, `toggleBurgerKing`; `useFastfood(enabled: boolean): FastfoodRestaurant[] | undefined`.

- [ ] **Step 1: Failing shape test**

Add to `src/lib/response-shape.test.ts` (inside the existing top-level describe or as a new one; import `hasExpectedShape` is already there):

```ts
test('/fastfood must be a list', () => {
  expect(hasExpectedShape('/fastfood', [])).toBe(true);
  expect(hasExpectedShape('/fastfood', { message: 'x' })).toBe(false);
});
```

Run: `npx --yes bun test src/lib/response-shape.test.ts` → FAIL (an object passes).

- [ ] **Step 2: Add `'/fastfood'` to `LIST_PATHS`** in `src/lib/response-shape.ts` (after `'/teams'`). Run the test → PASS.

- [ ] **Step 3: Store**

In `src/stores/layers.store.ts` add to `LayersState`:

```ts
  showMcDonalds: boolean;
  showKfc: boolean;
  showBurgerKing: boolean;
  toggleMcDonalds: () => void;
  toggleKfc: () => void;
  toggleBurgerKing: () => void;
```

and to the store body (after `showBuildings3d: true,` and after `toggleBuildings3d`):

```ts
      // Fastfood layers: off until someone wants food (persist's merge gives existing users these defaults)
      showMcDonalds: false,
      showKfc: false,
      showBurgerKing: false,
```

```ts
      toggleMcDonalds: () => {
        set((state) => ({ showMcDonalds: !state.showMcDonalds }));
      },
      toggleKfc: () => {
        set((state) => ({ showKfc: !state.showKfc }));
      },
      toggleBurgerKing: () => {
        set((state) => ({ showBurgerKing: !state.showBurgerKing }));
      },
```

No version bump: zustand's persist merges stored state over these defaults, so the new keys start `false` for everyone.

- [ ] **Step 4: Menu rows**

In `src/components/settings/layer-toggles.ts`, add the six new fields to the `useShallow` selector and push three rows at the very end of `useLayerToggles` (after the Life360 row):

```ts
  toggles.push(
    { id: 'mcdonalds', label: "McDonald's", checked: layers.showMcDonalds, toggle: layers.toggleMcDonalds },
    { id: 'kfc', label: 'KFC', checked: layers.showKfc, toggle: layers.toggleKfc },
    { id: 'burgerking', label: 'Burger King', checked: layers.showBurgerKing, toggle: layers.toggleBurgerKing },
  );
```

- [ ] **Step 5: Hook**

`src/hooks/fastfood.hook.ts`:

```ts
import { asList } from '@/lib/response-shape';
import { useAuthSWR } from '@/lib/swr';
import type { FastfoodRestaurant } from '@/types/Fastfood';

/** The server recomputes the intervals every 10 minutes; the list itself changes once a day */
const REFRESH_MS = 30 * 60_000;

/** McDonald's / KFC / Burger King for the map; nothing is fetched while no fastfood layer is on. */
export function useFastfood(enabled: boolean): FastfoodRestaurant[] | undefined {
  const { data } = useAuthSWR<FastfoodRestaurant[]>(enabled ? '/fastfood' : null, { refreshInterval: REFRESH_MS, revalidateOnFocus: false });
  return enabled ? asList(data) : undefined;
}
```

- [ ] **Step 6: Typecheck, lint, tests, commit**

Run: `npx --yes tsc -b && npx --yes eslint src/stores src/components/settings src/hooks/fastfood.hook.ts src/lib/response-shape.ts && npx --yes bun test`

```bash
git add src/stores/layers.store.ts src/components/settings/layer-toggles.ts src/hooks/fastfood.hook.ts src/lib/response-shape.ts src/lib/response-shape.test.ts
git commit -m "feat(fastfood): layer switches (off by default), menu rows and data hook"
```

---

### Task 5: Fastfood marker icon with the real logos

**Files:**
- Create: `src/assets/brands/mcdonalds.svg`, `src/assets/brands/kfc.svg`, `src/assets/brands/burgerking.svg`
- Create: `src/components/layers/brand-logos.ts`
- Modify: `src/lib/marker-style.ts` (key, id, parse)
- Modify: `src/components/layers/marker-icons.ts` (drawing)
- Test: `src/lib/marker-style.test.ts`

**Interfaces:**
- Consumes: `Brand`, `BRANDS`, `BRAND_COLOR` (Task 3).
- Produces:
  - `MarkerIconKey` member `{ kind: 'fastfood'; brand: Brand; closed: boolean }`, id `fastfood|<brand>|open|closed`
  - `BRAND_LOGO_URL: Record<Brand, string>`, `FASTFOOD_LOGO_WIDTH: Record<Brand, number>`, `brandLogo(brand): HTMLImageElement | undefined`, `loadBrandLogos(): Promise<void>`, `useBrandLogosReady(): boolean`

- [ ] **Step 1: Logos**

```bash
mkdir -p src/assets/brands
S="/home/silke/Documents/Jotihunt 2026/.superpowers/brainstorm/98339-1792416537/content"
cp "$S/mcd.svg" src/assets/brands/mcdonalds.svg
cp "$S/kfc.svg" src/assets/brands/kfc.svg
cp "$S/bk.svg" src/assets/brands/burgerking.svg
```

The KFC file has no `width`/`height` on its root `<svg>` (Firefox draws such SVGs at 0×0 on a canvas). Add them: in `src/assets/brands/kfc.svg` change `<svg version="1.1" id="Слой_1"` to `<svg version="1.1" id="kfc" width="1000" height="928"`. Check: `grep -c 'width="1000" height="928"' src/assets/brands/kfc.svg` → `1`.

(Sources: Wikimedia Commons `McDonald's_Golden_Arches.svg`, `KFC_Logo_2026.svg`, `Burger_King_2020.svg`; trademarks of their owners, used to mark the restaurants.)

- [ ] **Step 2: Failing marker-style tests**

Add to `src/lib/marker-style.test.ts` (imports `markerIconId`, `parseMarkerImageId`, `themedImageId` already exist there):

```ts
describe('fastfood icon ids', () => {
  test('id format', () => {
    expect(markerIconId({ kind: 'fastfood', brand: 'kfc', closed: false })).toBe('fastfood|kfc|open');
    expect(markerIconId({ kind: 'fastfood', brand: 'burgerking', closed: true })).toBe('fastfood|burgerking|closed');
  });
  test('round trip', () => {
    for (const brand of ['mcdonalds', 'kfc', 'burgerking'] as const) {
      for (const closed of [false, true]) {
        const key = { kind: 'fastfood' as const, brand, closed };
        expect(parseMarkerImageId(themedImageId('dark', markerIconId(key)))).toEqual({ theme: 'dark', key });
      }
    }
  });
  test('unknown brand or state is not ours', () => {
    expect(parseMarkerImageId('jh|light|fastfood|subway|open')).toBeUndefined();
    expect(parseMarkerImageId('jh|light|fastfood|kfc|maybe')).toBeUndefined();
  });
});
```

Run: `npx --yes bun test src/lib/marker-style.test.ts` → FAIL (type error / wrong id).

- [ ] **Step 3: `marker-style.ts`**

Add the import at the top: `import { BRANDS, type Brand } from './fastfood';`

Add to the `MarkerIconKey` union:

```ts
  | { kind: 'fastfood'; brand: Brand; closed: boolean }
```

In `markerIconId`, before `default:`:

```ts
    case 'fastfood':
      return `fastfood|${key.brand}|${key.closed ? 'closed' : 'open'}`;
```

In `parseKey`, before `case 'hintdot':`:

```ts
    case 'fastfood':
      return p.length === 3 && (BRANDS as readonly string[]).includes(p[1]) && (p[2] === 'open' || p[2] === 'closed')
        ? { kind: 'fastfood', brand: p[1] as Brand, closed: p[2] === 'closed' }
        : undefined;
```

Run the test → PASS. (If `lib/fastfood.ts` importing `./format` creates an import cycle warning, there is none: `format.ts` imports nothing from these files.)

- [ ] **Step 4: `brand-logos.ts`**

```ts
import { useEffect, useState } from 'react';
import burgerkingUrl from '@/assets/brands/burgerking.svg?url';
import kfcUrl from '@/assets/brands/kfc.svg?url';
import mcdonaldsUrl from '@/assets/brands/mcdonalds.svg?url';
import { BRANDS, type Brand } from '@/lib/fastfood';

export const BRAND_LOGO_URL: Record<Brand, string> = { mcdonalds: mcdonaldsUrl, kfc: kfcUrl, burgerking: burgerkingUrl };
/** Logo width on the 28px marker tile (the popup's 36px icon uses these + 4) */
export const FASTFOOD_LOGO_WIDTH: Record<Brand, number> = { mcdonalds: 15, kfc: 17, burgerking: 19 };

const images = new Map<Brand, HTMLImageElement>();
let loading: Promise<void> | undefined;

/** Load the three logos once; a logo that fails to load is left out (the tile is drawn without it). */
export function loadBrandLogos(): Promise<void> {
  loading ??= Promise.all(
    BRANDS.map(
      (brand) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => {
            images.set(brand, image);
            resolve();
          };
          image.onerror = () => resolve();
          image.src = BRAND_LOGO_URL[brand];
        }),
    ),
  ).then(() => undefined);
  return loading;
}

/** The loaded logo for the canvas marker, undefined before loadBrandLogos finished. */
export function brandLogo(brand: Brand): HTMLImageElement | undefined {
  return images.get(brand);
}

/** True once the logos are loaded: the fastfood layer waits for it, so its icons are never drawn without logo. */
export function useBrandLogosReady(): boolean {
  const [ready, setReady] = useState(() => loading !== undefined && images.size > 0);
  useEffect(() => {
    let cancelled = false;
    void loadBrandLogos().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}
```

- [ ] **Step 5: Drawing in `marker-icons.ts`**

Imports: add `import { BRAND_COLOR } from '@/lib/fastfood';` and `import { brandLogo, FASTFOOD_LOGO_WIDTH } from './brand-logos';`.

Give `roundedSquare` a corner radius parameter (defaults keep the fox markers unchanged):

```ts
  /** Square with `radius` corners (14px: fox markers) at (0, 0) with rim and shadow. */
  roundedSquare(size: number, fill: string, radius = 14) {
    const { ctx } = this;
    this.shadow(3, 1);
    ctx.fillStyle = this.palette.surfaceContainerLowest;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();
    this.noShadow();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(RIM, RIM, size - 2 * RIM, size - 2 * RIM, radius - RIM);
    ctx.fill();
  }
```

Next to `GROUP_SIZE`: `const FASTFOOD_SIZE = 28;`

In `drawing()`, before `case 'hint':`:

```ts
    case 'fastfood': {
      const logo = brandLogo(key.brand);
      return {
        width: FASTFOOD_SIZE + 2 * PAD,
        height: FASTFOOD_SIZE + 2 * PAD,
        draw: (p) => {
          const s = FASTFOOD_SIZE;
          p.ctx.translate(PAD, PAD);
          p.roundedSquare(s, BRAND_COLOR[key.brand], 9);
          if (!logo) return;
          const width = FASTFOOD_LOGO_WIDTH[key.brand];
          const height = logo.naturalWidth ? (width * logo.naturalHeight) / logo.naturalWidth : width;
          p.ctx.drawImage(logo, (s - width) / 2, (s - height) / 2, width, height);
        },
      };
    }
```

Below `fadeImage` add:

```ts
/** Closed restaurants: greyscale (luminance), like the CSS grayscale() of the mockups. */
function greyImage(image: ImageData) {
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const grey = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = grey;
  }
}

const CLOSED_ALPHA = 0.6;
```

In `drawMarkerIcon`, after `if (isLocked(key)) fadeImage(image, LOCKED_ALPHA);`:

```ts
  if (key.kind === 'fastfood' && key.closed) {
    greyImage(image);
    fadeImage(image, CLOSED_ALPHA);
  }
```

- [ ] **Step 6: Typecheck, lint, tests, commit**

Run: `npx --yes tsc -b && npx --yes eslint src/lib/marker-style.ts src/components/layers/marker-icons.ts src/components/layers/brand-logos.ts && npx --yes bun test`
Expected: clean (the `?url` imports are typed by `vite/client`), all PASS.

```bash
git add src/assets/brands src/components/layers/brand-logos.ts src/lib/marker-style.ts src/lib/marker-style.test.ts src/components/layers/marker-icons.ts
git commit -m "feat(fastfood): brand tile marker icon with the real logos"
```

---

### Task 6: FastFood layer, tooltip and popup

**Files:**
- Create: `src/components/layers/FastFood.tsx`
- Create: `src/components/layers/fastfood/FastFoodPopup.tsx`
- Create: `src/components/layers/fastfood/FastFoodTooltip.tsx`
- Modify: `src/lib/map-layers.ts` (`FASTFOOD_LAYER`, stack, `fastfoodFeatures`)
- Modify: `src/components/Map.tsx` (interactive layer ids, render `<FastFood/>`)
- Test: `src/lib/map-layers.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: `FASTFOOD_LAYER = 'fastfood'`, `fastfoodFeatures(restaurants: FastfoodRestaurant[], brands: Brand[], nowMs: number): FeatureCollection<Point, { id: string; icon: string }>`.

- [ ] **Step 1: Failing test for the features**

Add to `src/lib/map-layers.test.ts` (add `fastfoodFeatures` to the import from `./map-layers`):

```ts
describe('fastfoodFeatures', () => {
  const NOW = Date.parse('2026-10-17T23:40:00+02:00');
  const base = { location: { type: 'Point' as const, coordinates: [5.9, 51.98] as [number, number] }, updatedAt: '' };
  const restaurants = [
    { ...base, osmId: 'node/1', brand: 'mcdonalds' as const, intervals: [{ start: '2026-10-17T06:30:00.000Z', end: '2026-10-17T23:30:00.000Z' }] },
    { ...base, osmId: 'node/2', brand: 'kfc' as const, intervals: [] },
    { ...base, osmId: 'node/3', brand: 'burgerking' as const },
  ];
  test('only shown brands; closed when the status is closed, unknown stays open', () => {
    const features = fastfoodFeatures(restaurants, ['mcdonalds', 'kfc', 'burgerking'], NOW).features;
    expect(features.map((feature) => [feature.properties.id, feature.properties.icon])).toEqual([
      ['node/1', 'fastfood|mcdonalds|open'],
      ['node/2', 'fastfood|kfc|closed'],
      ['node/3', 'fastfood|burgerking|open'],
    ]);
    expect(fastfoodFeatures(restaurants, ['kfc'], NOW).features.map((feature) => feature.properties.id)).toEqual(['node/2']);
  });
});
```

Run: `npx --yes bun test src/lib/map-layers.test.ts` → FAIL (not exported).

- [ ] **Step 2: `map-layers.ts`**

Imports: add `import { fastfoodStatus, type Brand } from '@/lib/fastfood';` and `import type { FastfoodRestaurant } from '@/types/Fastfood';`.

Constants next to `TEAM_PINS_LAYER`:

```ts
/** Symbol layer with the fastfood tiles (McDonald's, KFC, Burger King); clicks open the restaurant popup. */
export const FASTFOOD_LAYER = 'fastfood';
/** The hovered restaurant, 10% larger. */
export const FASTFOOD_HOVER_LAYER = 'fastfood-hover';
```

In `MAP_LAYER_STACK`, insert two groups before `[TEAM_PINS_LAYER]` (fastfood under every game marker):

```ts
  [FASTFOOD_LAYER],
  [FASTFOOD_HOVER_LAYER],
```

Below `teamPinFeatures`:

```ts
/** One tile per restaurant of a shown brand; grey when closed now (unknown hours stay in colour). */
export function fastfoodFeatures(restaurants: FastfoodRestaurant[], brands: Brand[], nowMs: number): FeatureCollection<Point, { id: string; icon: string }> {
  return collection(
    restaurants
      .filter((restaurant) => brands.includes(restaurant.brand))
      .map((restaurant) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: restaurant.location.coordinates },
        properties: {
          id: restaurant.osmId,
          icon: markerIconId({ kind: 'fastfood', brand: restaurant.brand, closed: fastfoodStatus(restaurant.intervals, nowMs).state === 'closed' }),
        },
      })),
  );
}
```

Run the map-layers tests → PASS (if an existing test pins the exact `MAP_LAYER_STACK`, update its expectation to include the two new groups before `team-pins`).

- [ ] **Step 3: Tooltip**

`src/components/layers/fastfood/FastFoodTooltip.tsx`:

```tsx
import MapTooltip from '@/components/map/MapTooltip';
import { BRAND_DOT, BRAND_LABEL, fastfoodStatus } from '@/lib/fastfood';
import type { FastfoodRestaurant } from '@/types/Fastfood';

// Above the hovered tile (28px, centred)
const TOOLTIP_OFFSET: [number, number] = [0, -20];

/** Hover tooltip of a restaurant: brand dot, "McDonald's Arnhem Rijnstraat", status ("open tot 01:30"). */
export default function FastFoodTooltip({ restaurant, nowMs }: { restaurant: FastfoodRestaurant; nowMs: number }) {
  const [lng, lat] = restaurant.location.coordinates;
  return (
    <MapTooltip
      longitude={lng}
      latitude={lat}
      offset={TOOLTIP_OFFSET}
      color={BRAND_DOT[restaurant.brand]}
      title={[BRAND_LABEL[restaurant.brand], restaurant.branch].filter(Boolean).join(' ')}
      meta={fastfoodStatus(restaurant.intervals, nowMs).short}
    />
  );
}
```

- [ ] **Step 4: Popup (option A)**

`src/components/layers/fastfood/FastFoodPopup.tsx`:

```tsx
import { CarIcon, ClockIcon, MapPinIcon, PhoneIcon } from 'lucide-react';
import MapPopup from '../../map/MapPopup';
import { ICON_ACTION, PopupActions, popupActionClass, RouteAction } from '../../map/popup/PopupActions';
import PopupHeader, { PopupIcon } from '../../map/popup/PopupHeader';
import { PopupRow, PopupRows, type RowTone } from '../../map/popup/PopupRows';
import { FadeSwap } from '@/components/beheer/BeheerLayout';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { BRAND_COLOR, BRAND_LABEL, fastfoodStatus, restaurantAddress, type FastfoodState } from '@/lib/fastfood';
import { joinParts } from '@/lib/format';
import type { FastfoodRestaurant } from '@/types/Fastfood';
import { BRAND_LOGO_URL, FASTFOOD_LOGO_WIDTH } from '../brand-logos';

// Above the tile (28px square, centred)
const POPUP_OFFSET = { bottom: [0, -18] as [number, number] };

const TONE: Record<FastfoodState, RowTone> = { open: 'success', closing: 'warn', closed: 'danger', unknown: 'default' };

/** A restaurant: opening status (green / orange / red / unknown), address, drive-thru, Route and call. */
export default function FastFoodPopup({ restaurant, nowMs, onClose }: { restaurant: FastfoodRestaurant; nowMs: number; onClose: () => void }) {
  const [lng, lat] = restaurant.location.coordinates;
  const distance = useDistanceFromMe(lat, lng);
  const status = fastfoodStatus(restaurant.intervals, nowMs);
  const { line1, line2 } = restaurantAddress(restaurant);

  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={POPUP_OFFSET}>
      <PopupHeader
        icon={
          <PopupIcon shape="square" rim background={BRAND_COLOR[restaurant.brand]} color="#fff">
            <img src={BRAND_LOGO_URL[restaurant.brand]} alt="" width={FASTFOOD_LOGO_WIDTH[restaurant.brand] + 4} />
          </PopupIcon>
        }
        title={BRAND_LABEL[restaurant.brand]}
        subtitle={joinParts(restaurant.branch, distance)}
      />
      <PopupRows>
        <PopupRow icon={<ClockIcon />} tone={TONE[status.state]} title={<FadeSwap>{status.title}</FadeSwap>} meta={<FadeSwap>{status.meta}</FadeSwap>} />
        {(line1 || line2) && <PopupRow icon={<MapPinIcon />} title={line1 ?? line2} meta={line1 ? line2 : undefined} />}
        {restaurant.driveThrough !== undefined && <PopupRow icon={<CarIcon />} title={restaurant.driveThrough ? 'Drive-thru' : 'Geen drive-thru'} />}
      </PopupRows>
      <PopupActions>
        <RouteAction lat={lat} lng={lng} />
        {restaurant.phone && (
          <a href={`tel:${restaurant.phone.replace(/\s+/g, '')}`} aria-label={`Bel ${BRAND_LABEL[restaurant.brand]}`} title="Bellen" className={popupActionClass('neutral', ICON_ACTION)}>
            <PhoneIcon />
          </a>
        )}
      </PopupActions>
    </MapPopup>
  );
}
```

(`joinParts` skips undefined parts — check `src/lib/format.ts`; it is already used this way in `DevicePopup`.)

- [ ] **Step 5: Layer**

`src/components/layers/FastFood.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Layer, Source, useMap, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import { useShallow } from 'zustand/react/shallow';
import { useFastfood } from '@/hooks/fastfood.hook';
import { useNow } from '@/hooks/now.hook';
import { shownBrands } from '@/lib/fastfood';
import { FASTFOOD_HOVER_LAYER, FASTFOOD_LAYER, fastfoodFeatures } from '@/lib/map-layers';
import { themedIconExpression } from '@/lib/marker-style';
import useLayersStore from '@/stores/layers.store';
import { useBrandLogosReady } from './brand-logos';
import { featureId, useLayerInteractions, usePopupSelection } from './map-interactions';
import { useMarkerTheme } from './marker-icons';
import FastFoodPopup from './fastfood/FastFoodPopup';
import FastFoodTooltip from './fastfood/FastFoodTooltip';

const FASTFOOD_SOURCE = 'fastfood';
const INTERACTIVE_LAYERS = [FASTFOOD_LAYER];
/** Open/closed is re-evaluated every minute */
const TICK_MS = 60_000;

/**
 * McDonald's, KFC and Burger King as brand tiles (one GeoJSON source + symbol layer, like the groups). Waits for the
 * logos, so no icon is drawn without one; fetches only while at least one brand is on.
 */
export default function FastFood() {
  const flags = useLayersStore(useShallow((state) => ({ showMcDonalds: state.showMcDonalds, showKfc: state.showKfc, showBurgerKing: state.showBurgerKing })));
  const brands = useMemo(() => shownBrands(flags), [flags]);
  const restaurants = useFastfood(brands.length > 0);
  const logosReady = useBrandLogosReady();
  const nowMs = useNow(true, TICK_MS);
  const map = useMap().current?.getMap();
  const theme = useMarkerTheme();
  const layout = useMemo<SymbolLayerSpecification['layout']>(() => ({ 'icon-image': themedIconExpression(theme), 'icon-allow-overlap': true, 'icon-ignore-placement': true }), [theme]);
  const hoverLayout = useMemo<SymbolLayerSpecification['layout']>(() => ({ ...layout, 'icon-size': 1.1 }), [layout]);

  const { active, open: openPopup, close: closePopup, dismiss: dismissPopup } = usePopupSelection<string>();
  const [hoveredId, setHoveredId] = useState<string>();
  const activeRestaurant = active ? restaurants?.find((restaurant) => restaurant.osmId === active.id && brands.includes(restaurant.brand)) : undefined;
  const hoveredRestaurant = hoveredId !== undefined && !activeRestaurant ? restaurants?.find((restaurant) => restaurant.osmId === hoveredId) : undefined;

  const features = useMemo(() => fastfoodFeatures(restaurants ?? [], brands, nowMs), [restaurants, brands, nowMs]);
  const hoverFilter = useMemo<SymbolLayerSpecification['filter']>(() => ['==', ['get', 'id'], hoveredId ?? ''], [hoveredId]);

  useLayerInteractions(map, INTERACTIVE_LAYERS, {
    onClick: (feature) => {
      const id = featureId(feature);
      const restaurant = typeof id === 'string' ? restaurants?.find((candidate) => candidate.osmId === id) : undefined;
      if (!restaurant) return;
      setHoveredId(undefined);
      if (restaurant.osmId === activeRestaurant?.osmId) {
        dismissPopup();
        return;
      }
      openPopup(restaurant.osmId);
      map?.easeTo({ center: restaurant.location.coordinates, duration: 600 });
    },
    onHover: (feature) => {
      const id = featureId(feature);
      setHoveredId(typeof id === 'string' ? id : undefined);
    },
  });

  if (!brands.length || !logosReady) return null;
  return (
    <>
      <Source id={FASTFOOD_SOURCE} type="geojson" data={features}>
        <Layer id={FASTFOOD_LAYER} type="symbol" source={FASTFOOD_SOURCE} layout={layout} />
        <Layer id={FASTFOOD_HOVER_LAYER} type="symbol" source={FASTFOOD_SOURCE} layout={hoverLayout} filter={hoverFilter} />
      </Source>
      {hoveredRestaurant && <FastFoodTooltip restaurant={hoveredRestaurant} nowMs={nowMs} />}
      {activeRestaurant && <FastFoodPopup key={active!.opened} restaurant={activeRestaurant} nowMs={nowMs} onClose={closePopup} />}
    </>
  );
}
```

Check `usePopupSelection`/`featureId` exports in `map-interactions.ts` match this use (they are used identically in `Teams.tsx`).

- [ ] **Step 6: Wire into `Map.tsx`**

- Add `FASTFOOD_LAYER` to the `@/lib/map-layers` import and to `INTERACTIVE_LAYER_IDS` (so a tile click doesn't also open the picked-location popup).
- `import FastFood from './layers/FastFood';`
- Render `<FastFood/>` right after `{showTeams && <Teams/>}` (it hides itself when no brand is on).

- [ ] **Step 7: Typecheck, lint, tests**

Run: `npx --yes tsc -b && npx --yes eslint src/components/layers src/components/Map.tsx src/lib/map-layers.ts && npx --yes bun test`
Expected: clean, all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/layers/FastFood.tsx src/components/layers/fastfood src/lib/map-layers.ts src/lib/map-layers.test.ts src/components/Map.tsx
git commit -m "feat(fastfood): McDonald's, KFC and Burger King map layers with status popup"
```

---

### Task 7: End-to-end check

**Files:** none (fixes go in the task they belong to, as extra commits).

- [ ] **Step 1: Local stack**

Server worktree (`feat/fastfood`) on a throwaway DB and port; never touch the docker stack:

```bash
cd "/home/silke/Documents/Jotihunt 2026/.worktrees/server-fastfood"
PORT=3170 MONGO_URI=mongodb://localhost:27017/jotihunt-fastfood-e2e JOTIHUNT_API_URL=http://127.0.0.1:9 npx --yes bun run src/index.ts
```

(Copy the other env vars from the server's `.env` as for earlier E2E runs; create a login with `npx --yes bun run login-link`.) Wait for the log line `Fastfood refreshed: N restaurants`.

Client worktree: `API_BASE_URL=http://localhost:3170 npx --yes vite --port 5190`.

- [ ] **Step 2: Check in the browser (preview tools)**

- Layers menu (desktop popover and phone settings menu): three new rows, all off; turning one on shows only that brand; network shows one `GET /fastfood`, none while all are off.
- Tiles: real logos, white rim, grey when closed; hover enlarges and shows the tooltip; game markers draw above them.
- Popup: each status (find an open, a closing, a closed and an unknown restaurant, or temporarily fake `nowMs`); status row colour + text fade on change; Route opens Google Maps directions; call button only with a phone number; docked on 390px width.
- Dark mode: tiles, popup rows, buttons readable.
- All other popups (Task 2) once more in both themes.

- [ ] **Step 3: Report**

Summarise numbers (restaurant count, with/without hours) and screenshots to the user; then follow superpowers:finishing-a-development-branch (merge + deploy only with the user's approval: server before client, homelab PRs as usual).
