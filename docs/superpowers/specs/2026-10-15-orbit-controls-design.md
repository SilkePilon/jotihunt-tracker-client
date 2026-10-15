# Map orbit controls (mouse) — design

Date: 2026-10-15. Status: approved in chat. Target: live before the game (Sat 17 Oct 2026).

## Goal

Rotating and tilting the map with the mouse feels calm and predictable, especially with the 3D buildings on. Today
(MapLibre `dragRotate`) it spins 0.8° per pixel around the screen centre, so the building you look at slides away, and
a diagonal drag rotates and tilts at once.

## Behaviour (desktop mouse only)

- **Start:** drag with the right or middle mouse button, or Ctrl + left button.
- **Anchor:** the map orbits around the ground point under the pointer at drag start. That point stays under the
  pointer while rotating and tilting. If the pointer is on the sky (no ground under it), the screen centre is the
  anchor.
- **Axis lock:** the first 6 px of movement decide the axis. Mostly horizontal locks to rotating; mostly vertical locks
  to tilting. The lock holds until release.
- **Speed:**
  - rotate 0.3° per pixel (full turn ≈ 1200 px);
  - tilt 0.25° per pixel, dragging up tilts more;
  - applied directly per pointer move (in a `requestAnimationFrame`), with no smoothing lag.
- **Release:**
  - when rotating with a speed above 0.05°/ms over the last ~80 ms, the rotation coasts on for 300 ms (ease-out,
    total extra = speed × 300 / 2);
  - otherwise it stops at once;
  - a new drag or a `movestart` from anything else stops a coast.
- **Limits:**
  - tilt 0–60° (the map's `maxPitch`);
  - after release, a bearing within 7° of north snaps to 0 (MapLibre's `bearingSnap`, applied by us with `easeTo`).
- **Feedback:** cursor `grabbing` on the canvas container while dragging. The context menu is suppressed on the map.
  A right click without movement still does nothing.
- **Unchanged:**
  - left-drag pan;
  - scroll and double-click zoom;
  - keyboard;
  - touch gestures (phones keep two-finger rotate and tilt);
  - the HQ wall (non-interactive);
  - ruler and popups (left click).

## Implementation (jotihunt-tracker-client)

### `src/lib/orbit.ts` (pure, unit tested)

- Constants:
  - `ORBIT_ROTATE_DEG_PER_PX = 0.3`
  - `ORBIT_PITCH_DEG_PER_PX = 0.25`
  - `ORBIT_LOCK_PX = 6`
  - `ORBIT_MAX_PITCH = 60`
  - `ORBIT_COAST_MS = 300`
  - `ORBIT_COAST_MIN_SPEED = 0.05`
  - `ORBIT_SNAP_DEG = 7`
- `isOrbitStart(button, ctrlKey)`: right (2) or middle (1) button, or left (0) with Ctrl.
- `lockAxis(dx, dy)`: returns `'rotate' | 'pitch' | null`, where null means still under 6 px.
- `orbitStep(axis, dx, dy, bearing, pitch)`: returns the new `{bearing, pitch}`, with pitch clamped to 0–60.
- `coastDistance(speed)`: returns 0 below the minimum speed, otherwise `speed × ORBIT_COAST_MS / 2`.
- `snapBearing(bearing)`: returns 0 within 7° of north (bearing normalised to −180..180), otherwise the bearing.
- `recentSpeed(samples)`: degrees per ms over the samples in the last 80 ms.

### `src/hooks/orbit-controls.hook.ts`

`useOrbitControls(map, enabled)`:
- Disables `map.dragRotate` while enabled and re-enables it on cleanup.
- `pointerdown` on the canvas container: if `isOrbitStart`, take pointer capture, store the anchor (`map.unproject` at
  the pointer, or the centre if the pointer is above the horizon) and the anchor's screen point, and stop any coast.
- `pointermove`: accumulate the deltas and lock the axis. Per frame:
  - `jumpTo({bearing, pitch})` from `orbitStep`;
  - re-pin the anchor: `p' = map.project(anchor)`, then set the centre to `map.unproject(centrePx + (p' − p0))`. This
    runs twice to converge on a tilted map.
- `pointerup` / `pointercancel`: release capture, coast if fast, then snap the bearing.
- The coast is a `requestAnimationFrame` loop with ease-out, re-pinning the anchor every frame.
- `contextmenu` on the container is prevented while enabled.
- Every `jumpTo` passes `{originalEvent}` as event data, so MapLibre's `pitchstart`/`rotate` events carry it and
  `Buildings3D`'s "the user pitched" detection still works.

### `src/components/Map.tsx`

- `maxPitch={60}`.
- An inner `<OrbitControls enabled={!isMobile && !wall}/>` component that uses `useMap()` and the hook.

## Testing

- `bun test` for `orbit.ts`:
  - start buttons;
  - axis lock threshold and direction;
  - step speed and pitch clamp;
  - coast threshold and distance;
  - snap at ±7° and across ±180°;
  - speed from samples.
- `tsc`, lint, build.
- Preview with buildings on:
  - right-drag orbits around a building, and the building stays under the pointer;
  - the axis lock works;
  - the slower speed;
  - coast and snap;
  - Ctrl and middle drag;
  - left-drag pan and popups still work;
  - phones (touch emulation) still rotate.

## Out of scope

On-screen 3D buttons, touch gesture changes, keyboard changes.
