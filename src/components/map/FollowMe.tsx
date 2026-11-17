import { useEffect, useMemo } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import type { MapLibreEvent } from 'maplibre-gl';
import { useDevices } from '@/hooks/devices.hook';
import { AGE_CLOCK_TICK_MS, useNow } from '@/hooks/now.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { useWakeLock } from '@/hooks/wake-lock.hook';
import { OWN_POSITION_FRESH_MS, ownDeviceId, ownTrackerPosition } from '@/lib/own-position';
import useBrowserLocationStore from '@/stores/browser-location.store';
import useFollowMeStore from '@/stores/follow-me.store';

/** Closer than this (px) to the centre counts as centred: no ease for float noise or a fix that didn't move */
const CENTRED_PX = 3;
const FOLLOW_EASE_MS = 800;

// User gestures that end following (MapLibre only sets originalEvent for those, never for our own camera moves)
const GESTURE_EVENTS = ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart'] as const;

/**
 * Phones: while "Mijn locatie" follows (MyLocationButton), the map eases to every new own fix, the own tracker when it
 * is live, else the browser's position (BrowserLocationDot). Dragging, pinching or twisting the map stops following.
 * The screen stays on meanwhile, like a navigation app.
 */
export default function FollowMe() {
  const map = useMap().current?.getMap();
  const following = useFollowMeStore((state) => state.following);
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  const browser = useBrowserLocationStore((state) => (state.active ? state.position : null));
  const now = useNow(following, AGE_CLOCK_TICK_MS);
  const tracker = ownTrackerPosition(positions, ownDeviceId(devices, status?.configured ? status.uniqueId : undefined), now, OWN_POSITION_FRESH_MS);
  const lat = tracker?.lat ?? browser?.lat;
  const lng = tracker?.lng ?? browser?.lng;
  const target = useMemo(() => (lat === undefined || lng === undefined ? undefined : { lat, lng }), [lat, lng]);

  useWakeLock(following);

  // A user gesture ends following
  useEffect(() => {
    if (!map || !following) return;
    const onGesture = (event: MapLibreEvent<unknown>) => {
      if ((event as { originalEvent?: unknown }).originalEvent) useFollowMeStore.getState().stop();
    };
    for (const type of GESTURE_EVENTS) map.on(type, onGesture);
    return () => {
      for (const type of GESTURE_EVENTS) map.off(type, onGesture);
    };
  }, [map, following]);

  // Ease to each new fix; while the camera is still moving (the locate flight, the sheet's padding ease) wait for it
  // to land, so the flight isn't cut short
  useEffect(() => {
    if (!map || !following || !target) return;
    const catchUp = () => {
      if (map.isMoving() || !useFollowMeStore.getState().following) return;
      const at = map.project(target);
      const centre = map.project(map.getCenter());
      if (Math.hypot(at.x - centre.x, at.y - centre.y) < CENTRED_PX) return;
      map.easeTo({ center: [target.lng, target.lat], duration: FOLLOW_EASE_MS });
    };
    catchUp();
    map.on('moveend', catchUp);
    return () => {
      map.off('moveend', catchUp);
    };
  }, [map, following, target]);

  return null;
}
