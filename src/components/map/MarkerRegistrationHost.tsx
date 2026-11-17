import { type RefObject, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { MapRef } from '@/components/Map';
import { useMarkers } from '@/hooks/markers.hook';
import { LOCATE_ZOOM } from '@/lib/locate';
import { markerSavedToast } from '@/lib/markers';
import useMarkerDraftStore, { settleDrafts } from '@/stores/marker-draft.store';
import MarkerRegistration from './MarkerRegistration';

/**
 * The Hunt / Spot dialog outside a map popup, mounted once (Layout): opened by the "niet bevestigd" line (peek strip,
 * sidebar header) at a kept draft's pin and by the phone's "Hunt hier" tile at the own position; the map flies to the
 * pin first. Back online, kept drafts are checked against a fresh marker list (only checked, never sent again): the ones
 * that did go through are cleared with a toast (also once on load, for drafts kept from before a reload).
 */
export default function MarkerRegistrationHost({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const request = useMarkerDraftStore((state) => state.request);
  const { fetchFreshMarkers } = useMarkers();
  const fetchRef = useRef(fetchFreshMarkers);
  useEffect(() => {
    fetchRef.current = fetchFreshMarkers;
  });

  // Each new request: the map flies to its pin (never zooming out), so the pin is in view behind the dialog
  const requestId = request?.id;
  useEffect(() => {
    const { request: current } = useMarkerDraftStore.getState();
    if (!current) return;
    const map = mapRef.current;
    map?.flyTo({ center: [current.lng, current.lat], zoom: Math.max(LOCATE_ZOOM, map.getZoom() ?? 0), duration: 1200 });
  }, [requestId, mapRef]);

  useEffect(() => {
    let checking = false;
    const onOnline = async () => {
      if (checking || Object.keys(useMarkerDraftStore.getState().drafts).length === 0) return;
      checking = true;
      try {
        const confirmed = settleDrafts(await fetchRef.current());
        for (const draft of confirmed) toast.success(markerSavedToast(draft.type), { description: 'Bevestigd na verbindingsherstel.' });
      } finally {
        checking = false;
      }
    };
    const listener = () => void onOnline();
    // Drafts kept from before a reload: checked once right away too
    if (typeof navigator === 'undefined' || navigator.onLine) listener();
    window.addEventListener('online', listener);
    return () => window.removeEventListener('online', listener);
  }, []);

  // The pin comes with each request (openDialog's `at`); the props only fill the fallback
  return <MarkerRegistration lat={request?.lat ?? 0} lng={request?.lng ?? 0} hosted />;
}
