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
