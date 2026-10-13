# HQ Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin `/hq` beamer screen as the "Vossenbord" (map left, clock/fox tiles/hunts right) with a camera director that tours active foxes and flies to events.

**Architecture:** Pure logic (fox grouping, focus points, tour stops, event mapping, event queue reducer) lives in `src/lib/hq-director.ts` and is unit-tested. A small zustand store holds the director state; two hooks feed it (hunt/cooldown detection) and drive the map (`flyTo`/`fitBounds` on a timer per step). Presentational components in `src/components/hq/` render the panel and the map overlays. The website tour's timer ring and step dots are extracted so both use the same components.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (+ tw-animate-css), react-map-gl/maplibre 8, zustand, @turf/turf, `bun test`.

Spec: `docs/superpowers/specs/2026-10-13-hq-screen-redesign-design.md`

## Global Constraints

- Work in `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client` on branch `feat/hq-redesign`.
- `bun` is not on PATH: run tests with `npx --yes bun test <path>`; typecheck with `npx tsc -b`; lint with `npm run lint`.
- Never restart the docker stack (server :3000, client :8080): it is the user's live instance. Don't `pkill -f`.
- UI copy is Dutch. Colours only from theme tokens and the existing group colours (`text-green-700 dark:text-green-400`, `text-orange-700 dark:text-orange-300`, `text-red-700 dark:text-red-300`, `text-blue-700 dark:text-blue-300`). System font, `tabular-nums` on every number.
- Timing constants (verbatim from spec): flight ~8 s (`FLY_MS = 8000`), tour dwell 20 s (`TOUR_DWELL_MS = 20_000`), event hold 30 s (`EVENT_HOLD_MS = 30_000`), area zoom 11.6, hunt zoom 12.4, tegenhunt zoom 12.2, `curve: 1.25`.
- While `/hq` is mounted the root font size is `1.3vw` (restored on unmount); all HQ sizes are Tailwind rem classes.
- Don't pass `essential: true` to map animations: MapLibre then honours `prefers-reduced-motion` (instant jumps).
- No full-screen alert flash: `AlertBanner` and `bannerClass` are removed.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/components/tour/TimerRing.tsx` (new) | Circular countdown ring (extracted from TourCard) |
| `src/components/tour/StepDots.tsx` (new) | Step dots (extracted from TourCard) |
| `src/components/tour/TourCard.tsx` (modify) | Uses TimerRing + StepDots; behaviour unchanged |
| `src/lib/hq-director.ts` (new) | Pure HQ logic: foxes, focus, tour, events, queue reducer |
| `src/lib/hq-director.test.ts` (new) | Unit tests |
| `src/components/Map.tsx` (modify) | `wall` + `overlay` props, `fitBounds` on `MapRef` |
| `src/stores/hq-director.store.ts` (new) | zustand store wrapping the reducer |
| `src/hooks/hq-director.hook.ts` (new) | Drives the camera per step; exposes overlay state |
| `src/hooks/hq-events.hook.ts` (new) | Detects new hunts and ended cooldowns, pushes events |
| `src/components/hq/HqTopCard.tsx` (new) | Clock, next hint, hunts/points, open assignment line |
| `src/components/hq/FoxBoard.tsx` (new) | 3×3 fox tiles |
| `src/components/hq/HqHunts.tsx` (new) | Last 3 hunts on the timeline |
| `src/components/hq/TourChip.tsx` (new) | Top-left tour chip |
| `src/components/hq/HqEventCard.tsx` (new) | Bottom event card |
| `src/components/hq/FocusPulse.tsx` (new) | Pulsing ring on the focused fox (map marker) |
| `src/components/hq/AudioUnlock.tsx` (modify) | Restyled |
| `src/pages/Hq.tsx` (rewrite) | Layout + wiring |
| `src/index.css` (modify) | `hq-pulse` keyframes |
| `src/lib/hq.ts`, `src/lib/hq.test.ts` (modify) | Drop `bannerClass` |
| delete: `src/components/hq/{AlertBanner,AreaTiles,HqClock,HuntFeed,LatestArticle}.tsx` | Replaced |

---

### Task 1: Extract TimerRing and StepDots from the tour card

**Files:**
- Create: `src/components/tour/TimerRing.tsx`, `src/components/tour/StepDots.tsx`
- Modify: `src/components/tour/TourCard.tsx`

**Interfaces:**
- Produces: `TimerRing({ durationMs?: number; runKey: React.Key; paused?: boolean; onDone?: () => void; progressClassName?: string; className?: string; children?: ReactNode })` (default export). `StepDots({ count: number; index: number; className?: string })` (default export). The ring uses the existing `tour-ring` keyframes in `src/index.css`.

- [ ] **Step 1: Create `src/components/tour/TimerRing.tsx`**

```tsx
import type { CSSProperties, Key, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// 36-unit viewBox, 2.5-unit stroke: the ring scales with the box set by className
const RING_SIZE = 36;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

interface TimerRingProps {
  /** Time to fill the ring; undefined = only the empty track */
  durationMs?: number;
  /** A new key restarts the fill */
  runKey: Key;
  paused?: boolean;
  /** Fired when the ring is full */
  onDone?: () => void;
  /** Stroke colour class of the progress arc */
  progressClassName?: string;
  /** Size of the box, e.g. size-9 */
  className?: string;
  children?: ReactNode;
}

/** Circular countdown, the website tour's auto-advance ring: fills once over `durationMs` around its children. */
export default function TimerRing({ durationMs, runKey, paused = false, onDone, progressClassName = 'stroke-primary', className, children }: TimerRingProps) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full -rotate-90" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" strokeWidth={RING_STROKE} className="stroke-muted" />
        {durationMs !== undefined && (
          <circle
            // Remount per run so the animation restarts
            key={runKey}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            className={progressClassName}
            style={
              {
                '--tour-ring-length': RING_LENGTH,
                animation: `tour-ring ${durationMs}ms linear forwards`,
                animationPlayState: paused ? 'paused' : 'running',
              } as CSSProperties
            }
            onAnimationEnd={onDone}
          />
        )}
      </svg>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/tour/StepDots.tsx`**

```tsx
import { cn } from '@/lib/utils';

/** Progress dots of the website tour: done = primary dot, current = wide primary pill, to come = muted dot. */
export default function StepDots({ count, index, className }: { count: number; index: number; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-[width] duration-200 motion-reduce:transition-none',
            i === index ? 'w-4 bg-primary' : 'w-1.5',
            i < index && 'bg-primary',
            i > index && 'bg-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Use them in `src/components/tour/TourCard.tsx`**

Replace the imports line `import { forwardRef, useState, type CSSProperties } from 'react';` with:

```tsx
import { forwardRef, useState } from 'react';
```

and add after the `cn` import:

```tsx
import StepDots from './StepDots';
import TimerRing from './TimerRing';
```

Delete the four `RING_*` constants and their comment. Replace the dots block (`<div className="flex flex-wrap items-center gap-1 px-4" aria-hidden> ... </div>`) with:

```tsx
      <StepDots count={stepCount} index={stepIndex} className="px-4" />
```

Replace the whole `<div className="relative flex size-9 items-center justify-center"> ... </div>` (svg + pause button) with:

```tsx
        <TimerRing className="size-9" durationMs={durationMs} runKey={stepIndex} paused={paused || hovered} onDone={onTimeUp}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label={paused ? 'Verder' : 'Pauzeren'}
            onClick={onTogglePause}
            disabled={durationMs === undefined}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </Button>
        </TimerRing>
```

- [ ] **Step 4: Verify**

Run: `npx --yes bun test src/components/tour && npx tsc -b && npm run lint`
Expected: all tour tests pass, no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/tour
git commit -m "refactor(tour): extract TimerRing and StepDots from the tour card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: HQ logic part 1: foxes, focus points, tour stops

**Files:**
- Create: `src/lib/hq-director.ts`
- Test: `src/lib/hq-director.test.ts`

**Interfaces:**
- Consumes: `lastHuntTimeFor`, `huntCooldownMs` (`src/lib/fox-status.ts`), `capitalizeFirstLetter` (`src/lib/utils.ts`), `destination` (`@turf/turf`).
- Produces (all exported from `src/lib/hq-director.ts`):
  - constants `FLY_MS`, `TOUR_DWELL_MS`, `EVENT_HOLD_MS`, `AREA_ZOOM`, `HUNT_ZOOM`, `HOME_ZOOM`
  - `type LngLat = [number, number]`, `type FoxGroup = 'green' | 'orange' | 'red' | 'cooldown'`
  - `GROUP_LABEL: Record<FoxGroup, string>`, `GROUP_TEXT_CLASS: Record<FoxGroup, string>`
  - `interface HqFox { key: string; name: string; group: FoxGroup; cooldownMs: number; lastHunt: Date | string | undefined; center: LngLat | null }`
  - `type TourStop = { kind: 'overview' } | { kind: 'area'; area: string; name: string; group: 'green' | 'orange'; center: LngLat }`
  - `foxGroup(status: string, cooldownMs: number): FoxGroup`
  - `focusPoint(areaKey: string, predictions: Prediction[] | undefined, teams: Team[] | undefined): LngLat | null`
  - `buildFoxes(input: { areas?: Area[]; hunts?: Hunt[]; reports?: HuntReport[]; predictions?: Prediction[]; teams?: Team[]; now: number }): HqFox[]`
  - `teamsBounds(teams: Team[] | undefined): [LngLat, LngLat] | null`
  - `tourStops(foxes: HqFox[]): TourStop[]`
  - `homeTarget(home: LngLat, direction: number | null): LngLat`

- [ ] **Step 1: Write the failing tests** in `src/lib/hq-director.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import { buildFoxes, focusPoint, foxGroup, homeTarget, teamsBounds, tourStops, type HqFox } from './hq-director';
import type { Area } from '@/types/Area';
import type { HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';
import type { Team } from '@/types/Team';

const NOW = Date.parse('2026-10-17T20:00:00Z');
const area = (name: string, status: string) => ({ _id: name, name, status, updatedAt: '' }) as Area;
const team = (areaName: string, lng: number, lat: number) => ({ area: areaName, location: { type: 'Point', coordinates: [lng, lat] } }) as Team;
const prediction = (areaName: string, extra: Partial<Prediction>) => ({ area: areaName, pin: null, lastObservation: null, ...extra }) as Prediction;
const fox = (key: string, group: HqFox['group'], center: HqFox['center'] = [5, 52]): HqFox => ({ key, name: key[0].toUpperCase() + key.slice(1), group, cooldownMs: 0, lastHunt: undefined, center });

describe('foxGroup', () => {
  test('cooldown wins over the status', () => expect(foxGroup('green', 1000)).toBe('cooldown'));
  test('green and orange keep their group', () => {
    expect(foxGroup('green', 0)).toBe('green');
    expect(foxGroup('orange', 0)).toBe('orange');
  });
  test('red and unknown count as red', () => {
    expect(foxGroup('red', 0)).toBe('red');
    expect(foxGroup('', 0)).toBe('red');
  });
});

describe('focusPoint', () => {
  const teams = [team('alpha', 5.0, 52.0), team('alpha', 5.2, 52.2), team('bravo', 6, 53)];
  test('AI pin first', () => {
    const p = [prediction('Alpha', { pin: { lng: 5.5, lat: 52.5 }, lastObservation: { lng: 1, lat: 1, time: '', kind: 'hint' } })];
    expect(focusPoint('alpha', p, teams)).toEqual([5.5, 52.5]);
  });
  test('then the last observation', () => {
    const p = [prediction('alpha', { lastObservation: { lng: 5.3, lat: 52.3, time: '', kind: 'spot' } })];
    expect(focusPoint('alpha', p, teams)).toEqual([5.3, 52.3]);
  });
  test('then the centre of the area groups', () => {
    const [lng, lat] = focusPoint('alpha', [], teams)!;
    expect(lng).toBeCloseTo(5.1);
    expect(lat).toBeCloseTo(52.1);
  });
  test('null without any of those', () => expect(focusPoint('golf', [], teams)).toBeNull());
});

describe('buildFoxes', () => {
  test('groups, cooldown and capitalised name per area', () => {
    const report = { _id: 'r1', area: 'bravo', huntTime: new Date(NOW - 10 * 60_000).toISOString(), huntTimeKnown: true } as HuntReport;
    const foxes = buildFoxes({ areas: [area('alpha', 'green'), area('bravo', 'green')], reports: [report], teams: [team('alpha', 5, 52)], now: NOW });
    expect(foxes.map((f) => [f.key, f.name, f.group])).toEqual([
      ['alpha', 'Alpha', 'green'],
      ['bravo', 'Bravo', 'cooldown'],
    ]);
    expect(foxes[1].cooldownMs).toBe(50 * 60_000);
    expect(foxes[0].center).toEqual([5, 52]);
    expect(foxes[1].center).toBeNull();
  });
  test('no areas yet: empty', () => expect(buildFoxes({ now: NOW })).toEqual([]));
});

describe('teamsBounds', () => {
  test('south-west and north-east corner', () => expect(teamsBounds([team('a', 5, 52), team('b', 6, 51), team('c', 5.5, 53)])).toEqual([[5, 51], [6, 53]]));
  test('null without teams', () => expect(teamsBounds([])).toBeNull());
});

describe('tourStops', () => {
  test('overview first, then active and on-the-way foxes with a location', () => {
    const stops = tourStops([fox('alpha', 'red'), fox('bravo', 'cooldown'), fox('charlie', 'green'), fox('delta', 'orange'), fox('echo', 'green', null)]);
    expect(stops.map((s) => (s.kind === 'area' ? s.area : s.kind))).toEqual(['overview', 'charlie', 'delta']);
  });
  test('only the overview when no fox is tourable', () => expect(tourStops([fox('alpha', 'red')])).toEqual([{ kind: 'overview' }]));
});

describe('homeTarget', () => {
  test('home itself without a direction', () => expect(homeTarget([5.7, 52.1], null)).toEqual([5.7, 52.1]));
  test('250 m into the wind sector', () => {
    const [lng, lat] = homeTarget([5.7, 52.1], 0);
    expect(lng).toBeCloseTo(5.7, 5);
    expect(lat).toBeGreaterThan(52.1);
    expect(lat).toBeLessThan(52.11);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --yes bun test src/lib/hq-director.test.ts`
Expected: FAIL, cannot resolve `./hq-director`.

- [ ] **Step 3: Write `src/lib/hq-director.ts`**

```ts
import { destination } from '@turf/turf';
import type { Area } from '@/types/Area';
import type { Hunt } from '@/types/Hunt';
import type { HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';
import type { Team } from '@/types/Team';
import { huntCooldownMs, lastHuntTimeFor } from './fox-status';
import { capitalizeFirstLetter } from './utils';

/** Camera flight duration (MapLibre flyTo/fitBounds). */
export const FLY_MS = 8000;
/** Time on a tour stop after the flight. */
export const TOUR_DWELL_MS = 20_000;
/** Time an event stays on screen after the flight. */
export const EVENT_HOLD_MS = 30_000;
/** A few km around the fox: town and roads visible, not street level. */
export const AREA_ZOOM = 11.6;
export const HUNT_ZOOM = 12.4;
export const HOME_ZOOM = 12.2;
/** Middle of the 500 m wind sector (see HomeCircle). */
const SECTOR_CENTRE_M = 250;

export type LngLat = [number, number];
export type FoxGroup = 'green' | 'orange' | 'red' | 'cooldown';

export const GROUP_LABEL: Record<FoxGroup, string> = { green: 'Actief', orange: 'Onderweg', red: 'Inactief', cooldown: 'Cooldown' };
/** Same colours as the sidebar's fox groups (FoxPills). */
export const GROUP_TEXT_CLASS: Record<FoxGroup, string> = {
  green: 'text-green-700 dark:text-green-400',
  orange: 'text-orange-700 dark:text-orange-300',
  red: 'text-red-700 dark:text-red-300',
  cooldown: 'text-blue-700 dark:text-blue-300',
};

/** One area's fox on the HQ screen. `key` is the lowercase area name. */
export interface HqFox {
  key: string;
  name: string;
  group: FoxGroup;
  cooldownMs: number;
  lastHunt: Date | string | undefined;
  center: LngLat | null;
}

export type TourStop = { kind: 'overview' } | { kind: 'area'; area: string; name: string; group: 'green' | 'orange'; center: LngLat };

/** Like the sidebar: a fox in its hunt cooldown is listed under cooldown; an unknown status counts as inactive. */
export function foxGroup(status: string, cooldownMs: number): FoxGroup {
  if (cooldownMs > 0) return 'cooldown';
  return status === 'green' || status === 'orange' ? status : 'red';
}

/** Where the camera looks for an area: the AI pin, else the last hint/hunt/spot, else the middle of the area's groups. */
export function focusPoint(areaKey: string, predictions: Prediction[] | undefined, teams: Team[] | undefined): LngLat | null {
  const prediction = predictions?.find((item) => item.area.toLowerCase() === areaKey);
  if (prediction?.pin) return [prediction.pin.lng, prediction.pin.lat];
  if (prediction?.lastObservation) return [prediction.lastObservation.lng, prediction.lastObservation.lat];
  const points = (teams ?? []).filter((team) => team.area?.toLowerCase() === areaKey && team.location?.coordinates?.length === 2).map((team) => team.location.coordinates);
  if (points.length === 0) return null;
  return [points.reduce((sum, [lng]) => sum + lng, 0) / points.length, points.reduce((sum, [, lat]) => sum + lat, 0) / points.length];
}

export function buildFoxes({ areas, hunts, reports, predictions, teams, now }: { areas?: Area[]; hunts?: Hunt[]; reports?: HuntReport[]; predictions?: Prediction[]; teams?: Team[]; now: number }): HqFox[] {
  return (areas ?? []).map((area) => {
    const key = area.name.toLowerCase();
    const lastHunt = lastHuntTimeFor(hunts, area.name, reports);
    const cooldownMs = huntCooldownMs(lastHunt, now);
    return { key, name: capitalizeFirstLetter(area.name), group: foxGroup(area.status, cooldownMs), cooldownMs, lastHunt, center: focusPoint(key, predictions, teams) };
  });
}

/** South-west and north-east corner around all groups: the game area overview. */
export function teamsBounds(teams: Team[] | undefined): [LngLat, LngLat] | null {
  const points = (teams ?? []).map((team) => team.location?.coordinates).filter((point): point is number[] => point?.length === 2);
  if (points.length === 0) return null;
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** The idle tour: the overview, then every active or on-the-way fox with a known location, in area order. */
export function tourStops(foxes: HqFox[]): TourStop[] {
  const stops: TourStop[] = [{ kind: 'overview' }];
  for (const fox of foxes) {
    if ((fox.group === 'green' || fox.group === 'orange') && fox.center) stops.push({ kind: 'area', area: fox.key, name: fox.name, group: fox.group, center: fox.center });
  }
  return stops;
}

/** Tegenhunt camera target: the middle of the wind sector around our clubhouse, or the clubhouse without a direction. */
export function homeTarget(home: LngLat, direction: number | null): LngLat {
  if (direction === null) return home;
  return destination(home, SECTOR_CENTRE_M, direction, { units: 'meters' }).geometry.coordinates as LngLat;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx --yes bun test src/lib/hq-director.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hq-director.ts src/lib/hq-director.test.ts
git commit -m "feat(hq): fox, focus point and tour stop logic for the HQ director

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: HQ logic part 2: events and the event queue

**Files:**
- Modify: `src/lib/hq-director.ts` (append)
- Test: `src/lib/hq-director.test.ts` (append)

**Interfaces:**
- Consumes: `AppNotification` (`src/lib/notifications.ts`), `formatClock`, `joinParts` (`src/lib/format.ts`), Task 2's `HqFox`, `AREA_ZOOM`, `HUNT_ZOOM`.
- Produces:
  - `type HqTone = 'ok' | 'warn' | 'danger' | 'neutral'` (same values as `CookieTone`)
  - `type HqCamera = { kind: 'area'; area: string; zoom: number } | { kind: 'home'; direction: number | null }`
  - `interface HqEvent { key: string; title: string; detail: string; tone: HqTone; camera: HqCamera | null }`
  - `eventFromNotification(notification: AppNotification): HqEvent | null`
  - `newReports(previousIds: ReadonlySet<string> | null, reports: HuntReport[]): HuntReport[]`
  - `huntEvent(report: HuntReport): HqEvent`
  - `endedCooldowns(previous: ReadonlyMap<string, number> | null, foxes: HqFox[]): HqFox[]`
  - `cooldownEvent(fox: HqFox): HqEvent`
  - `interface DirectorState { current: HqEvent | null; queue: HqEvent[]; tourIndex: number; step: number }`, `INITIAL_DIRECTOR: DirectorState`
  - `enqueue(state: DirectorState, events: HqEvent[]): DirectorState`, `advance(state: DirectorState): DirectorState`

- [ ] **Step 1: Append the failing tests** to `src/lib/hq-director.test.ts`

Add to the import from `./hq-director`: `advance, cooldownEvent, endedCooldowns, enqueue, eventFromNotification, huntEvent, INITIAL_DIRECTOR, newReports, type HqEvent`, and add `import type { AppNotification } from './notifications';`. Then append:

```ts
const note = (type: AppNotification['type'], data: AppNotification['data'] = {}): AppNotification => ({ id: `n-${type}`, type, title: 'Titel', body: 'Tekst', urgent: true, data, createdAt: '' });
const ev = (key: string): HqEvent => ({ key, title: key, detail: '', tone: 'neutral', camera: null });

describe('eventFromNotification', () => {
  test('fox status flies to the area', () => {
    expect(eventFromNotification(note('fox-status', { area: 'Delta', status: 'green', previousStatus: 'orange' }))).toEqual({
      key: 'area:delta',
      title: 'Delta is Actief',
      detail: 'Was Onderweg',
      tone: 'ok',
      camera: { kind: 'area', area: 'delta', zoom: 11.6 },
    });
  });
  test('fox status without an area is ignored', () => expect(eventFromNotification(note('fox-status', { status: 'green' }))).toBeNull());
  test('tegenhunt flies home with the direction', () => {
    const event = eventFromNotification(note('counter-hunt', { direction: 90 }))!;
    expect(event.tone).toBe('danger');
    expect(event.camera).toEqual({ kind: 'home', direction: 90 });
  });
  test('broadcast, deadline and happy hour: warn card, no camera', () => {
    for (const type of ['broadcast', 'hunt-deadline', 'happy-hour'] as const) {
      expect(eventFromNotification(note(type))).toEqual({ key: `n-${type}`, title: 'Titel', detail: 'Tekst', tone: 'warn', camera: null });
    }
  });
  test('hint and article: neutral card, no camera', () => expect(eventFromNotification(note('hint'))?.tone).toBe('neutral'));
});

describe('new hunts', () => {
  const report = (id: string) => ({ _id: id, area: 'bravo', huntCode: '7KQ2XM', reportedByName: 'Jesse' }) as HuntReport;
  test('nothing on the first load', () => expect(newReports(null, [report('a')])).toEqual([]));
  test('reports not seen before', () => expect(newReports(new Set(['a']), [report('b'), report('a')]).map((r) => r._id)).toEqual(['b']));
  test('hunt event', () => {
    expect(huntEvent(report('b'))).toEqual({
      key: 'area:bravo',
      title: 'Hunt op Bravo!',
      detail: '7KQ2XM · door Jesse · cooldown gestart',
      tone: 'ok',
      camera: { kind: 'area', area: 'bravo', zoom: 12.4 },
    });
    expect(huntEvent({ ...report('c'), huntCode: null }).detail).toBe('Code wordt gelezen · door Jesse · cooldown gestart');
  });
});

describe('ended cooldowns', () => {
  test('nothing on the first check', () => expect(endedCooldowns(null, [fox('bravo', 'green')])).toEqual([]));
  test('cooldown went to 0 on a huntable fox', () => {
    const previous = new Map([['bravo', 1000], ['golf', 1000], ['charlie', 0]]);
    expect(endedCooldowns(previous, [fox('bravo', 'green'), fox('golf', 'red'), fox('charlie', 'green')]).map((f) => f.key)).toEqual(['bravo']);
  });
  test('cooldown event', () => {
    expect(cooldownEvent({ ...fox('foxtrot', 'green'), lastHunt: '2026-10-17T18:31:00Z' })).toEqual({
      key: 'area:foxtrot',
      title: 'Foxtrot is weer te hunten',
      detail: 'Cooldown voorbij · laatste hunt 20:31',
      tone: 'ok',
      camera: { kind: 'area', area: 'foxtrot', zoom: 11.6 },
    });
  });
});

describe('director queue', () => {
  test('first event interrupts the tour', () => {
    const state = enqueue(INITIAL_DIRECTOR, [ev('a'), ev('b')]);
    expect(state.current?.key).toBe('a');
    expect(state.queue.map((e) => e.key)).toEqual(['b']);
    expect(state.step).toBe(1);
  });
  test('a queued event with the same key is replaced in place', () => {
    const state = enqueue(enqueue(INITIAL_DIRECTOR, [ev('a'), ev('b'), ev('c')]), [{ ...ev('b'), title: 'nieuw' }]);
    expect(state.queue.map((e) => e.title)).toEqual(['nieuw', 'c']);
    expect(state.step).toBe(1);
  });
  test('an event for what is on screen is dropped', () => expect(enqueue(enqueue(INITIAL_DIRECTOR, [ev('a')]), [ev('a')]).queue).toEqual([]));
  test('advance plays the queue, then resumes the tour at the next stop', () => {
    let state = enqueue({ ...INITIAL_DIRECTOR, tourIndex: 2 }, [ev('a'), ev('b')]);
    state = advance(state);
    expect(state.current?.key).toBe('b');
    state = advance(state);
    expect(state.current).toBeNull();
    expect(state.tourIndex).toBe(3);
    expect(state.step).toBe(3);
  });
  test('advance on the tour goes to the next stop', () => expect(advance(INITIAL_DIRECTOR)).toEqual({ current: null, queue: [], tourIndex: 1, step: 1 }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --yes bun test src/lib/hq-director.test.ts`
Expected: FAIL, missing exports (`enqueue`, `eventFromNotification`, …).

- [ ] **Step 3: Append the implementation** to `src/lib/hq-director.ts`

Add to the imports at the top:

```ts
import type { AppNotification } from './notifications';
import { formatClock, joinParts } from './format';
```

Append:

```ts
/** Card colour (same values as CookieBadge's tone). */
export type HqTone = 'ok' | 'warn' | 'danger' | 'neutral';
export type HqCamera = { kind: 'area'; area: string; zoom: number } | { kind: 'home'; direction: number | null };

/** Something shown in the event card; `key` collapses repeats (e.g. a hunt and its status change on one area). */
export interface HqEvent {
  key: string;
  title: string;
  detail: string;
  tone: HqTone;
  /** null = the camera holds still while the card shows */
  camera: HqCamera | null;
}

const STATUS_WORD: Record<string, string> = { green: 'Actief', orange: 'Onderweg', red: 'Inactief' };

export function eventFromNotification(notification: AppNotification): HqEvent | null {
  const { type, data, title, body, id } = notification;
  switch (type) {
    case 'fox-status': {
      const area = data.area?.toLowerCase();
      if (!area) return null;
      const status = data.status ?? '';
      const previous = data.previousStatus && STATUS_WORD[data.previousStatus];
      return {
        key: `area:${area}`,
        title: `${capitalizeFirstLetter(area)} is ${STATUS_WORD[status] ?? status}`,
        detail: previous ? `Was ${previous}` : body,
        tone: status === 'green' ? 'ok' : status === 'orange' ? 'warn' : 'neutral',
        camera: { kind: 'area', area, zoom: AREA_ZOOM },
      };
    }
    case 'counter-hunt':
      return { key: 'counter-hunt', title: title || 'Tegenhunt!', detail: body, tone: 'danger', camera: { kind: 'home', direction: data.direction ?? null } };
    case 'broadcast':
    case 'hunt-deadline':
    case 'happy-hour':
      return { key: id, title, detail: body, tone: 'warn', camera: null };
    default:
      return { key: id, title, detail: body, tone: 'neutral', camera: null };
  }
}

/** Reports that weren't there at the previous check; none on the first check (no replay after a reload). */
export function newReports(previousIds: ReadonlySet<string> | null, reports: HuntReport[]): HuntReport[] {
  if (!previousIds) return [];
  return reports.filter((report) => !previousIds.has(report._id));
}

export function huntEvent(report: HuntReport): HqEvent {
  const area = report.area.toLowerCase();
  return {
    key: `area:${area}`,
    title: `Hunt op ${capitalizeFirstLetter(area)}!`,
    detail: joinParts(report.huntCode ?? 'Code wordt gelezen', `door ${report.reportedByName}`, 'cooldown gestart'),
    tone: 'ok',
    camera: { kind: 'area', area, zoom: HUNT_ZOOM },
  };
}

/** Foxes whose cooldown ran out since the previous check and that can be hunted (not red); none on the first check. */
export function endedCooldowns(previous: ReadonlyMap<string, number> | null, foxes: HqFox[]): HqFox[] {
  if (!previous) return [];
  return foxes.filter((fox) => (previous.get(fox.key) ?? 0) > 0 && fox.cooldownMs === 0 && fox.group !== 'red');
}

export function cooldownEvent(fox: HqFox): HqEvent {
  return {
    key: `area:${fox.key}`,
    title: `${fox.name} is weer te hunten`,
    detail: fox.lastHunt ? `Cooldown voorbij · laatste hunt ${formatClock(fox.lastHunt)}` : 'Cooldown voorbij',
    tone: 'ok',
    camera: { kind: 'area', area: fox.key, zoom: AREA_ZOOM },
  };
}

/** `step` changes on every camera move: the director flies and restarts its timer per step. */
export interface DirectorState {
  current: HqEvent | null;
  queue: HqEvent[];
  tourIndex: number;
  step: number;
}

export const INITIAL_DIRECTOR: DirectorState = { current: null, queue: [], tourIndex: 0, step: 0 };

/** Queue events (FIFO); a repeat of what's on screen is dropped, a repeat of a queued one replaces it. The first event interrupts the tour. */
export function enqueue(state: DirectorState, events: HqEvent[]): DirectorState {
  let queue = state.queue;
  for (const event of events) {
    if (state.current?.key === event.key) continue;
    const index = queue.findIndex((queued) => queued.key === event.key);
    queue = index >= 0 ? queue.map((queued, i) => (i === index ? event : queued)) : [...queue, event];
  }
  if (state.current || queue.length === 0) return { ...state, queue };
  const [current, ...rest] = queue;
  return { ...state, current, queue: rest, step: state.step + 1 };
}

/** Timer ran out: next queued event, else back to the tour at its next stop, else the next tour stop. */
export function advance(state: DirectorState): DirectorState {
  if (state.current) {
    const [next, ...rest] = state.queue;
    if (next) return { ...state, current: next, queue: rest, step: state.step + 1 };
    return { ...state, current: null, queue: [], tourIndex: state.tourIndex + 1, step: state.step + 1 };
  }
  return { ...state, tourIndex: state.tourIndex + 1, step: state.step + 1 };
}
```

Note: `formatClock` formats in Europe/Amsterdam; `2026-10-17T18:31:00Z` is 20:31 there (CEST), matching the test.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx --yes bun test src/lib/hq-director.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hq-director.ts src/lib/hq-director.test.ts
git commit -m "feat(hq): event mapping and event queue for the HQ director

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Map wall mode, overlay slot and fitBounds

**Files:**
- Modify: `src/components/Map.tsx`

**Interfaces:**
- Produces: `MapRef.fitBounds(bounds: FitBoundsArgs[0], options?: FitBoundsArgs[1]): void`; `Map` props `{ className?: string; wall?: boolean; overlay?: ReactNode }`. With `wall`: no zoom/locate/fullscreen/ruler/scale controls, no location popup, no user interaction (`interactive={false}`). `overlay` renders inside the MapLibre map (for react-map-gl `<Marker>`s). Default behaviour unchanged.

- [ ] **Step 1: Edit `src/components/Map.tsx`**

Change the react import to include `type ReactNode`:

```ts
import {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode} from 'react';
```

Replace the `FlyToOpts` type and `MapRef` interface with:

```ts
type FlyToOpts = NonNullable<Parameters<MaplibreMap["flyTo"]>[0]>;
type FitBoundsArgs = Parameters<MaplibreMap["fitBounds"]>;

export interface MapRef {
    flyTo(options: FlyToOpts): void;

    fitBounds(bounds: FitBoundsArgs[0], options?: FitBoundsArgs[1]): void;

    markPoint(lngLat: LngLat): void;
}

interface MapProps {
    className?: string;
    /** HQ wall screen: no controls, no location popup, no user interaction */
    wall?: boolean;
    /** Rendered inside the map, e.g. react-map-gl Markers */
    overlay?: ReactNode;
}
```

Change the component signature to:

```ts
const Map = forwardRef<MapRef, MapProps>(({className, wall = false, overlay}, ref) => {
```

In `useImperativeHandle`, after the `flyTo` entry add:

```ts
        fitBounds: (bounds, options) => {
            mapRef.current?.fitBounds(bounds, options);
        },
```

On `<Maplibre …>` replace `onClick={openPopup}` with:

```tsx
                interactive={!wall}
                onClick={wall ? undefined : openPopup}
```

Change `{!isMobile && (` (the controls block) to `{!isMobile && !wall && (`, and change `{popupPosition && <PickedLocationPopup` to `{popupPosition && !wall && <PickedLocationPopup`. After `<LayerStack/>` add:

```tsx
                {overlay}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b && npm run lint`
Expected: no errors. (If another file implements `MapRef` by hand, tsc reports it: add a `fitBounds` that forwards to the map or is a no-op there.)

- [ ] **Step 3: Commit**

```bash
git add src/components/Map.tsx
git commit -m "feat(map): wall mode, overlay slot and fitBounds on the map ref

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Director store and hooks

**Files:**
- Create: `src/stores/hq-director.store.ts`, `src/hooks/hq-director.hook.ts`, `src/hooks/hq-events.hook.ts`

**Interfaces:**
- Consumes: Task 2/3 exports; `MapRef` (Task 4); `Team` type.
- Produces:
  - `useHqDirectorStore` (zustand): `DirectorState & { push(events: HqEvent[]): void; advance(): void; reset(): void }`
  - `useHqDirector({ mapRef, foxes, teams, homeTeam }: { mapRef: RefObject<MapRef | null>; foxes: HqFox[]; teams: Team[] | undefined; homeTeam: Team | undefined }): { current: HqEvent | null; queued: number; stop: TourStop; stopIndex: number; stopCount: number; step: number; focusArea: string | null }`
  - `useHqEventSources(foxes: HqFox[], reports: HuntReport[] | undefined): void`

- [ ] **Step 1: Create `src/stores/hq-director.store.ts`**

```ts
import { create } from 'zustand';
import { advance, enqueue, INITIAL_DIRECTOR, type DirectorState, type HqEvent } from '@/lib/hq-director';

interface HqDirectorStore extends DirectorState {
  push: (events: HqEvent[]) => void;
  advance: () => void;
  reset: () => void;
}

/** The HQ camera director: what's on screen (event or tour stop) and what's queued. Not persisted. */
const useHqDirectorStore = create<HqDirectorStore>((set) => ({
  ...INITIAL_DIRECTOR,
  push: (events) => {
    if (events.length > 0) set((state) => enqueue(state, events));
  },
  advance: () => set((state) => advance(state)),
  reset: () => set(INITIAL_DIRECTOR),
}));

export default useHqDirectorStore;
```

- [ ] **Step 2: Create `src/hooks/hq-director.hook.ts`**

```ts
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MapRef } from '@/components/Map';
import { AREA_ZOOM, EVENT_HOLD_MS, FLY_MS, HOME_ZOOM, homeTarget, teamsBounds, tourStops, TOUR_DWELL_MS, type HqFox, type LngLat } from '@/lib/hq-director';
import useHqDirectorStore from '@/stores/hq-director.store';
import type { Team } from '@/types/Team';

const FLIGHT = { duration: FLY_MS, curve: 1.25 };
const OVERVIEW_PADDING = 40;

/**
 * Drives the HQ map: on every director step it flies to the event or the tour stop, and advances after the hold/dwell
 * time. Returns what the overlays need.
 */
export function useHqDirector({ mapRef, foxes, teams, homeTeam }: { mapRef: RefObject<MapRef | null>; foxes: HqFox[]; teams: Team[] | undefined; homeTeam: Team | undefined }) {
  const { current, queue, tourIndex, step } = useHqDirectorStore(useShallow((state) => ({ current: state.current, queue: state.queue, tourIndex: state.tourIndex, step: state.step })));
  const advance = useHqDirectorStore((state) => state.advance);
  const reset = useHqDirectorStore((state) => state.reset);
  const stops = useMemo(() => tourStops(foxes), [foxes]);
  const stopIndex = tourIndex % stops.length;
  const stop = stops[stopIndex];

  // Read by the step effect: the data changes every second, the camera only per step
  const latest = useRef({ stop, foxes, teams, homeTeam, current });
  useEffect(() => {
    latest.current = { stop, foxes, teams, homeTeam, current };
  });

  useEffect(() => {
    const { stop, foxes, teams, homeTeam, current } = latest.current;
    const map = mapRef.current;
    const fly = (center: LngLat, zoom: number) => map?.flyTo({ center, zoom, ...FLIGHT });
    if (current) {
      const camera = current.camera;
      if (camera?.kind === 'area') {
        const center = foxes.find((fox) => fox.key === camera.area)?.center;
        if (center) fly(center, camera.zoom);
      } else if (camera?.kind === 'home' && homeTeam) {
        fly(homeTarget(homeTeam.location.coordinates as LngLat, camera.direction), HOME_ZOOM);
      }
    } else if (stop.kind === 'area') {
      fly(stop.center, AREA_ZOOM);
    } else {
      const bounds = teamsBounds(teams);
      if (bounds) map?.fitBounds(bounds, { padding: OVERVIEW_PADDING, duration: FLY_MS });
    }
    const timer = setTimeout(advance, FLY_MS + (current ? EVENT_HOLD_MS : TOUR_DWELL_MS));
    return () => clearTimeout(timer);
  }, [step, mapRef, advance]);

  useEffect(() => reset, [reset]);

  const focusArea = current ? (current.camera?.kind === 'area' ? current.camera.area : null) : stop.kind === 'area' ? stop.area : null;
  return { current, queued: queue.length, stop, stopIndex, stopCount: stops.length, step, focusArea };
}
```

- [ ] **Step 3: Create `src/hooks/hq-events.hook.ts`**

```ts
import { useEffect, useRef } from 'react';
import { cooldownEvent, endedCooldowns, huntEvent, newReports, type HqFox } from '@/lib/hq-director';
import useHqDirectorStore from '@/stores/hq-director.store';
import type { HuntReport } from '@/types/HuntReport';

/** Events the notification feed doesn't send: a newly registered hunt and a fox whose cooldown ran out. */
export function useHqEventSources(foxes: HqFox[], reports: HuntReport[] | undefined) {
  const push = useHqDirectorStore((state) => state.push);

  const seenReports = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!reports) return;
    const fresh = newReports(seenReports.current, reports);
    seenReports.current = new Set(reports.map((report) => report._id));
    push(fresh.map(huntEvent));
  }, [reports, push]);

  const cooldowns = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    if (foxes.length === 0) return;
    const ended = endedCooldowns(cooldowns.current, foxes);
    cooldowns.current = new Map(foxes.map((fox) => [fox.key, fox.cooldownMs]));
    push(ended.map(cooldownEvent));
  }, [foxes, push]);
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/hq-director.store.ts src/hooks/hq-director.hook.ts src/hooks/hq-events.hook.ts
git commit -m "feat(hq): director store, camera hook and hunt/cooldown event sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Panel components (top card, fox board, hunts)

**Files:**
- Create: `src/components/hq/HqTopCard.tsx`, `src/components/hq/FoxBoard.tsx`, `src/components/hq/HqHunts.tsx`

**Interfaces:**
- Consumes: `useNextHint` (`@/hooks/next-hint.hook`), `useHuntReports`, `useHunts`, `useArticles`, `huntListItems`, `totalPoints` (`@/lib/hunt-reports`), `latestNonHintArticle` (`@/lib/hq`), `formatClock`, `formatCountdown`, `CookieBadge`, `HuntTimelineItem`, Task 2's `HqFox`, `GROUP_LABEL`, `GROUP_TEXT_CLASS`.
- Produces: `HqTopCard({ now: number })`, `FoxBoard({ foxes: HqFox[]; focusArea: string | null })`, `HqHunts({ now: number })` (default exports).

- [ ] **Step 1: Create `src/components/hq/HqTopCard.tsx`**

```tsx
import { useArticles } from '@/hooks/articles.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useNextHint } from '@/hooks/next-hint.hook';
import { formatClock, formatCountdown } from '@/lib/format';
import { latestNonHintArticle } from '@/lib/hq';
import { huntListItems, totalPoints } from '@/lib/hunt-reports';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<string, string> = { assignment: 'Opdracht', news: 'Nieuws' };

/** Clock, next hint, hunts and points; plus the open assignment and its deadline while one runs. */
export default function HqTopCard({ now }: { now: number }) {
  const { label, isNewHint } = useNextHint();
  const { reports } = useHuntReports();
  const { hunts } = useHunts();
  const { articles } = useArticles();
  const items = huntListItems(reports, hunts);
  const article = latestNonHintArticle(articles);
  const left = article?.endTime ? new Date(article.endTime).getTime() - now : 0;

  return (
    <section className="card flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 text-card-foreground">
      <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-5">
        <div className="text-[2.9rem] font-bold leading-[0.9] tracking-tight tabular-nums">{formatClock(now)}</div>
        <div>
          <div className="text-sm text-muted-foreground">Volgende hint</div>
          <div className={cn('text-[1.6rem] font-bold leading-tight tabular-nums text-primary', isNewHint && 'text-green-700 dark:text-green-400')}>{label}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground tabular-nums">{items.length} hunts</div>
          <div className="text-[1.6rem] font-bold leading-tight tabular-nums">{totalPoints(items)} pt</div>
        </div>
      </div>
      {article && left > 0 && (
        <div className="flex items-baseline gap-2 border-t pt-2">
          <span className="font-semibold text-primary">{TYPE_LABEL[article.type] ?? 'Opdracht'}</span>
          <span className="min-w-0 flex-1 truncate">{article.title}</span>
          <span className="font-semibold tabular-nums text-primary">{formatCountdown(left)}</span>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Create `src/components/hq/FoxBoard.tsx`**

```tsx
import CookieBadge from '@/components/tracker/CookieBadge';
import { formatClock, formatCountdown } from '@/lib/format';
import { GROUP_LABEL, GROUP_TEXT_CLASS, type HqFox } from '@/lib/hq-director';
import { cn, getColorFromArea } from '@/lib/utils';

function FoxTile({ fox, focused }: { fox: HqFox; focused: boolean }) {
  const cooldown = fox.group === 'cooldown';
  return (
    <div
      className={cn(
        'card flex min-w-0 flex-col gap-0.5 rounded-2xl bg-card px-3 py-2.5 text-card-foreground outline-3 -outline-offset-1 outline-transparent transition-[outline-color,scale] duration-600 motion-reduce:transition-none',
        focused && 'scale-[1.03] outline-primary',
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(fox.key) }} />
        <span className="truncate">{fox.name}</span>
        {fox.group === 'green' && <CookieBadge tone="ok" size={24} className="ml-auto size-[1.4rem]" />}
      </div>
      <div className={cn('text-[1.55rem] font-bold leading-tight tabular-nums', GROUP_TEXT_CLASS[fox.group])}>{cooldown ? formatCountdown(fox.cooldownMs) : GROUP_LABEL[fox.group]}</div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {cooldown && 'cooldown · '}hunt {fox.lastHunt ? formatClock(fox.lastHunt) : '–'}
      </div>
    </div>
  );
}

/** All areas as tiles (3 per row); the one the camera looks at is outlined. */
export default function FoxBoard({ foxes, focusArea }: { foxes: HqFox[]; focusArea: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {foxes.map((fox) => (
        <FoxTile key={fox.key} fox={fox} focused={fox.key === focusArea} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/hq/HqHunts.tsx`**

```tsx
import HuntTimelineItem from '@/components/hunts/HuntTimelineItem';
import { useHuntReports } from '@/hooks/hunt-reports.hook';

const FEED_SIZE = 3;
const noop = () => {};

/** The newest hunts on the sidebar's timeline; a new one slides in at the top. */
export default function HqHunts({ now }: { now: number }) {
  const { reports } = useHuntReports();
  const latest = (reports ?? []).slice(0, FEED_SIZE);

  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card px-3.5 pb-3 pt-2.5 text-card-foreground">
      <header className="mb-1 flex items-center justify-between">
        <span className="font-semibold">Hunts</span>
        <span className="text-sm text-muted-foreground">laatste {FEED_SIZE}</span>
      </header>
      {latest.map((report, i) => (
        <div key={report._id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-1000">
          <HuntTimelineItem report={report} now={now} last={i === latest.length - 1} onSelect={noop} />
        </div>
      ))}
      {reports?.length === 0 && <p className="text-muted-foreground">Nog geen hunts.</p>}
    </section>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/hq/HqTopCard.tsx src/components/hq/FoxBoard.tsx src/components/hq/HqHunts.tsx
git commit -m "feat(hq): top card, fox board and hunts card for the HQ panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Map overlays (tour chip, event card, focus pulse)

**Files:**
- Create: `src/components/hq/TourChip.tsx`, `src/components/hq/HqEventCard.tsx`, `src/components/hq/FocusPulse.tsx`
- Modify: `src/index.css` (append keyframes)

**Interfaces:**
- Consumes: `TimerRing`, `StepDots` (Task 1), `CookieBadge`, Task 2/3 `TourStop`, `HqEvent`, `HqTone`, `GROUP_LABEL`, `FLY_MS`, `TOUR_DWELL_MS`, `EVENT_HOLD_MS`, `LngLat`.
- Produces: `TourChip({ stop: TourStop; index: number; count: number; step: number; hidden: boolean })`, `HqEventCard({ event: HqEvent | null; queued: number; step: number })`, `FocusPulse({ center: LngLat; color: string })` (default exports).

- [ ] **Step 1: Append to `src/index.css`** (at the end of the file)

```css
/* HQ screen: ring around the fox the camera looks at */
@keyframes hq-pulse {
  from {
    transform: scale(0.5);
    opacity: 0.9;
  }
  to {
    transform: scale(1.6);
    opacity: 0;
  }
}
```

- [ ] **Step 2: Create `src/components/hq/FocusPulse.tsx`**

```tsx
import { Marker } from 'react-map-gl/maplibre';
import type { LngLat } from '@/lib/hq-director';

/** Pulsing ring in the area colour around the fox the HQ camera looks at (rendered inside the map). */
export default function FocusPulse({ center, color }: { center: LngLat; color: string }) {
  return (
    <Marker longitude={center[0]} latitude={center[1]} anchor="center">
      <span className="pointer-events-none block size-16 rounded-full border-[3px] motion-safe:animate-[hq-pulse_2.4s_ease-out_infinite]" style={{ borderColor: color }} />
    </Marker>
  );
}
```

- [ ] **Step 3: Create `src/components/hq/TourChip.tsx`**

```tsx
import StepDots from '@/components/tour/StepDots';
import TimerRing from '@/components/tour/TimerRing';
import { FLY_MS, GROUP_LABEL, TOUR_DWELL_MS, type TourStop } from '@/lib/hq-director';
import { cn, getColorFromArea } from '@/lib/utils';

/** Top-left on the map: which tour stop is on screen, the time until the next one (tour ring) and the stops (tour dots). */
export default function TourChip({ stop, index, count, step, hidden }: { stop: TourStop; index: number; count: number; step: number; hidden: boolean }) {
  return (
    <div
      className={cn(
        'card absolute left-4 top-4 z-10 flex items-center gap-3 rounded-2xl bg-card py-1.5 pl-1.5 pr-4 text-card-foreground shadow-lg transition-opacity duration-600 motion-reduce:transition-none',
        hidden && 'opacity-0',
      )}
    >
      <TimerRing className="size-9" durationMs={FLY_MS + TOUR_DWELL_MS} runKey={step}>
        <span className="size-3 rounded-full" style={{ backgroundColor: stop.kind === 'area' ? getColorFromArea(stop.area) : 'var(--muted-foreground)' }} />
      </TimerRing>
      <span>
        <span className="text-muted-foreground">Rondleiding</span> · <span className="font-semibold">{stop.kind === 'area' ? `${stop.name} · ${GROUP_LABEL[stop.group]}` : 'Overzicht'}</span>
      </span>
      <StepDots count={count} index={index} />
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/hq/HqEventCard.tsx`**

```tsx
import { useState } from 'react';
import StepDots from '@/components/tour/StepDots';
import TimerRing from '@/components/tour/TimerRing';
import CookieBadge from '@/components/tracker/CookieBadge';
import { EVENT_HOLD_MS, FLY_MS, type HqEvent, type HqTone } from '@/lib/hq-director';
import { cn } from '@/lib/utils';

const RING_CLASS: Record<HqTone, string> = { ok: 'stroke-green-500', warn: 'stroke-amber-500', danger: 'stroke-red-600', neutral: 'stroke-primary' };

/** Bottom of the map: the current event, its hold time (tour ring in the event colour) and how many are queued (tour dots). */
export default function HqEventCard({ event, queued, step }: { event: HqEvent | null; queued: number; step: number }) {
  // Keep the last event while the card slides out
  const [shown, setShown] = useState(event);
  if (event && event !== shown) setShown(event);

  return (
    <div
      aria-live="polite"
      className={cn(
        'card absolute inset-x-4 bottom-4 z-10 flex items-center gap-4 rounded-2xl bg-card px-5 py-4 text-card-foreground shadow-2xl transition-[translate,opacity] duration-900 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
        event ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[130%] opacity-0',
      )}
    >
      {shown && (
        <>
          <TimerRing className="size-16 shrink-0" durationMs={FLY_MS + EVENT_HOLD_MS} runKey={step} progressClassName={RING_CLASS[shown.tone]}>
            <CookieBadge tone={shown.tone} size={44} glyph={shown.tone === 'neutral' ? 'i' : undefined} className="size-11" />
          </TimerRing>
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl font-bold leading-tight">{shown.title}</p>
            <p className="truncate text-muted-foreground">{shown.detail}</p>
          </div>
          <StepDots count={queued + 1} index={0} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/components/hq/TourChip.tsx src/components/hq/HqEventCard.tsx src/components/hq/FocusPulse.tsx
git commit -m "feat(hq): tour chip, event card and focus pulse map overlays

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Rebuild the HQ page, restyle AudioUnlock, remove the old screen

**Files:**
- Rewrite: `src/pages/Hq.tsx`
- Modify: `src/components/hq/AudioUnlock.tsx`, `src/lib/hq.ts`, `src/lib/hq.test.ts`
- Delete: `src/components/hq/AlertBanner.tsx`, `src/components/hq/AreaTiles.tsx`, `src/components/hq/HqClock.tsx`, `src/components/hq/HuntFeed.tsx`, `src/components/hq/LatestArticle.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–7; `useAreas`, `useHunts`, `useHuntReports`, `usePredictions`, `useTeams`, `isHomeTeam`, `useNow`, `useNotificationFeed`, `useTheme`, `useSessionExpired`, `isUnauthorized`.

- [ ] **Step 1: Rewrite `src/pages/Hq.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { SWRConfig } from 'swr';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import Map, { type MapRef } from '@/components/Map';
import AudioUnlock from '@/components/hq/AudioUnlock';
import FocusPulse from '@/components/hq/FocusPulse';
import FoxBoard from '@/components/hq/FoxBoard';
import HqEventCard from '@/components/hq/HqEventCard';
import HqHunts from '@/components/hq/HqHunts';
import HqTopCard from '@/components/hq/HqTopCard';
import TourChip from '@/components/hq/TourChip';
import DemoReloader from '@/components/DemoReloader';
import ErrorBoundary from '@/components/ErrorBoundary';
import StaleDataBadge from '@/components/StaleDataBadge';
import { useAreas } from '@/hooks/areas.hook';
import { useHqDirector } from '@/hooks/hq-director.hook';
import { useHqEventSources } from '@/hooks/hq-events.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useNotificationFeed } from '@/hooks/notification-feed.hook';
import { useNow } from '@/hooks/now.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import { useSessionExpired } from '@/hooks/session.hook';
import { isHomeTeam, useTeams } from '@/hooks/teams.hook';
import { useTheme } from '@/hooks/theme.hook';
import { buildFoxes, eventFromNotification, type HqEvent } from '@/lib/hq-director';
import { isUnauthorized } from '@/lib/session';
import { getColorFromArea } from '@/lib/utils';
import useHqDirectorStore from '@/stores/hq-director.store';
import type { User } from '@/types/User';

/** Everything on the screen is sized in rem: scale the root font with the screen width, so 1080p and a beamer look alike. */
const WALL_FONT_SIZE = '1.3vw';

/** Admin-only wall display for the HQ beamer: a map that tours the active foxes and flies to events, plus the fox board. */
export default function Hq() {
  const endSession = useSessionExpired();
  // Outside Layout, so it needs its own handler: an expired session sends the TV to the login page
  return (
    <SWRConfig value={{ onError: (error) => isUnauthorized(error) && endSession() }}>
      <DemoReloader />
      <StaleDataBadge />
      <HqScreen onUnauthorized={endSession} />
    </SWRConfig>
  );
}

function HqScreen({ onUnauthorized }: { onUnauthorized: () => void }) {
  const user = useAuthUser<User>();
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const push = useHqDirectorStore((state) => state.push);
  useTheme();

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.fontSize;
    html.style.fontSize = WALL_FONT_SIZE;
    return () => {
      html.style.fontSize = previous;
    };
  }, []);

  useNotificationFeed({
    respectPreferences: false,
    toasts: false,
    onUnauthorized,
    onPoll: (alerted) => push(alerted.map(eventFromNotification).filter((event): event is HqEvent => event !== null)),
  });

  const now = useNow(true);
  const { areas } = useAreas();
  const { hunts } = useHunts();
  const { reports } = useHuntReports();
  const { predictions } = usePredictions();
  const { teams } = useTeams();
  const homeTeam = teams?.find(isHomeTeam);
  const foxes = useMemo(() => buildFoxes({ areas, hunts, reports, predictions, teams, now }), [areas, hunts, reports, predictions, teams, now]);
  useHqEventSources(foxes, reports);
  const director = useHqDirector({ mapRef, foxes, teams, homeTeam });
  const focusFox = foxes.find((fox) => fox.key === director.focusArea);

  if (!user?.admin) return <Navigate to="/" replace />;

  return (
    <div className="grid h-dvh w-dvw grid-cols-[58fr_42fr] overflow-hidden bg-background text-foreground">
      <div className="relative min-h-0 overflow-hidden rounded-r-2xl">
        <ErrorBoundary name="De kaart" className="m-auto w-fit">
          <Map ref={mapRef} wall className="absolute inset-0" overlay={focusFox?.center && <FocusPulse center={focusFox.center} color={getColorFromArea(focusFox.key)} />} />
        </ErrorBoundary>
        <TourChip stop={director.stop} index={director.stopIndex} count={director.stopCount} step={director.step} hidden={!!director.current} />
        <HqEventCard event={director.current} queued={director.queued} step={director.step} />
      </div>
      <aside className="flex min-h-0 flex-col gap-2 p-3">
        <ErrorBoundary>
          <HqTopCard now={now} />
        </ErrorBoundary>
        <ErrorBoundary>
          <FoxBoard foxes={foxes} focusArea={director.focusArea} />
        </ErrorBoundary>
        <ErrorBoundary>
          <HqHunts now={now} />
        </ErrorBoundary>
      </aside>
      {!audioUnlocked && <AudioUnlock onUnlock={() => setAudioUnlocked(true)} />}
    </div>
  );
}
```

- [ ] **Step 2: Restyle `src/components/hq/AudioUnlock.tsx`**

```tsx
import { Volume2Icon } from 'lucide-react';

/** Browsers block sound until the first click; the HQ screen asks for one. */
export default function AudioUnlock({ onUnlock }: { onUnlock: () => void }) {
  return (
    <button type="button" onClick={onUnlock} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <span className="card flex flex-col items-center gap-3 rounded-2xl bg-card px-8 py-6 text-card-foreground shadow-2xl">
        <Volume2Icon className="size-12 text-primary" />
        <span className="text-2xl font-semibold">Klik om geluid aan te zetten</span>
        <span className="text-muted-foreground">Browsers spelen pas geluid af na één klik</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Remove the old screen**

```bash
git rm src/components/hq/AlertBanner.tsx src/components/hq/AreaTiles.tsx src/components/hq/HqClock.tsx src/components/hq/HuntFeed.tsx src/components/hq/LatestArticle.tsx
```

In `src/lib/hq.ts` delete the `bannerClass` function and the `import type { AppNotification } from './notifications';` line. In `src/lib/hq.test.ts` delete the `test('bannerClass per type', …)` block and change the import to `import { latestNonHintArticle } from './hq';`.

Run: `grep -rn "bannerClass\|AlertBanner\|AreaTiles\|HqClock\|HuntFeed\|LatestArticle" src`
Expected: no output.

- [ ] **Step 4: Verify**

Run: `npx --yes bun test && npx tsc -b && npm run lint`
Expected: all tests pass, no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/pages/Hq.tsx src/components/hq src/lib/hq.ts src/lib/hq.test.ts
git commit -m "feat(hq): rebuild the HQ screen as the Vossenbord with a map camera director

Removes the full-screen alert flash; every alert now shows in the map's event card.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Manual verification

**Files:** none (fixes found here go in a follow-up commit).

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: vite build + `tsc -b` succeed.

- [ ] **Step 2: Run the dev client against the local server**

Run (background): `npx vite --port 5174` and open `http://localhost:5174/hq` as an admin. Do not restart the docker stack.

Check, at 1920×1080 and 1280×720, in dark and in light mode:
- Map left with rounded right corners, no map controls, no popups on click; panel right: top card, 3×3 fox tiles, hunts card filling the rest, nothing scrolls or overflows.
- Tour chip top-left: ring fills over ~28 s, dots advance; camera flies slowly (~8 s) between overview and each Actief/Onderweg fox; the matching tile gets the orange outline; the fox gets a pulsing ring.
- Event card: register a hunt (or use the demo world) → map flies to the area, card slides up with green ring, new hunt slides into the hunts card; after ~38 s the tour resumes at the next stop.
- With "reduce motion" on in the OS: camera jumps, no slide/pulse animations.
- Leaving `/hq` (browser back) restores the normal app font size.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A src
git commit -m "fix(hq): <what was fixed>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
