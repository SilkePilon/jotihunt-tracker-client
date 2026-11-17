import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorEvent as MapErrorEvent, MapSourceDataEvent } from 'maplibre-gl';
import { isBaseMapEvent, isMapUnavailable, startMapLoad, type MapLoadProgress } from '@/lib/map-availability';

const TICK_MS = 1000;

/**
 * Whether the base map failed to load (style/tiles errored, or offline and nothing drew), for the "Kaart niet
 * beschikbaar" card. Pass the handlers to <Maplibre onError onSourceData>. Once a base tile has rendered (also from the
 * cache) the map counts as available for the rest of the session.
 */
export function useMapAvailability(baseSourceIds: ReadonlySet<string> | null) {
  const progress = useRef<MapLoadProgress>(startMapLoad(0));
  // The clock starts when the map mounts
  useEffect(() => {
    progress.current = startMapLoad(Date.now());
  }, []);
  const baseIds = useRef(baseSourceIds);
  useEffect(() => {
    baseIds.current = baseSourceIds;
  });
  const [unavailable, setUnavailable] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const check = useCallback(() => {
    setUnavailable(isMapUnavailable(progress.current, Date.now(), navigator.onLine));
  }, []);

  // Until something drew, re-check every second (the grace period and offline timeout pass without events)
  useEffect(() => {
    if (hasContent) return;
    const interval = setInterval(check, TICK_MS);
    window.addEventListener('offline', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('offline', check);
    };
  }, [hasContent, check]);

  const onError = useCallback(
    (event: MapErrorEvent & { sourceId?: string }) => {
      // react-map-gl logs errors only when there is no onError of our own
      console.error(event.error);
      if (progress.current.firstErrorAt === null && isBaseMapEvent(event.sourceId, baseIds.current)) {
        progress.current = { ...progress.current, firstErrorAt: Date.now() };
      }
    },
    [],
  );

  const onSourceData = useCallback(
    (event: MapSourceDataEvent) => {
      if (progress.current.hasContent || !event.tile || !isBaseMapEvent(event.sourceId, baseIds.current)) return;
      progress.current = { ...progress.current, hasContent: true };
      setHasContent(true);
      check();
    },
    [check],
  );

  return { unavailable, onError, onSourceData };
}
