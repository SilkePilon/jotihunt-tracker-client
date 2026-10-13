# Map popups and tooltips redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all map popups (picked location, group, hunter, fox marker, Life360) as compact M3 cards (style A) and all hover tooltips as one-line labels (style 1), matching the Android-style markers.

**Architecture:** Map-surface colours become CSS variables in `src/index.css` (light + `body.dark`), mirroring `MARKER_PALETTES`. A small set of popup building blocks in `src/components/map/popup/` (header, icon, facts, coordinate rows, action buttons) is shared by the five popups. A `useDistanceFromMe` hook gives the "2,4 km van jou" subtitle from the user's own tracker position or an already-granted browser position. `MapTooltip` switches from free children to `{ color, title, meta }`.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (`bg-(--var)` syntax), react-map-gl/maplibre, lucide-react, bun test.

Spec: `docs/superpowers/specs/2026-10-13-map-popups-tooltips-design.md`.
Mockups: `/home/silke/Documents/Jotihunt 2026/.superpowers/brainstorm/3595344-1791900905/content/popups-a-v2.html` (popups) and `tooltips.html` (row 1).

## Global Constraints

- Work in worktree `/home/silke/Documents/Jotihunt 2026/.worktrees/client-popups`, branch `feat/popup-redesign`. All paths below are relative to it.
- First time only: `npx --yes bun install` (the worktree has no `node_modules`).
- `bun` is not on PATH: tests `npx --yes bun test <file>`, types `npx --yes bun x tsc -b`, lint `npx --yes bun run lint`.
- Never restart or touch the docker stack (server :3000, client :8080) — it is the user's live instance. Never `pkill -f`.
- All UI copy Dutch, exactly as written in this plan.
- Font everywhere in popups/tooltips: `"Google Sans Flex", "Google Sans", Roboto, system-ui, sans-serif`.
- Popup width 236px (216px content + 2×10px padding), radius 16px. Tooltip radius 10px, padding 6px 10px.
- Distance subtitle text: `"<n> m van jou"` below 1000 m, `"<n,n> km van jou"` from 1000 m, hidden below 20 m or when unknown.
- Labels: "Hunt" / "Spot" (not "Vos hunt" / "Vos spot").
- Code style: match surrounding files (2-space, single quotes in newer files; `MapPopup.tsx` and `PickedLocationPopup.tsx` are rewritten in that style).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/format.ts` (modify) | `formatDistanceFromMe`, `joinParts` |
| `src/lib/own-position.ts` (create) | pure: `ownTrackerPosition`, `distanceMetres`, `LatLng` |
| `src/hooks/distance-from-me.hook.ts` (create) | `useDistanceFromMe(lat, lng)` |
| `src/index.css` (modify) | `--map-*` variables, popup chrome |
| `src/components/map/MapPopup.tsx` (rewrite) | popup wrapper, fixed width |
| `src/components/map/popup/PopupHeader.tsx` (create) | header + `PopupIcon` |
| `src/components/map/popup/MarkerGlyph.tsx` (create) | Material Symbol as inline SVG |
| `src/components/map/popup/PopupFacts.tsx` (create) | `PopupFacts`, `PopupFact`, `FactDot` |
| `src/components/map/popup/CoordRows.tsx` (create) | WGS84 + RD rows with copy / hint |
| `src/components/map/popup/PopupActions.tsx` (create) | `PopupActions`, `popupActionClass`, `MapsAction` |
| `src/components/CopyButton.tsx` (modify) | optional `variant` |
| `src/components/map/MarkerRegistration.tsx` (modify) | compact Hunt / Spot buttons |
| `src/components/map/VisitControls.tsx` (modify) | connected 3-way group |
| 5 popups (modify) | use the building blocks |
| `src/components/map/MapTooltip.tsx` + 4 tooltips (modify) | one-line tooltip |
| `src/components/map/GoogleMapsButton.tsx` (delete) | replaced by `MapsAction` |

---

### Task 1: Pure helpers (distance text, own position)

**Files:**
- Modify: `src/lib/format.ts` (append)
- Modify: `src/lib/format.test.ts` (append)
- Create: `src/lib/own-position.ts`
- Create: `src/lib/own-position.test.ts`

**Interfaces:**
- Produces:
  - `formatDistanceFromMe(metres: number | undefined): string | undefined`
  - `joinParts(...parts: (string | false | null | undefined)[]): string`
  - `interface LatLng { lat: number; lng: number }`
  - `distanceMetres(a: LatLng, b: LatLng): number`
  - `ownTrackerPosition(positions: Position[] | undefined, deviceId: number | undefined, now: number): LatLng | undefined`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/format.test.ts` (and add `formatDistanceFromMe, joinParts` to its import from `./format`):

```ts
describe('formatDistanceFromMe', () => {
  test('hidden when unknown or under 20 m', () => {
    expect(formatDistanceFromMe(undefined)).toBeUndefined();
    expect(formatDistanceFromMe(Number.NaN)).toBeUndefined();
    expect(formatDistanceFromMe(0)).toBeUndefined();
    expect(formatDistanceFromMe(19.9)).toBeUndefined();
  });

  test('metres below 1 km, km with a Dutch comma from 1 km', () => {
    expect(formatDistanceFromMe(20)).toBe('20 m van jou');
    expect(formatDistanceFromMe(349.6)).toBe('350 m van jou');
    expect(formatDistanceFromMe(999)).toBe('999 m van jou');
    expect(formatDistanceFromMe(1000)).toBe('1,0 km van jou');
    expect(formatDistanceFromMe(2449)).toBe('2,4 km van jou');
    expect(formatDistanceFromMe(12_345)).toBe('12,3 km van jou');
  });
});

describe('joinParts', () => {
  test('joins the present parts with a middle dot', () => {
    expect(joinParts('Bravo', undefined, '2,4 km van jou')).toBe('Bravo · 2,4 km van jou');
    expect(joinParts(false, null, '')).toBe('');
    expect(joinParts('alleen')).toBe('alleen');
  });
});
```

Create `src/lib/own-position.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { distanceMetres, ownTrackerPosition } from './own-position';
import type { Position } from '@/types/Position';

const NOW = Date.parse('2026-10-17T12:00:00Z');

function position(deviceId: number, fixTime: string, latitude = 52.1, longitude = 5.8): Position {
  return {
    id: String(deviceId),
    attributes: { distance: 0, totalDistance: 0, motion: false },
    deviceId,
    latitude,
    longitude,
    speed: 0,
    course: 0,
    accuracy: 5,
    deviceName: `device ${deviceId}`,
    fixTime,
  };
}

describe('distanceMetres', () => {
  test('one degree of latitude is about 111.2 km', () => {
    expect(distanceMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1);
  });

  test('same point is 0', () => {
    expect(distanceMetres({ lat: 52.1, lng: 5.8 }, { lat: 52.1, lng: 5.8 })).toBe(0);
  });
});

describe('ownTrackerPosition', () => {
  test('the fresh position of the own device', () => {
    const positions = [position(1, '2026-10-17T11:59:00Z', 1, 1), position(7, '2026-10-17T11:58:00Z', 52.1, 5.8)];
    expect(ownTrackerPosition(positions, 7, NOW)).toEqual({ lat: 52.1, lng: 5.8 });
  });

  test('device id 0 is valid', () => {
    expect(ownTrackerPosition([position(0, '2026-10-17T11:59:00Z')], 0, NOW)).toEqual({ lat: 52.1, lng: 5.8 });
  });

  test('undefined without a device, without a position, or when stale (> 5 min)', () => {
    expect(ownTrackerPosition([position(7, '2026-10-17T11:59:00Z')], undefined, NOW)).toBeUndefined();
    expect(ownTrackerPosition(undefined, 7, NOW)).toBeUndefined();
    expect(ownTrackerPosition([position(1, '2026-10-17T11:59:00Z')], 7, NOW)).toBeUndefined();
    expect(ownTrackerPosition([position(7, '2026-10-17T11:50:00Z')], 7, NOW)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --yes bun test src/lib/format.test.ts src/lib/own-position.test.ts`
Expected: FAIL — `formatDistanceFromMe` / `joinParts` not exported, `./own-position` not found.

- [ ] **Step 3: Implement**

Append to `src/lib/format.ts`:

```ts
/** "350 m van jou" / "2,4 km van jou" for the popups; undefined when unknown or under 20 m (that is you). */
export function formatDistanceFromMe(metres: number | undefined): string | undefined {
  if (metres === undefined || !Number.isFinite(metres) || metres < 20) return undefined;
  if (metres < 1000) return `${Math.round(metres)} m van jou`;
  return `${(metres / 1000).toFixed(1).replace('.', ',')} km van jou`;
}

/** The present parts joined with " · " (popup subtitles). */
export function joinParts(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}
```

Create `src/lib/own-position.ts`:

```ts
import { isActive } from './tracker';
import type { Position } from '@/types/Position';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance (haversine) in metres. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** The own tracker's position, unless missing or stale (same 5 min rule as the hunter markers). Device id 0 is valid. */
export function ownTrackerPosition(positions: Position[] | undefined, deviceId: number | undefined, now: number): LatLng | undefined {
  if (deviceId === undefined) return undefined;
  const own = positions?.find((candidate) => candidate.deviceId === deviceId);
  if (!own || !isActive(own.fixTime, now)) return undefined;
  return { lat: own.latitude, lng: own.longitude };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx --yes bun test src/lib/format.test.ts src/lib/own-position.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts src/lib/own-position.ts src/lib/own-position.test.ts
git commit -m "feat(map): distance-from-me and own-position helpers for the popups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Theme variables, popup chrome and building blocks

No unit tests (presentational); verified by `tsc -b`, lint, and visually in Task 7.

**Files:**
- Modify: `src/index.css` (popup section ~lines 166-185 and the `body.dark` block ~line 222)
- Rewrite: `src/components/map/MapPopup.tsx`
- Create: `src/hooks/distance-from-me.hook.ts`
- Create: `src/components/map/popup/MarkerGlyph.tsx`
- Create: `src/components/map/popup/PopupHeader.tsx`
- Create: `src/components/map/popup/PopupFacts.tsx`
- Create: `src/components/map/popup/CoordRows.tsx`
- Create: `src/components/map/popup/PopupActions.tsx`
- Modify: `src/components/CopyButton.tsx`

**Interfaces:**
- Consumes: Task 1 (`formatDistanceFromMe`, `distanceMetres`, `ownTrackerPosition`, `LatLng`).
- Produces (later tasks use exactly these):
  - CSS vars: `--map-surface`, `--map-surface-high`, `--map-on-surface`, `--map-on-surface-variant`, `--map-muted`, `--map-hairline`, `--map-warn`, `--map-danger-bg`, `--map-danger-fg`, `--map-selected-bg`, `--map-selected-fg`, `--map-font`
  - `MapPopup({ longitude, latitude, onClose, offset?, children })` (unchanged props)
  - `useDistanceFromMe(lat: number, lng: number): string | undefined`
  - `MarkerGlyph({ name: GlyphName, className?: string })`
  - `PopupIcon({ shape?: 'circle' | 'square', background: string, color: string, children })`
  - `PopupHeader({ icon: ReactNode, title: ReactNode, subtitle?: ReactNode, stale?: boolean })`
  - `PopupFacts({ children })`, `PopupFact({ children })`, `FactDot()`
  - `CoordRows({ lat: number, lng: number, onHint?: (rd: { x: string; y: string }) => void })`
  - `PopupActions({ children })`, `popupActionClass(variant: 'neutral' | 'primary' | 'danger', className?: string): string`, `MapsAction({ lat, lng, label? })`
  - `CopyButton` gains `variant?: 'outline' | 'ghost'` (default `'outline'`)

- [ ] **Step 1: CSS variables and popup chrome**

In `src/index.css`, replace the block from `/* MapLibre popup styling */` through the `.maplibregl-popup-tip { @apply animate-in fade-in; }` rule with:

```css
/* Map surfaces (popups, tooltips): the markers' Material 3 palette (lib/marker-style.ts), light and dark */
:root {
  --map-font: 'Google Sans Flex', 'Google Sans', Roboto, system-ui, sans-serif;
  --map-surface: #ebefe6;
  --map-surface-high: #dfe4d9;
  --map-on-surface: #181d17;
  --map-on-surface-variant: #424940;
  --map-muted: #72796f;
  --map-hairline: rgb(0 0 0 / 0.08);
  --map-warn: #9a4a00;
  --map-danger-bg: #ffdad6;
  --map-danger-fg: #93000a;
  --map-selected-bg: #ffedd5;
  --map-selected-fg: #7c2d12;
}

body.dark {
  --map-surface: #1d211c;
  --map-surface-high: #272b26;
  --map-on-surface: #e1e4dc;
  --map-on-surface-variant: #c2c9bd;
  --map-muted: #8c9388;
  --map-hairline: rgb(255 255 255 / 0.06);
  --map-warn: #ffb68a;
  --map-danger-bg: rgb(147 0 10 / 0.35);
  --map-danger-fg: #ffb4ab;
  --map-selected-bg: #7c2d12;
  --map-selected-fg: #ffedd5;
}

/* MapLibre popup styling: compact card like the markers */
.maplibregl-popup-content {
  @apply animate-in fade-in;
  background: var(--map-surface) !important;
  color: var(--map-on-surface);
  font-family: var(--map-font);
  font-size: 12.5px;
  line-height: 1.35;
  border-radius: 16px !important;
  padding: 10px;
  box-shadow:
    0 0 0 1px var(--map-hairline),
    0 6px 20px rgb(0 0 0 / 0.5);
}

.maplibregl-popup-close-button {
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  font-size: 16px;
  line-height: 1;
  color: var(--map-muted);
}

.maplibregl-popup-close-button:hover {
  background: var(--map-surface-high) !important;
}

.maplibregl-popup-tip {
  @apply animate-in fade-in;
}

.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
  border-top-color: var(--map-surface) !important;
}
```

In the `body.dark { ... }` block further down, delete:

```css
  .maplibregl-popup-tip {
    @apply border-t-background;
  }
```

- [ ] **Step 2: MapPopup wrapper**

Replace `src/components/map/MapPopup.tsx` entirely:

```tsx
import type { ReactNode } from 'react';
import type { PositionAnchor } from 'maplibre-gl';
import { Popup, type PopupProps } from 'react-map-gl/maplibre';

type OffsetObject = Partial<Record<PositionAnchor, [number, number]>>;

interface MapPopupProps {
  longitude: number;
  latitude: number;
  onClose: () => void;
  children: ReactNode;
  // MapLibre's Offset type requires every anchor key; we only ever set `bottom`, so accept a partial map and cast.
  offset?: number | [number, number] | OffsetObject;
}

const defaultOffset: OffsetObject = { bottom: [0, -45] };

/** Compact map card (236px, styled in index.css) above a point. */
export default function MapPopup({ longitude, latitude, onClose, offset = defaultOffset, children }: MapPopupProps) {
  return (
    <Popup
      anchor="bottom"
      longitude={longitude}
      latitude={latitude}
      onClose={onClose}
      closeOnClick={true}
      offset={offset as PopupProps['offset']}
      maxWidth="none"
      className="z-20"
    >
      <div className="flex w-[216px] flex-col">{children}</div>
    </Popup>
  );
}
```

(Drop the `prop-types` usage; if `prop-types` is then unused anywhere — check with `grep -rn "prop-types" src` — leave `package.json` alone.)

- [ ] **Step 3: Distance hook**

Create `src/hooks/distance-from-me.hook.ts`:

```ts
import { useEffect, useState } from 'react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { useDevices } from '@/hooks/devices.hook';
import { useNow } from '@/hooks/now.hook';
import { formatDistanceFromMe } from '@/lib/format';
import { distanceMetres, ownTrackerPosition, type LatLng } from '@/lib/own-position';
import type { User } from '@/types/User';

/** The browser's position, only when location access was already granted: never prompts. */
function useGrantedBrowserPosition(): LatLng | undefined {
  const [position, setPosition] = useState<LatLng>();

  useEffect(() => {
    if (!('geolocation' in navigator) || !navigator.permissions) return;
    let cancelled = false;
    let watchId: number | undefined;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return;
        watchId = navigator.geolocation.watchPosition(
          (fix) => setPosition({ lat: fix.coords.latitude, lng: fix.coords.longitude }),
          () => setPosition(undefined),
          { maximumAge: 60_000 },
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return position;
}

/** "2,4 km van jou" from the own tracker (fresh) or an already-granted browser position; undefined otherwise. */
export function useDistanceFromMe(lat: number, lng: number): string | undefined {
  const user = useAuthUser<User>();
  const { positions } = useDevices();
  const now = useNow(false);
  const browser = useGrantedBrowserPosition();
  const own = ownTrackerPosition(positions, user?.tracker?.deviceId, now) ?? browser;
  return formatDistanceFromMe(own ? distanceMetres(own, { lat, lng }) : undefined);
}
```

- [ ] **Step 4: Glyph, icon and header**

Create `src/components/map/popup/MarkerGlyph.tsx`:

```tsx
import { GLYPHS } from '@/components/layers/marker-glyphs';
import type { GlyphName } from '@/lib/marker-style';

/** A Material Symbol from the marker glyph set, as inline SVG in the current text colour. */
export default function MarkerGlyph({ name, className }: { name: GlyphName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={GLYPHS[name]} />
    </svg>
  );
}
```

Create `src/components/map/popup/PopupHeader.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 32px header icon in the marker's shape: a circle (hunters, Life360, picked location) or rounded square (fox markers). */
export function PopupIcon({ shape = 'circle', background, color, children }: { shape?: 'circle' | 'square'; background: string; color: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden text-[13px] font-extrabold [&_svg]:size-[18px]',
        shape === 'circle' ? 'rounded-full' : 'rounded-[10px]',
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
    <div className="flex items-center gap-2.5 pr-6">
      <div className={cn('shrink-0', stale && 'opacity-70 grayscale')}>{icon}</div>
      <div className="min-w-0">
        <h2 className="truncate text-[13.5px] leading-tight font-semibold">{title}</h2>
        {subtitle && <p className={cn('truncate text-[11.5px] leading-snug', stale ? 'text-(--map-warn)' : 'text-(--map-muted)')}>{subtitle}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Facts**

Create `src/components/map/popup/PopupFacts.tsx`:

```tsx
import type { ReactNode } from 'react';

/** Lines of small facts under the header. */
export function PopupFacts({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-col gap-0.5 text-(--map-on-surface-variant)">{children}</div>;
}

/** One fact line: 13px muted icon(s) + text. */
export function PopupFact({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-1.5 [&_svg]:size-[13px] [&_svg]:shrink-0 [&_svg]:text-(--map-muted)">{children}</div>;
}

/** Muted separator between two facts on one line. */
export function FactDot() {
  return <span className="mx-0.5 text-(--map-muted)">·</span>;
}
```

- [ ] **Step 6: CopyButton variant**

In `src/components/CopyButton.tsx`, add to `CopyButtonProps`:

```ts
  /** Outline (default) or ghost, for buttons on a tinted row */
  variant?: 'outline' | 'ghost';
```

change the signature to `export default function CopyButton({ value, label, successMessage, size = 'icon-xs', variant = 'outline' }: CopyButtonProps)` and pass `variant={variant}` instead of `variant="outline"`.

- [ ] **Step 7: Coordinate rows**

Create `src/components/map/popup/CoordRows.tsx`:

```tsx
import { LightbulbIcon } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCoordinates } from '@/lib/hunters';
import { toRD } from '@/lib/rd';

const COPIED = 'Coördinaten gekopieerd naar klembord!';

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-[10px] bg-(--map-surface-high) py-1 pr-1 pl-2">
      <div className="min-w-0">
        <div className="text-[10px] tracking-wide text-(--map-muted) uppercase">{label}</div>
        <div className="tabular-nums">{value}</div>
      </div>
      <div className="flex shrink-0 text-(--map-on-surface-variant)">{children}</div>
    </div>
  );
}

/**
 * WGS84 (5 decimals shown, 7 copied) and RD rows with copy buttons; `onHint` adds the lightbulb that puts the RD
 * coordinates into the hint registration.
 */
export default function CoordRows({ lat, lng, onHint }: { lat: number; lng: number; onHint?: (rd: { x: string; y: string }) => void }) {
  const rdMetres = toRD(lng, lat);
  const rd = { x: rdMetres.x.toFixed(0), y: rdMetres.y.toFixed(0) };

  return (
    <div className="mt-2 flex flex-col gap-1">
      <Row label="WGS84" value={formatCoordinates(lat, lng)}>
        <CopyButton value={`${lat.toFixed(7)}, ${lng.toFixed(7)}`} label="Coördinaten" successMessage={COPIED} variant="ghost" />
      </Row>
      <Row label="RD" value={`${rd.x} · ${rd.y}`}>
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
      </Row>
    </div>
  );
}
```

- [ ] **Step 8: Actions**

Create `src/components/map/popup/PopupActions.tsx`:

```tsx
import type { ReactNode } from 'react';
import { MapIcon } from 'lucide-react';
import { googleMapsUrl } from '@/lib/hunters';
import { cn } from '@/lib/utils';

const BASE =
  'inline-flex h-[30px] min-w-[30px] items-center justify-center gap-1.5 rounded-[9px] px-2 text-xs font-semibold transition-[filter,background-color] hover:brightness-110 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary [&_svg]:size-3.5 [&_svg]:shrink-0';

const VARIANTS = {
  neutral: 'bg-(--map-surface-high) text-(--map-on-surface-variant)',
  primary: 'bg-primary text-primary-foreground',
  danger: 'bg-(--map-danger-bg) text-(--map-danger-fg)',
} as const;

/** Classes of a 30px popup action button. */
export function popupActionClass(variant: keyof typeof VARIANTS, className?: string): string {
  return cn(BASE, VARIANTS[variant], className);
}

/** The bottom row of buttons. */
export function PopupActions({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 flex gap-1.5">{children}</div>;
}

/** Google Maps link: icon-only (30px square) without a label, otherwise full width with the label. */
export function MapsAction({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      href={googleMapsUrl(lat, lng)}
      aria-label={label ?? 'Bekijk op Google Maps'}
      title={label ? undefined : 'Bekijk op Google Maps'}
      className={popupActionClass('neutral', label ? 'flex-1' : 'w-[30px] px-0')}
    >
      <MapIcon />
      {label}
    </a>
  );
}
```

- [ ] **Step 9: Type-check and lint**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint`
Expected: no errors. (The building blocks are not used yet; unused exports are fine.)

- [ ] **Step 10: Commit**

```bash
git add src/index.css src/components/map/MapPopup.tsx src/hooks/distance-from-me.hook.ts src/components/map/popup src/components/CopyButton.tsx
git commit -m "feat(map): compact popup chrome and shared popup building blocks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Picked-location and hunter popups (+ Hunt/Spot buttons)

**Files:**
- Modify: `src/components/map/MarkerRegistration.tsx` (button row at the end of the component, ~lines 244-252)
- Rewrite: `src/components/map/PickedLocationPopup.tsx`
- Rewrite: `src/components/layers/devices/DevicePopup.tsx`
- Modify: `src/components/layers/Devices.tsx` (popup render line, ~line 98)

**Interfaces:**
- Consumes: Task 2 blocks, `useDistanceFromMe`, `joinParts`.
- Produces: `MarkerRegistration` now renders its dialog + two `flex-1` buttons as **fragment children** (no wrapper div) so it sits inside `PopupActions`. `DevicePopup` props become `{ position: Position; icon: HunterIcon; onClose: () => void }`.

- [ ] **Step 1: Hunt / Spot buttons**

In `src/components/map/MarkerRegistration.tsx` replace the returned button row:

```tsx
      <div className="flex gap-2 w-full">
        <Button variant="default" size="sm" className="min-w-0 flex-1" onClick={() => openDialog(MarkerType.Hunt)}>
          <LocateFixedIcon data-icon="inline-start" /> Vos hunt
        </Button>
        <Button variant="default" size="sm" className="min-w-0 flex-1" onClick={() => openDialog(MarkerType.Spot)}>
          <GlassesIcon data-icon="inline-start" /> Vos spot
        </Button>
      </div>
```

with:

```tsx
      <button type="button" className={popupActionClass('primary', 'min-w-0 flex-1')} onClick={() => openDialog(MarkerType.Hunt)}>
        <LocateFixedIcon /> Hunt
      </button>
      <button type="button" className={popupActionClass('primary', 'min-w-0 flex-1')} onClick={() => openDialog(MarkerType.Spot)}>
        <GlassesIcon /> Spot
      </button>
```

Add `import { popupActionClass } from './popup/PopupActions';`. `Button` stays imported (the dialog form still uses it). Update the component's doc comment if it mentions the wrapper.

- [ ] **Step 2: Picked-location popup**

Replace `src/components/map/PickedLocationPopup.tsx`:

```tsx
import { MapPinIcon } from 'lucide-react';
import { Marker } from 'react-map-gl/maplibre';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { useHintFormBridge } from '@/hooks/hint-bridge.hook';
import useSidebarStore from '@/stores/sidebar.store';
import MapPopup from './MapPopup';
import MarkerRegistration from './MarkerRegistration';
import CoordRows from './popup/CoordRows';
import { MapsAction, PopupActions } from './popup/PopupActions';
import PopupHeader, { PopupIcon } from './popup/PopupHeader';

// Above the 18px picked-location puck
const POPUP_OFFSET = { bottom: [0, -15] as [number, number] };

/** The clicked map point: coordinates (copy, into the hint form), Google Maps and register a hunt / spot here. */
export default function PickedLocationPopup({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const setCoords = useHintFormBridge((s) => s.setCoords);
  const openSection = useSidebarStore((s) => s.openSection);
  const setSheetSnap = useSidebarStore((s) => s.setSheetSnap);
  const distance = useDistanceFromMe(lat, lng);

  function setHintCoords(rd: { x: string; y: string }) {
    setCoords(rd.x, rd.y);
    // The hint entry section is collapsed by default: make sure it is visible (and scrolled into view on mobile)
    openSection('hintEntry');
    setSheetSnap('full');
  }

  return (
    <>
      <Marker longitude={lng || 0} latitude={lat || 0} anchor="center">
        <span className="jh-picked-dot" />
      </Marker>
      <MapPopup onClose={onClose} longitude={lng || 0} latitude={lat || 0} offset={POPUP_OFFSET}>
        <PopupHeader
          icon={
            <PopupIcon background="var(--map-selected-bg)" color="var(--map-selected-fg)">
              <MapPinIcon />
            </PopupIcon>
          }
          title="Gekozen locatie"
          subtitle={distance}
        />
        <CoordRows lat={lat} lng={lng} onHint={setHintCoords} />
        <PopupActions>
          <MapsAction lat={lat} lng={lng} />
          <MarkerRegistration lat={lat} lng={lng} />
        </PopupActions>
      </MapPopup>
    </>
  );
}
```

(Check the existing import paths `@/hooks/hint-bridge.hook` and `@/stores/sidebar.store` resolve without the `.ts` suffix — other files import them that way; if `tsc` complains, use the original `.ts`-suffixed paths.)

- [ ] **Step 3: Hunter popup**

Replace `src/components/layers/devices/DevicePopup.tsx`:

```tsx
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { BatteryIcon, GaugeIcon } from 'lucide-react';
import MapPopup from '../../map/MapPopup';
import MarkerRegistration from '../../map/MarkerRegistration';
import MarkerGlyph from '../../map/popup/MarkerGlyph';
import { MapsAction, PopupActions } from '../../map/popup/PopupActions';
import { FactDot, PopupFact, PopupFacts } from '../../map/popup/PopupFacts';
import PopupHeader, { PopupIcon } from '../../map/popup/PopupHeader';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { formatBattery, formatSpeed } from '@/lib/tracker';
import { joinParts } from '@/lib/format';
import { vehicleGlyph, type HunterIcon } from '@/lib/marker-style';
import { isMoreThanFiveMinutesAgo, knotsToKmh } from '@/lib/utils';
import type { Position } from '@/types/Position';
import { useMarkerPalette } from '../marker-icons';

const POPUP_OFFSET = { bottom: [0, -20] as [number, number] };

interface DevicePopupProps {
  /** The device's position from the current SWR data */
  position: Position;
  /** The hunter's vehicle icon, as on the map */
  icon: HunterIcon;
  onClose: () => void;
}

/** Age, distance, speed and battery of a hunter, plus Google Maps and "register a hunt / spot here". */
export default function DevicePopup({ position, icon, onClose }: DevicePopupProps) {
  const { latitude: lat, longitude: lng } = position;
  const palette = useMarkerPalette();
  const distance = useDistanceFromMe(lat, lng);
  const stale = isMoreThanFiveMinutesAgo(position.fixTime);
  const age = formatDistanceToNow(position.fixTime, { locale: nl, addSuffix: true });

  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={POPUP_OFFSET}>
      <PopupHeader
        icon={
          <PopupIcon background={palette.secondaryContainer} color={palette.onSecondaryContainer}>
            <MarkerGlyph name={vehicleGlyph(icon)} />
          </PopupIcon>
        }
        title={position.deviceName}
        subtitle={joinParts(age, stale ? 'laatst bekend' : distance)}
        stale={stale}
      />
      <PopupFacts>
        <PopupFact>
          {!stale && (
            <>
              <GaugeIcon />
              {formatSpeed(knotsToKmh(position.speed))}
              <FactDot />
            </>
          )}
          <BatteryIcon />
          {formatBattery(position.attributes.batteryLevel)}
        </PopupFact>
      </PopupFacts>
      <PopupActions>
        <MapsAction lat={lat} lng={lng} />
        <MarkerRegistration lat={lat} lng={lng} />
      </PopupActions>
    </MapPopup>
  );
}
```

- [ ] **Step 4: Pass the icon from Devices**

In `src/components/layers/Devices.tsx` change:

```tsx
{activeDevice && <DevicePopup key={active!.opened} position={activeDevice} onClose={closePopup} />}
```

to:

```tsx
{activeDevice && <DevicePopup key={active!.opened} position={activeDevice} icon={iconByDevice.get(activeDevice.deviceId) ?? 'phone'} onClose={closePopup} />}
```

- [ ] **Step 5: Type-check, lint, tests**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: all pass. If a test asserts "Vos hunt"/"Vos spot"/"Breedtegraad", update it to the new copy ("Hunt", "Spot", "WGS84").

- [ ] **Step 6: Commit**

```bash
git add src/components/map/MarkerRegistration.tsx src/components/map/PickedLocationPopup.tsx src/components/layers/devices/DevicePopup.tsx src/components/layers/Devices.tsx
git commit -m "feat(map): compact picked-location and hunter popups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Group popup and visit controls

**Files:**
- Modify: `src/components/layers/teams/TeamPopup.tsx` (the returned JSX, ~lines 49-91)
- Modify: `src/components/map/VisitControls.tsx` (the returned JSX)

**Interfaces:**
- Consumes: Task 2 blocks, `useDistanceFromMe`, `joinParts`, `TeamLogo`.
- Produces: nothing new.

- [ ] **Step 1: Visit controls as a connected group**

In `src/components/map/VisitControls.tsx` replace the returned JSX with:

```tsx
  return (
    <div className="mt-2 flex flex-col gap-1">
      <p className="text-[11px] text-(--map-muted)">{visitStatusText(visit)}</p>
      <div className="grid grid-cols-3 gap-0.5">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected === option.value}
            disabled={busy}
            onClick={() => choose(option.value)}
            className={cn(
              'h-[26px] rounded-[4px] text-[11.5px] font-semibold transition-[filter] first:rounded-l-[9px] last:rounded-r-[9px] hover:brightness-110 disabled:opacity-50',
              selected === option.value ? 'bg-(--map-selected-bg) text-(--map-selected-fg)' : 'bg-(--map-surface-high) text-(--map-on-surface-variant)',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
```

Import `cn` from `@/lib/utils`; remove the `Button` import if now unused.

- [ ] **Step 2: Group popup**

In `src/components/layers/teams/TeamPopup.tsx`:
- Remove imports of `GoogleMapsButton` and `Badge`; add:

```tsx
import { MapPinIcon } from 'lucide-react';
import { MapsAction, PopupActions } from '../../map/popup/PopupActions';
import { PopupFact, PopupFacts } from '../../map/popup/PopupFacts';
import PopupHeader from '../../map/popup/PopupHeader';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
```

- After `const [lng, lat] = team.location.coordinates;` add `const distance = useDistanceFromMe(lat, lng);` — move the `[lng, lat]` line above the `handleAreaChange` function if needed so the hook call stays unconditional at the top level (it already is; hooks just must not be after an early return — there is none).
- Replace the returned JSX with:

```tsx
  const address = `${team.street} ${team.houseNumber}${team.housenumberAddition ? ` ${team.housenumberAddition}` : ''}, ${team.city}`;

  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={POPUP_OFFSET}>
      <PopupHeader
        icon={<TeamLogo name={team.name} logoUrl={team.logoUrl} className="size-8 rounded-[10px] border-0 shadow-none" />}
        title={team.name}
        subtitle={
          <>
            {area ? (
              <span className="font-semibold capitalize" style={{ color: getColorFromArea(area) }}>
                ● {area}
              </span>
            ) : (
              'Geen deelgebied'
            )}
            {distance && ` · ${distance}`}
          </>
        }
      />
      <PopupFacts>
        <PopupFact>
          <MapPinIcon />
          <span className="truncate">{joinParts(team.accomodation, address)}</span>
        </PopupFact>
      </PopupFacts>
      {area && predictionEnabled !== false && <VisitControls teamApiId={team.apiId} />}
      {TEAMS_AREA_EDITING && (
        <Select onValueChange={handleAreaChange} value={area ?? 'onbekend'}>
          <SelectTrigger autoFocus={false} size="sm" className="mt-2 w-full">
            <SelectValue placeholder="Kies deelgebied..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onbekend">Onbekend deelgebied</SelectItem>
            {areas?.map((option) => (
              <SelectItem key={option._id} value={option.name}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <PopupActions>
        <MapsAction lat={lat} lng={lng} label="Google Maps" />
      </PopupActions>
    </MapPopup>
  );
```

Add `import { joinParts } from '@/lib/format';`. `TeamLogo`'s fallback letter uses `text-xl`; that is fine at 32px.

- [ ] **Step 3: Type-check, lint, tests**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/layers/teams/TeamPopup.tsx src/components/map/VisitControls.tsx
git commit -m "feat(map): compact group popup with connected visit buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fox-marker and Life360 popups; remove GoogleMapsButton

**Files:**
- Modify: `src/components/layers/markers/MarkerPopup.tsx` (imports + returned JSX)
- Modify: `src/components/layers/life360/Life360Popup.tsx` (imports + returned JSX)
- Delete: `src/components/map/GoogleMapsButton.tsx`

**Interfaces:**
- Consumes: Task 2 blocks, `useDistanceFromMe`, `joinParts`, `areaKey`/`areaLetter` from `@/lib/marker-style`, `Life360Avatar` from `@/components/cards/life360/Life360Avatar`.

- [ ] **Step 1: Fox-marker popup**

In `src/components/layers/markers/MarkerPopup.tsx`: remove the `GoogleMapsButton`, `Button` and `toRD` imports (keep `Trash2Icon`, `ConfirmDialog`, `toast`, etc.), add:

```tsx
import CoordRows from '../../map/popup/CoordRows';
import { MapsAction, PopupActions, popupActionClass } from '../../map/popup/PopupActions';
import PopupHeader, { PopupIcon } from '../../map/popup/PopupHeader';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { joinParts } from '@/lib/format';
import { areaKey, areaLetter } from '@/lib/marker-style';
```

Remove `const rd = toRD(lng, lat);`, add after `const [lng, lat] = …`: `const distance = useDistanceFromMe(lat, lng);`

Replace the returned JSX with:

```tsx
  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={marker.type === MarkerType.Hint ? HINT_POPUP_OFFSET : POPUP_OFFSET}>
      <PopupHeader
        icon={
          <PopupIcon shape="square" background={getColorFromArea(marker.area)} color="#1a1a1a">
            {areaLetter(areaKey(marker.area) ?? 'none') || '?'}
          </PopupIcon>
        }
        title={`${capitalizeFirstLetter(marker.area)} · ${marker.type}`}
        subtitle={joinParts(formatMarkerTime(marker.time), distance)}
      />
      <CoordRows lat={lat} lng={lng} />
      <PopupActions>
        <MapsAction lat={lat} lng={lng} label="Google Maps" />
        <button type="button" aria-label="Verwijderen" title="Verwijderen" className={popupActionClass('danger', 'w-[30px] px-0')} onClick={() => setConfirmOpen(true)}>
          <Trash2Icon />
        </button>
      </PopupActions>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Weet je het zeker?"
        description="Deze actie kan niet ongedaan gemaakt worden. Dit zal alle informatie van deze marker permanent verwijderen."
        confirmLabel="Doorgaan"
        destructive
        onConfirm={handleDelete}
      />
    </MapPopup>
  );
```

Make sure `getColorFromArea` is imported from `@/lib/utils` (alongside `capitalizeFirstLetter`). (`areaLetter` returns `''` for `'none'`, hence the `'?'` fallback.)

- [ ] **Step 2: Life360 popup**

In `src/components/layers/life360/Life360Popup.tsx`: remove the `GoogleMapsButton` import, add:

```tsx
import { BatteryIcon, CrosshairIcon, GaugeIcon } from 'lucide-react';
import Life360Avatar from '@/components/cards/life360/Life360Avatar';
import { MapsAction, PopupActions } from '@/components/map/popup/PopupActions';
import { FactDot, PopupFact, PopupFacts } from '@/components/map/popup/PopupFacts';
import PopupHeader from '@/components/map/popup/PopupHeader';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { joinParts } from '@/lib/format';
```

Replace the component body with:

```tsx
export default function Life360Popup({ member, location, linkStale, now, onClose }: Life360PopupProps) {
  const driving = life360DrivingText(location, linkStale, now);
  const stale = isLocationStale(location, linkStale, now);
  const distance = useDistanceFromMe(location.lat, location.lon);
  const battery = `${formatBattery(location.battery ?? undefined)}${location.charging ? ' (laadt)' : ''}`;

  return (
    <MapPopup longitude={location.lon} latitude={location.lat} onClose={onClose} offset={POPUP_OFFSET}>
      <PopupHeader
        icon={<Life360Avatar member={member} size={32} />}
        title={member.name}
        subtitle={joinParts(life360Age(location.at, now) ?? 'onbekend', stale ? 'laatst bekend' : distance)}
        stale={stale}
      />
      <PopupFacts>
        <PopupFact>
          {driving && (
            <>
              <GaugeIcon />
              {driving.toLowerCase()}
              <FactDot />
            </>
          )}
          <BatteryIcon />
          {battery}
        </PopupFact>
        {hasUsableAccuracy(location.accuracyM) && (
          <PopupFact>
            <CrosshairIcon />
            {formatAccuracy(location.accuracyM)} nauwkeurig
          </PopupFact>
        )}
      </PopupFacts>
      <PopupActions>
        <MapsAction lat={location.lat} lng={location.lon} label="Navigeer" />
      </PopupActions>
    </MapPopup>
  );
}
```

Import `isLocationStale` from `@/lib/life360` (it lives there, `src/lib/life360.ts:101`) and keep the existing imports of `life360DrivingText`, `life360Age`, `hasUsableAccuracy`, `formatBattery`, `formatAccuracy`. Update the doc comment to: `/** Like the hunter popup: age, distance, driving speed, battery, accuracy, Navigeer. */`

- [ ] **Step 3: Delete GoogleMapsButton**

Run: `grep -rn "GoogleMapsButton" src` — expected: only `src/components/map/GoogleMapsButton.tsx` itself. Then `git rm src/components/map/GoogleMapsButton.tsx`.

- [ ] **Step 4: Type-check, lint, tests**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/layers/markers/MarkerPopup.tsx src/components/layers/life360/Life360Popup.tsx src/components/map/GoogleMapsButton.tsx
git commit -m "feat(map): compact fox-marker and Life360 popups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: One-line hover tooltips

**Files:**
- Rewrite: `src/components/map/MapTooltip.tsx`
- Modify: `src/components/layers/teams/TeamTooltip.tsx`, `src/components/layers/devices/DeviceTooltip.tsx`, `src/components/layers/markers/MarkerTooltip.tsx`, `src/components/layers/life360/Life360Tooltip.tsx`
- Modify: `src/components/layers/Life360.tsx` (tooltip render, ~line 115) to pass `linkStale` and `now`

**Interfaces:**
- Produces: `MapTooltip({ longitude, latitude, offset: [number, number], color: string, title: string, meta?: string })`.
- Consumes: `formatAgeShort(iso: string, now: number)` from `@/lib/life360` ("nu", "2 min", "3 uur"); `life360Tone`, `life360RimColor` from `@/lib/life360-map`; `useMarkerPalette` from `components/layers/marker-icons`.

- [ ] **Step 1: MapTooltip**

Replace `src/components/map/MapTooltip.tsx`:

```tsx
import { Marker } from 'react-map-gl/maplibre';

// Never catches the pointer itself
const TOOLTIP_STYLE = { pointerEvents: 'none', zIndex: 40 } as const;

interface MapTooltipProps {
  longitude: number;
  latitude: number;
  /** From the marker's position to the tooltip's bottom centre (px) */
  offset: [number, number];
  /** The marker's colour, as a dot before the title */
  color: string;
  title: string;
  /** Muted text after the title */
  meta?: string;
}

/** One-line hover tooltip above a canvas map marker: colour dot, bold title, muted meta. */
export default function MapTooltip({ longitude, latitude, offset, color, title, meta }: MapTooltipProps) {
  return (
    <Marker longitude={longitude} latitude={latitude} anchor="bottom" offset={offset} style={TOOLTIP_STYLE}>
      <div className="relative flex w-fit items-center gap-[7px] rounded-[10px] bg-(--map-surface) px-2.5 py-1.5 font-(family-name:--map-font) text-[12.5px] whitespace-nowrap text-(--map-on-surface) shadow-[0_0_0_1px_var(--map-hairline),0_4px_12px_rgb(0_0_0/0.5)]">
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="font-semibold">{title}</span>
        {meta && <span className="text-(--map-muted)">{meta}</span>}
        <span className="absolute top-full left-1/2 size-2 -translate-x-1/2 -translate-y-1 rotate-45 rounded-[1px] bg-(--map-surface)" />
      </div>
    </Marker>
  );
}
```

- [ ] **Step 2: Group tooltip**

`src/components/layers/teams/TeamTooltip.tsx` body:

```tsx
import MapTooltip from '@/components/map/MapTooltip';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { Team } from '@/types/Team';

// Above the hovered group (28px circle, centred)
const TOOLTIP_OFFSET: [number, number] = [0, -20];

/** Hover tooltip of a group: area colour, name, area. */
export default function TeamTooltip({ team }: { team: Team }) {
  return (
    <MapTooltip
      longitude={team.location.coordinates[0]}
      latitude={team.location.coordinates[1]}
      offset={TOOLTIP_OFFSET}
      color={team.area ? getColorFromArea(team.area) : 'var(--map-muted)'}
      title={team.name}
      meta={team.area ? capitalizeFirstLetter(team.area) : undefined}
    />
  );
}
```

- [ ] **Step 3: Hunter tooltip**

`src/components/layers/devices/DeviceTooltip.tsx`:

```tsx
import MapTooltip from '@/components/map/MapTooltip';
import { formatAgeShort } from '@/lib/life360';
import { isMoreThanFiveMinutesAgo } from '@/lib/utils';
import type { Position } from '@/types/Position';
import { useMarkerPalette } from '../marker-icons';

// Above the hovered hunter (38px circle, centred)
const TOOLTIP_OFFSET: [number, number] = [0, -30];

/** Hover tooltip of a hunter: name and how long ago (grey dot when stale); follows every poll. */
export default function DeviceTooltip({ position }: { position: Position }) {
  const palette = useMarkerPalette();
  const stale = isMoreThanFiveMinutesAgo(position.fixTime);
  return (
    <MapTooltip
      longitude={position.longitude}
      latitude={position.latitude}
      offset={TOOLTIP_OFFSET}
      color={stale ? 'var(--map-muted)' : palette.onSecondaryContainer}
      title={position.deviceName}
      meta={formatAgeShort(position.fixTime, Date.now())}
    />
  );
}
```

If lint flags `Date.now()` in render (react-hooks purity), use `const now = useNow(false);` from `@/hooks/now.hook` instead and pass `now`.

- [ ] **Step 4: Fox-marker tooltip**

`src/components/layers/markers/MarkerTooltip.tsx`:

```tsx
import MapTooltip from '@/components/map/MapTooltip';
import { formatMarkerTime } from '@/lib/markers';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { Marker as FoxMarker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

// Above the hovered fox (38px shape, centred), or above a hint's label (which hangs ~29px above its point)
const TOOLTIP_OFFSET: [number, number] = [0, -25];
const HINT_TOOLTIP_OFFSET: [number, number] = [0, -34];

/** Hover tooltip of a fox marker: area colour, type, area and time. */
export default function MarkerTooltip({ marker }: { marker: FoxMarker }) {
  const [lng, lat] = marker.location.coordinates;
  return (
    <MapTooltip
      longitude={lng}
      latitude={lat}
      offset={marker.type === MarkerType.Hint ? HINT_TOOLTIP_OFFSET : TOOLTIP_OFFSET}
      color={getColorFromArea(marker.area)}
      title={capitalizeFirstLetter(marker.type)}
      meta={`${capitalizeFirstLetter(marker.area)} · ${formatMarkerTime(marker.time)}`}
    />
  );
}
```

- [ ] **Step 5: Life360 tooltip**

`src/components/layers/life360/Life360Tooltip.tsx`:

```tsx
import MapTooltip from '@/components/map/MapTooltip';
import { formatAgeShort } from '@/lib/life360';
import { life360RimColor, life360Tone } from '@/lib/life360-map';
import type { Life360Location, Life360Member } from '@/types/Life360';

// Above the hovered 44 px cookie
const TOOLTIP_OFFSET: [number, number] = [0, -28];

/** Hover tooltip of a Life360 member: rim colour (live / driving / stale), name, how long ago. */
export default function Life360Tooltip({ member, location, linkStale, now }: { member: Life360Member; location: Life360Location; linkStale: boolean; now: number }) {
  return (
    <MapTooltip
      longitude={location.lon}
      latitude={location.lat}
      offset={TOOLTIP_OFFSET}
      color={life360RimColor(life360Tone(location, linkStale, now))}
      title={member.name}
      meta={formatAgeShort(location.at, now)}
    />
  );
}
```

In `src/components/layers/Life360.tsx` change the tooltip render to:

```tsx
{hoveredMember?.location && <Life360Tooltip member={hoveredMember} location={hoveredMember.location} linkStale={linkStale} now={now} />}
```

- [ ] **Step 6: Type-check, lint, tests**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: all pass. `grep -rn "Badge" src/components/layers` should show no tooltip still importing `Badge`.

- [ ] **Step 7: Commit**

```bash
git add src/components/map/MapTooltip.tsx src/components/layers/teams/TeamTooltip.tsx src/components/layers/devices/DeviceTooltip.tsx src/components/layers/markers/MarkerTooltip.tsx src/components/layers/life360/Life360Tooltip.tsx src/components/layers/Life360.tsx
git commit -m "feat(map): one-line hover tooltips in the marker colours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Visual verification and offset tuning

**Files:**
- Modify (only if needed): the `POPUP_OFFSET` / `TOOLTIP_OFFSET` constants in the popup and tooltip files above.

- [ ] **Step 1: Run the client against a non-live setup**

Do not use the docker stack. Start a throwaway server per `memory: dev-environment` (own `PORT`, DB `jotihunt-popups-smoke`, `JOTIHUNT_API_URL=http://127.0.0.1:9`) and `npx --yes bun x vite --port 5180` in the worktree with the API URL pointed at it; or, if the user prefers, ask them to check in their own dev setup.

- [ ] **Step 2: Check each popup and tooltip, dark and light mode**

Compare against `popups-a-v2.html` / `tooltips.html` row 1:
- Picked location: distance shown only when own tracker is fresh or location permission granted; copy WGS84 copies 7 decimals; lightbulb fills the hint form and opens the section; Hunt/Spot open the registration dialog.
- Group: area dot colour, address truncates, visit group selects and disables while saving, team without area shows "Geen deelgebied" and no visit buttons.
- Hunter: fresh vs stale (> 5 min: grey icon, orange "laatst bekend", no speed).
- Fox marker: area letter square, hint marker popup and tooltip sit above the hint label, delete opens the confirmation.
- Life360: avatar or initials, driving line only when driving, stale "laatst bekend".
- Tooltips: dot colours, no wrap, arrow centred over the marker.
- Popup tip sits just above each marker; adjust offsets by a few px where it overlaps or floats.
- 360px wide viewport: popup fits and stays readable.

- [ ] **Step 3: Commit any offset tweaks**

```bash
git add -A src/components
git commit -m "fix(map): tune popup and tooltip offsets to the new sizes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
