import { useEffect, useMemo } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import type { MapLibreEvent } from 'maplibre-gl';
import { useDevices } from '@/hooks/devices.hook';
import { useGrantedBrowserPosition } from '@/hooks/granted-position.hook';
import { useNow } from '@/hooks/now.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { useWakeLock } from '@/hooks/wake-lock.hook';
import { endsFollowing, FOLLOW_GESTURE_EVENTS, type FollowGestureEvent } from '@/lib/follow-gesture';
import { followTarget } from '@/lib/locate';
import { OWN_POSITION_FRESH_MS, OWN_POSITION_LIVE_MS, ownDeviceId, ownTrackerPosition } from '@/lib/own-position';
import useBrowserLocationStore from '@/stores/browser-location.store';
import useFollowMeStore from '@/stores/follow-me.store';

/** Closer than this (px) to the centre counts as centred: no ease for float noise or a fix that didn't move */
const CENTRED_PX = 3;
const FOLLOW_EASE_MS = 800;
const FRESHNESS_TICK_MS = 5000;
const FOLLOW_WATCH: PositionOptions = { enableHighAccuracy: true, maximumAge: 10_000 };

/**
 * Phones: while "Mijn locatie" follows (MyLocationButton), the map eases to every new own fix: the own tracker when its
 * fix is under 20 s old, else the browser's position (when access is already granted, or BrowserLocationDot's), else a
 * tracker fix under 150 s. Dragging, twisting or arrow-key panning the map stops following;
 * zooming (pinch, wheel, +/-) keeps it, the next fix re-centres at the new zoom (lib/follow-gesture.ts).
 * The screen stays on meanwhile, like a navigation app.
 */
export default function FollowMe() {
  const map = useMap().current?.getMap();
  const following = useFollowMeStore((state) => state.following);
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  const browser = useBrowserLocationStore((state) => (state.active ? state.position : null));
  // Ticks often enough for the 20 s live rule
  const now = useNow(following, FRESHNESS_TICK_MS);
  const deviceId = ownDeviceId(devices, status?.configured ? status.uniqueId : undefined);
  const live = ownTrackerPosition(positions, deviceId, now, OWN_POSITION_LIVE_MS);
  const recent = ownTrackerPosition(positions, deviceId, now, OWN_POSITION_FRESH_MS);
  // Between two tracker fixes the browser (already granted, so no prompt) knows better where we are now
  const granted = useGrantedBrowserPosition(following, FOLLOW_WATCH);
  const at = followTarget(live, granted ?? browser, recent);
  const lat = at?.lat;
  const lng = at?.lng;
  const target = useMemo(() => (lat === undefined || lng === undefined ? undefined : { lat, lng }), [lat, lng]);

  useWakeLock(following);

  // A user gesture ends following
  useEffect(() => {
    if (!map || !following) return;
    const onGesture = (event: MapLibreEvent<unknown>) => {
      const { originalEvent } = event as { originalEvent?: unknown };
      if (endsFollowing(event.type as FollowGestureEvent, originalEvent)) useFollowMeStore.getState().stop();
    };
    for (const type of FOLLOW_GESTURE_EVENTS) map.on(type, onGesture);
    return () => {
      for (const type of FOLLOW_GESTURE_EVENTS) map.off(type, onGesture);
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
