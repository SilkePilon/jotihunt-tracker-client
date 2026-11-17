import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorEvent as MapErrorEvent, MapSourceDataEvent } from 'maplibre-gl';
import { isBaseMapEvent, isMapUnavailable, loadedStyleSourceIds, startMapLoad, type MapLoadProgress } from '@/lib/map-availability';

const TICK_MS = 1000;

/**
 * Whether an event is about the base map. A style object lists its base sources up front; for a style URL they are
 * read from the style JSON the map (the event's target) loaded, so our own sources (buildings3d, fastfood…) never
 * count as base content or base errors there either.
 */
function isBaseEvent(event: { sourceId?: string; target?: unknown }, baseSourceIds: ReadonlySet<string> | null): boolean {
  return isBaseMapEvent(event.sourceId, baseSourceIds ?? loadedStyleSourceIds(event.target));
}

/**
 * Whether the base map failed to load (style/tiles errored, or offline and nothing drew), for the "Kaart niet
 * beschikbaar" card. Pass the handlers to <Maplibre onError onSourceData>. Once a base tile of the current style has
 * rendered (also from the cache) the map counts as available, until the style's base sources change (`styleKey`, see
 * mapStyleKey): e.g. switching to satellite while offline starts over and watches the new style's sources.
 */
export function useMapAvailability(baseSourceIds: ReadonlySet<string> | null, styleKey: string) {
  const progress = useRef<MapLoadProgress>(startMapLoad(0));
  // The clock starts when the map mounts, and again for every new set of base sources
  useEffect(() => {
    progress.current = startMapLoad(Date.now());
  }, [styleKey]);
  const baseIds = useRef(baseSourceIds);
  useEffect(() => {
    baseIds.current = baseSourceIds;
  });
  const [unavailable, setUnavailable] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [watchedKey, setWatchedKey] = useState(styleKey);
  if (styleKey !== watchedKey) {
    setWatchedKey(styleKey);
    setHasContent(false);
    setUnavailable(false);
  }

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
    (event: MapErrorEvent & { sourceId?: string; target?: unknown }) => {
      // react-map-gl logs errors only when there is no onError of our own
      console.error(event.error);
      if (progress.current.firstErrorAt === null && isBaseEvent(event, baseIds.current)) {
        progress.current = { ...progress.current, firstErrorAt: Date.now() };
      }
    },
    [],
  );

  const onSourceData = useCallback(
    (event: MapSourceDataEvent) => {
      if (progress.current.hasContent || !event.tile || !isBaseEvent(event, baseIds.current)) return;
      progress.current = { ...progress.current, hasContent: true };
      setHasContent(true);
      check();
    },
    [check],
  );

  return { unavailable, onError, onSourceData };
}
