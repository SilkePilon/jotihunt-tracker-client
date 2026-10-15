import { useEffect } from 'react';
import type { LngLat, MapLibreEvent, Map as MaplibreMap } from 'maplibre-gl';
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
    const root = map.getContainer();
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
    let button = 0;
    let swallowTimer = 0;

    // Tags our own camera calls so onMoveStart can tell them apart; originalEvent marks them as user moves
    const tag = (originalEvent: Event | null) => ({ originalEvent, orbit: true });

    // Applies a camera, then moves the map so the anchor is back under the pointer's start point
    const apply = (camera: { bearing: number; pitch: number }, originalEvent: Event | null) => {
      const data = tag(originalEvent);
      map.jumpTo(camera, data);
      if (anchor) map.jumpTo(map.calculateAnchoredCameraOptions({ anchorLocation: anchor, anchorScreenPoint: [anchorPoint.x, anchorPoint.y] }), data);
    };

    const stopCoast = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    // Eats the click the browser still fires after a Ctrl + left orbit, so it can't open a popup or add a ruler point
    const swallowClick = (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      unswallow();
    };
    const unswallow = () => {
      root.removeEventListener('click', swallowClick, true);
      clearTimeout(swallowTimer);
      swallowTimer = 0;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      unswallow();
      // Any press stops our coast and the bearing snap (before MapLibre's mousedown, so its own drag still starts)
      if (frame || map.isMoving()) {
        stopCoast();
        map.stop();
      }
      if (!isOrbitStart(event.button, event.ctrlKey)) return;
      event.preventDefault();
      try {
        container.setPointerCapture(event.pointerId);
      } catch {
        return;
      }
      pointerId = event.pointerId;
      button = event.button;
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

    // Applies the latest drag delta
    const step = () => {
      if (!axis) return;
      const camera = orbitStep(axis, delta.dx, delta.dy, startCamera.bearing, startCamera.pitch);
      apply(camera, lastEvent);
      samples.push({ t: performance.now(), bearing: camera.bearing });
      if (samples.length > 20) samples.shift();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      // No buttons held: the release got lost (alt-tab, dialog)
      if (event.buttons === 0) {
        finish(event);
        return;
      }
      delta = { dx: event.clientX - start.x, dy: event.clientY - start.y };
      axis ??= lockAxis(delta.dx, delta.dy);
      lastEvent = event;
      if (!axis || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        step();
      });
    };

    // Ends the drag; a second call for the same drag does nothing
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
      container.style.cursor = '';
      // Don't drop the last movement still waiting for a frame
      if (frame) {
        stopCoast();
        step();
      }
      // The click follows pointerup in the same task, so the timer only clears it when no click comes
      if (button === 0 && axis !== null) {
        root.addEventListener('click', swallowClick, true);
        swallowTimer = window.setTimeout(unswallow, 0);
      }
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
        const pivot = anchor;
        anchor = null;
        const snapped = snapBearing(map.getBearing());
        // around keeps the building under the pointer in place while snapping
        if (snapped !== map.getBearing()) map.easeTo({ bearing: snapped, duration: SNAP_MS, around: pivot ?? undefined }, tag(event));
      };
      if (extra) frame = requestAnimationFrame(coast);
      else coast(begin + ORBIT_COAST_MS);
    };

    // Any move not started by us (fly-to, scroll zoom, drag pan, keyboard) ends a coast
    const onMoveStart = (event: MapLibreEvent & { orbit?: boolean }) => {
      if (frame && pointerId === null && !event.orbit) stopCoast();
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    // Middle press starts autoscroll on Windows
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', finish);
    container.addEventListener('pointercancel', finish);
    container.addEventListener('lostpointercapture', finish);
    container.addEventListener('contextmenu', onContextMenu);
    container.addEventListener('mousedown', onMouseDown);
    map.on('movestart', onMoveStart);
    return () => {
      stopCoast();
      unswallow();
      container.style.cursor = '';
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', finish);
      container.removeEventListener('pointercancel', finish);
      container.removeEventListener('lostpointercapture', finish);
      container.removeEventListener('contextmenu', onContextMenu);
      container.removeEventListener('mousedown', onMouseDown);
      map.off('movestart', onMoveStart);
      map.dragRotate.enable();
    };
  }, [map, enabled]);
}
