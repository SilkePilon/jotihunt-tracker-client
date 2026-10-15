# Map orbit controls + 3D on by default — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calm mouse rotate/tilt that orbits around the point under the pointer, and the 3D buildings layer on by default.

**Architecture:**
- Pure maths and constants live in `src/lib/orbit.ts` (unit tested).
- A React hook `useOrbitControls` replaces MapLibre's `dragRotate` with pointer handlers on the map canvas container.
- It applies bearing and pitch with `jumpTo` and re-pins the anchor with MapLibre 6's
  `map.calculateAnchoredCameraOptions({anchorLocation, anchorScreenPoint})`.
- The layers store gets a persist `version: 1` migration that turns the 3D buildings on once.

**Tech Stack:** React 19, react-map-gl 8 (`react-map-gl/maplibre`), maplibre-gl 6.11, zustand 5 persist, `bun:test`.

Spec: `docs/superpowers/specs/2026-10-15-orbit-controls-design.md`.

## Global Constraints

- Repo: `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client`, branch `feat/orbit-controls`.
- Run tools via `npx bun` (`npx bun test`). Type-check with `npx tsc -b`, lint with `npm run -s lint`, build with
  `npm run -s build`.
- Never touch the user's live docker stack (ports 3000/8080). Kill processes by PID only, never `pkill -f`.
- Constants (exact):
  - `ORBIT_ROTATE_DEG_PER_PX = 0.3`
  - `ORBIT_PITCH_DEG_PER_PX = 0.25`
  - `ORBIT_LOCK_PX = 6`
  - `ORBIT_MAX_PITCH = 60`
  - `ORBIT_COAST_MS = 300`
  - `ORBIT_COAST_MIN_SPEED = 0.05` (degrees per ms)
  - `ORBIT_SNAP_DEG = 7`
  - speed window 80 ms
- Desktop mouse only. Touch, keyboard, scroll zoom, left-drag pan, the HQ wall and left-click popups are unchanged.
- Sky anchor: with `maxPitch` 60 and MapLibre's default 36.87° field of view, the horizon never shows (that needs about
  71.6° pitch). So `map.unproject(pointer)` is always on the ground and no sky fallback is needed.
- Code style: match the surrounding files (single quotes, 2-space indent in `src/lib` and `src/hooks`, 4-space in
  `Map.tsx`; short JSDoc comments on exports).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Orbit maths + 3D buildings on by default

**Files:**
- Create: `src/lib/orbit.ts`
- Create: `src/lib/orbit.test.ts`
- Modify: `src/stores/layers.store.ts`
- Create: `src/stores/layers.store.test.ts`

**Interfaces:**
- Produces (from `@/lib/orbit`):
  - the constants above;
  - `type OrbitAxis = 'rotate' | 'pitch'`;
  - `isOrbitStart(button: number, ctrlKey: boolean): boolean`;
  - `lockAxis(dx: number, dy: number): OrbitAxis | null`;
  - `orbitStep(axis: OrbitAxis, dx: number, dy: number, bearing: number, pitch: number): { bearing: number; pitch: number }`;
  - `coastDistance(speed: number): number`;
  - `snapBearing(bearing: number): number`;
  - `type SpeedSample = { t: number; bearing: number }`;
  - `recentSpeed(samples: SpeedSample[], now: number): number`.
- Produces (from `@/stores/layers.store`): `migrateLayers(persisted: unknown, version: number): unknown`.

- [ ] **Step 1: Write the failing orbit tests**

`src/lib/orbit.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import {
  coastDistance,
  isOrbitStart,
  lockAxis,
  ORBIT_COAST_MS,
  ORBIT_MAX_PITCH,
  orbitStep,
  recentSpeed,
  snapBearing,
} from './orbit';

describe('isOrbitStart', () => {
  test('right and middle buttons start an orbit', () => {
    expect(isOrbitStart(2, false)).toBe(true);
    expect(isOrbitStart(1, false)).toBe(true);
  });
  test('left button only with Ctrl', () => {
    expect(isOrbitStart(0, false)).toBe(false);
    expect(isOrbitStart(0, true)).toBe(true);
  });
  test('other buttons never', () => {
    expect(isOrbitStart(3, true)).toBe(false);
  });
});

describe('lockAxis', () => {
  test('undecided under 6 px', () => {
    expect(lockAxis(3, 4)).toBeNull();
    expect(lockAxis(0, 0)).toBeNull();
  });
  test('mostly horizontal rotates, mostly vertical pitches', () => {
    expect(lockAxis(6, 2)).toBe('rotate');
    expect(lockAxis(-7, 1)).toBe('rotate');
    expect(lockAxis(1, -6)).toBe('pitch');
    expect(lockAxis(2, 9)).toBe('pitch');
  });
  test('an exact diagonal rotates', () => {
    expect(lockAxis(5, 5)).toBe('rotate');
  });
});

describe('orbitStep', () => {
  test('rotate: 0.3 degrees per pixel, pitch untouched', () => {
    expect(orbitStep('rotate', 100, 40, 10, 30)).toEqual({ bearing: 40, pitch: 30 });
    expect(orbitStep('rotate', -100, 0, 10, 30)).toEqual({ bearing: -20, pitch: 30 });
  });
  test('pitch: dragging up tilts more, 0.25 degrees per pixel, bearing untouched', () => {
    expect(orbitStep('pitch', 50, -40, 10, 30)).toEqual({ bearing: 10, pitch: 40 });
    expect(orbitStep('pitch', 0, 40, 10, 30)).toEqual({ bearing: 10, pitch: 20 });
  });
  test('pitch is clamped to 0..60', () => {
    expect(orbitStep('pitch', 0, -1000, 0, 30).pitch).toBe(ORBIT_MAX_PITCH);
    expect(orbitStep('pitch', 0, 1000, 0, 30).pitch).toBe(0);
  });
});

describe('coastDistance', () => {
  test('no coast at or below the minimum speed', () => {
    expect(coastDistance(0)).toBe(0);
    expect(coastDistance(0.05)).toBe(0);
    expect(coastDistance(-0.04)).toBe(0);
  });
  test('speed x 300 ms / 2, keeping the sign', () => {
    expect(coastDistance(0.2)).toBeCloseTo((0.2 * ORBIT_COAST_MS) / 2);
    expect(coastDistance(-0.2)).toBeCloseTo((-0.2 * ORBIT_COAST_MS) / 2);
  });
});

describe('snapBearing', () => {
  test('within 7 degrees of north snaps to 0', () => {
    expect(snapBearing(6.9)).toBe(0);
    expect(snapBearing(-7)).toBe(0);
    expect(snapBearing(355)).toBe(0);
    expect(snapBearing(-358)).toBe(0);
  });
  test('further away keeps the bearing, normalised to -180..180', () => {
    expect(snapBearing(7.5)).toBe(7.5);
    expect(snapBearing(-30)).toBe(-30);
    expect(snapBearing(350)).toBe(-10);
    expect(snapBearing(190)).toBe(-170);
  });
});

describe('recentSpeed', () => {
  test('degrees per ms over the last 80 ms', () => {
    const samples = [
      { t: 0, bearing: 0 },
      { t: 100, bearing: 10 },
      { t: 150, bearing: 20 },
      { t: 180, bearing: 26 },
    ];
    // window starts at 100: (26 - 10) / (180 - 100)
    expect(recentSpeed(samples, 180)).toBeCloseTo(0.2);
  });
  test('0 with fewer than two recent samples', () => {
    expect(recentSpeed([], 100)).toBe(0);
    expect(recentSpeed([{ t: 0, bearing: 0 }, { t: 10, bearing: 5 }], 500)).toBe(0);
    expect(recentSpeed([{ t: 490, bearing: 5 }], 500)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx bun test src/lib/orbit.test.ts`
Expected: FAIL, `Cannot find module './orbit'`.

- [ ] **Step 3: Implement `src/lib/orbit.ts`**

```ts
/** Mouse orbit (rotate/tilt) tuning: calmer than MapLibre's 0.8 degrees per pixel. */
export const ORBIT_ROTATE_DEG_PER_PX = 0.3;
export const ORBIT_PITCH_DEG_PER_PX = 0.25;
/** Movement before the drag commits to rotating or tilting */
export const ORBIT_LOCK_PX = 6;
export const ORBIT_MAX_PITCH = 60;
/** Rotation keeps going this long after a fast release */
export const ORBIT_COAST_MS = 300;
/** Degrees per ms; slower releases stop at once */
export const ORBIT_COAST_MIN_SPEED = 0.05;
/** A bearing this close to north snaps back to north on release */
export const ORBIT_SNAP_DEG = 7;
const SPEED_WINDOW_MS = 80;

export type OrbitAxis = 'rotate' | 'pitch';
export type SpeedSample = { t: number; bearing: number };

/** Right or middle button, or Ctrl + left button. */
export function isOrbitStart(button: number, ctrlKey: boolean): boolean {
  return button === 2 || button === 1 || (button === 0 && ctrlKey);
}

/** The axis a drag locks to once it moved far enough; null while undecided. */
export function lockAxis(dx: number, dy: number): OrbitAxis | null {
  if (Math.hypot(dx, dy) < ORBIT_LOCK_PX) return null;
  return Math.abs(dx) >= Math.abs(dy) ? 'rotate' : 'pitch';
}

/** The camera after dragging dx/dy pixels on the locked axis. Dragging up tilts more. */
export function orbitStep(axis: OrbitAxis, dx: number, dy: number, bearing: number, pitch: number) {
  if (axis === 'rotate') return { bearing: bearing + dx * ORBIT_ROTATE_DEG_PER_PX, pitch };
  const next = pitch - dy * ORBIT_PITCH_DEG_PER_PX;
  return { bearing, pitch: Math.min(ORBIT_MAX_PITCH, Math.max(0, next)) };
}

/** Extra degrees an ease-out coast adds after release at `speed` degrees per ms. */
export function coastDistance(speed: number): number {
  if (Math.abs(speed) <= ORBIT_COAST_MIN_SPEED) return 0;
  return (speed * ORBIT_COAST_MS) / 2;
}

/** The bearing in -180..180, or 0 when within the snap distance of north. */
export function snapBearing(bearing: number): number {
  const normal = ((((bearing + 180) % 360) + 360) % 360) - 180;
  return Math.abs(normal) <= ORBIT_SNAP_DEG ? 0 : normal;
}

/** Rotation speed in degrees per ms over the samples of the last 80 ms. */
export function recentSpeed(samples: SpeedSample[], now: number): number {
  const recent = samples.filter((sample) => now - sample.t <= SPEED_WINDOW_MS);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  return last.t === first.t ? 0 : (last.bearing - first.bearing) / (last.t - first.t);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx bun test src/lib/orbit.test.ts`
Expected: all PASS.

- [ ] **Step 5: Write the failing store migration test**

`src/stores/layers.store.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { migrateLayers } from './layers.store';

describe('migrateLayers', () => {
  test('version 0 turns the 3D buildings on and keeps the other layers', () => {
    expect(migrateLayers({ showBuildings3d: false, showTeams: false }, 0)).toEqual({
      showBuildings3d: true,
      showTeams: false,
    });
  });
  test('version 0 without stored state still gets the 3D buildings', () => {
    expect(migrateLayers(undefined, 0)).toEqual({ showBuildings3d: true });
  });
  test('version 1 is left alone (the user turned them off themselves)', () => {
    expect(migrateLayers({ showBuildings3d: false }, 1)).toEqual({ showBuildings3d: false });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx bun test src/stores/layers.store.test.ts`
Expected: FAIL, `migrateLayers` is not exported. If the import of the store module itself fails under bun because
`localStorage` is missing, check how `src/stores/intel.store.test.ts` handles it and follow the same pattern.

- [ ] **Step 7: Implement it in `src/stores/layers.store.ts`**

Change the default `showBuildings3d: false,` to `showBuildings3d: true,`. Add above `const useLayersStore`:

```ts
/**
 * Persisted layer settings, version 0 to 1: the 3D buildings went from off to on by default, and everyone who loaded
 * the site before has `false` stored, so turn them on once. Later toggles are kept.
 */
export function migrateLayers(persisted: unknown, version: number): unknown {
  if (version >= 1) return persisted;
  return { ...(persisted as object | undefined), showBuildings3d: true };
}
```

Then extend the persist options:

```ts
    {
      name: 'layers-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persisted, version) => migrateLayers(persisted, version) as LayersState,
    },
```

- [ ] **Step 8: Run all tests, type-check, lint**

Run: `npx bun test && npx tsc -b && npm run -s lint`
Expected: all pass, no type or lint errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/orbit.ts src/lib/orbit.test.ts src/stores/layers.store.ts src/stores/layers.store.test.ts
git commit -m "feat(map): orbit maths and 3D buildings on by default

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Orbit controls hook wired into the map

**Files:**
- Create: `src/hooks/orbit-controls.hook.ts`
- Create: `src/components/map/OrbitControls.tsx`
- Modify: `src/components/Map.tsx` (the `<Maplibre>` props near line 196, and the children after `<MarkerImages/>`)

**Interfaces:**
- Consumes: everything from `@/lib/orbit` (Task 1).
- Produces:
  - `useOrbitControls(map: MaplibreMap | undefined, enabled: boolean): void`;
  - default export `OrbitControls({ enabled }: { enabled: boolean })`, which renders null.

- [ ] **Step 1: Implement `src/hooks/orbit-controls.hook.ts`**

```ts
import { useEffect } from 'react';
import type { LngLat, Map as MaplibreMap } from 'maplibre-gl';
import {
  coastDistance,
  isOrbitStart,
  lockAxis,
  ORBIT_COAST_MS,
  orbitStep,
  recentSpeed,
  snapBearing,
  type OrbitAxis,
  type SpeedSample,
} from '@/lib/orbit';

const SNAP_MS = 200;

/**
 * Mouse rotate/tilt that orbits around the ground point under the pointer (right/middle drag, or Ctrl + left drag),
 * locked to one axis per drag, coasting briefly after a fast release. Replaces MapLibre's own dragRotate while enabled.
 */
export function useOrbitControls(map: MaplibreMap | undefined, enabled: boolean) {
  useEffect(() => {
    if (!map || !enabled) return;
    const container = map.getCanvasContainer();
    map.dragRotate.disable();

    let pointerId: number | null = null;
    let start = { x: 0, y: 0 };
    let anchor: LngLat | null = null;
    let anchorPoint = { x: 0, y: 0 };
    let startCamera = { bearing: 0, pitch: 0 };
    let axis: OrbitAxis | null = null;
    let delta = { dx: 0, dy: 0 };
    let frame = 0;
    let samples: SpeedSample[] = [];
    let lastEvent: PointerEvent | null = null;

    // Applies a camera, then moves the map so the anchor is back under the pointer's start point
    const apply = (camera: { bearing: number; pitch: number }, originalEvent: Event | null) => {
      const data = { originalEvent };
      map.jumpTo(camera, data);
      if (anchor) map.jumpTo(map.calculateAnchoredCameraOptions({ anchorLocation: anchor, anchorScreenPoint: [anchorPoint.x, anchorPoint.y] }), data);
    };

    const stopCoast = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !isOrbitStart(event.button, event.ctrlKey)) return;
      stopCoast();
      event.preventDefault();
      pointerId = event.pointerId;
      container.setPointerCapture(event.pointerId);
      const rect = container.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY };
      anchorPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      anchor = map.unproject([anchorPoint.x, anchorPoint.y]);
      startCamera = { bearing: map.getBearing(), pitch: map.getPitch() };
      axis = null;
      delta = { dx: 0, dy: 0 };
      samples = [{ t: performance.now(), bearing: startCamera.bearing }];
      container.style.cursor = 'grabbing';
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      delta = { dx: event.clientX - start.x, dy: event.clientY - start.y };
      axis ??= lockAxis(delta.dx, delta.dy);
      lastEvent = event;
      if (!axis || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!axis) return;
        const camera = orbitStep(axis, delta.dx, delta.dy, startCamera.bearing, startCamera.pitch);
        apply(camera, lastEvent);
        samples.push({ t: performance.now(), bearing: camera.bearing });
        if (samples.length > 20) samples.shift();
      });
    };

    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
      container.style.cursor = '';
      stopCoast();
      if (axis !== 'rotate') {
        anchor = null;
        return;
      }
      const from = map.getBearing();
      const extra = coastDistance(recentSpeed(samples, performance.now()));
      const begin = performance.now();
      const pitch = map.getPitch();
      const coast = (now: number) => {
        const k = Math.min(1, (now - begin) / ORBIT_COAST_MS);
        const eased = 1 - (1 - k) * (1 - k);
        apply({ bearing: from + extra * eased, pitch }, event);
        if (k < 1) {
          frame = requestAnimationFrame(coast);
          return;
        }
        frame = 0;
        anchor = null;
        const snapped = snapBearing(map.getBearing());
        if (snapped !== map.getBearing()) map.easeTo({ bearing: snapped, duration: SNAP_MS }, { originalEvent: event });
      };
      if (extra) frame = requestAnimationFrame(coast);
      else coast(begin + ORBIT_COAST_MS);
    };

    // Anything else moving the map (fly-to, scroll zoom, pan) ends a coast
    const onMoveStart = (event: { originalEvent?: Event }) => {
      if (frame && pointerId === null && !event.originalEvent) stopCoast();
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', finish);
    container.addEventListener('pointercancel', finish);
    container.addEventListener('contextmenu', onContextMenu);
    map.on('movestart', onMoveStart);
    return () => {
      stopCoast();
      container.style.cursor = '';
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', finish);
      container.removeEventListener('pointercancel', finish);
      container.removeEventListener('contextmenu', onContextMenu);
      map.off('movestart', onMoveStart);
      map.dragRotate.enable();
    };
  }, [map, enabled]);
}
```

Notes for the implementer:
- `event.preventDefault()` on the pointerdown stops the middle-click autoscroll and text selection.
- MapLibre's `dragPan` only handles a plain left button without Ctrl, so it doesn't fight Ctrl + left, right or middle
  drags. Verify this in the preview (Step 5). If Ctrl + left still pans, also call `event.stopPropagation()` in
  `onPointerDown` for orbit starts.
- With a capture-phase conflict (MapLibre listening on the same container), register `pointerdown` with
  `{ capture: true }`. Only do this if the preview shows MapLibre reacting first.

- [ ] **Step 2: Create `src/components/map/OrbitControls.tsx`**

```tsx
import { useMap } from 'react-map-gl/maplibre';
import { useOrbitControls } from '@/hooks/orbit-controls.hook';

/** Calm mouse rotate/tilt around the pointer; see useOrbitControls. Renders nothing. */
export default function OrbitControls({ enabled }: { enabled: boolean }) {
  const map = useMap().current?.getMap();
  useOrbitControls(map, enabled);
  return null;
}
```

- [ ] **Step 3: Wire it into `src/components/Map.tsx`**

- Add the import next to the other `./map/...` imports: `import OrbitControls from './map/OrbitControls';`
- On `<Maplibre ...>`, add the prop `maxPitch={ORBIT_MAX_PITCH}` and import `{ORBIT_MAX_PITCH} from '@/lib/orbit'`.
- Right after `<MarkerImages/>`, add:

```tsx
                {/* Desktop mouse: calm rotate/tilt around the pointer (phones keep MapLibre's touch gestures) */}
                <OrbitControls enabled={!isMobile && !wall}/>
```

- [ ] **Step 4: Type-check, lint, test, build**

Run: `npx tsc -b && npm run -s lint && npx bun test && npm run -s build`
Expected: all pass.

- [ ] **Step 5: Manual check in the browser**

- Start the vite dev client on a free port (for example 5174) against a throwaway server, as in the 3D buildings smoke
  test. Read `memory/dev-environment.md` for the smoke DB setup. Do not use the user's :3000/:8080 stack.
- With buildings on, at zoom 16 over a town, check:
  - right-drag horizontally orbits around the building under the pointer, and it stays under the pointer;
  - vertical drag tilts only (axis lock), clamped at 60°;
  - a full turn needs about 1200 px;
  - a fast release coasts about 300 ms; a slow release stops;
  - ending within 7° of north snaps to north;
  - Ctrl + left drag and middle drag do the same;
  - left-drag pan, scroll zoom and left-click popups still work;
  - no context menu appears on right click;
  - the cursor is `grabbing` while orbiting;
  - with phone emulation (touch), two-finger rotate still works and the hook is disabled.
- Synthesise the pointer events with `PointerEvent`s (`pointerType: 'mouse'`, `button: 2`) on
  `map.getCanvasContainer()` if real mouse input isn't available. Read `map.getBearing()` and `map.getPitch()`, and
  check `map.project(anchor)` against the start point.
- Fresh localStorage: `showBuildings3d` is true. A stored v0 `layers-storage` with `showBuildings3d:false` becomes true
  after reload.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/orbit-controls.hook.ts src/components/map/OrbitControls.tsx src/components/Map.tsx
git commit -m "feat(map): calm mouse orbit around the pointer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
