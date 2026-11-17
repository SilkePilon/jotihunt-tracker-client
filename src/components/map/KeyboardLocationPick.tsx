import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { useMap } from 'react-map-gl/maplibre';
import type { LngLat, Map as MaplibreMap } from 'maplibre-gl';
import CenterCrosshair from './CenterCrosshair';
import { isPickKey, mapKeysDescription, PICK_MESSAGE } from '@/lib/map-pick-keys';

/** The picked-location puck's colour (Map.tsx sets the marker palette on the map's wrapper) */
const CROSSHAIR_COLOR = 'var(--jh-marker-primary)';

/**
 * The keyboard's way to the "Gekozen locatie" card (a map tap for pointers): with the map focused, Enter picks its
 * middle. A centre crosshair shows where while the map has keyboard focus. Off (`enabled` false) while the ruler or a
 * night-area drawing owns Enter (they have their own crosshair).
 */
export default function KeyboardLocationPick({ enabled, onPick }: { enabled: boolean; onPick: (lngLat: LngLat) => void }) {
  const { current: mapRef } = useMap();
  const map = mapRef?.getMap() as MaplibreMap | undefined;
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  // What the live region last said; `n` makes the same sentence twice still a change, so it is read out again
  const [said, setSaid] = useState({ text: '', n: 0 });
  const descriptionId = useId();

  // The canvas is a bare focus stop: describe its keys, so a screen reader says what it can do there
  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.setAttribute('aria-describedby', descriptionId);
    return () => canvas.removeAttribute('aria-describedby');
  }, [map, descriptionId]);

  useEffect(() => {
    if (!map || !enabled) return;
    const canvas = map.getCanvas();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target !== canvas || !isPickKey(e)) return;
      e.preventDefault();
      onPick(map.getCenter());
      setSaid((prev) => ({ text: PICK_MESSAGE, n: prev.n + 1 }));
    };
    canvas.addEventListener('keydown', onKeyDown);
    return () => canvas.removeEventListener('keydown', onKeyDown);
  }, [map, enabled, onPick]);

  // The crosshair shows only while the map has keyboard focus (a mouse click on the map focuses it too)
  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    const onFocus = () => setKeyboardFocus(canvas.matches(':focus-visible'));
    const onBlur = () => setKeyboardFocus(false);
    onFocus();
    canvas.addEventListener('focus', onFocus);
    canvas.addEventListener('blur', onBlur);
    return () => {
      canvas.removeEventListener('focus', onFocus);
      canvas.removeEventListener('blur', onBlur);
    };
  }, [map]);

  if (!map) return null;
  return createPortal(
    <>
      <AnimatePresence>{enabled && keyboardFocus && <CenterCrosshair key="pick-crosshair" map={map} color={CROSSHAIR_COLOR} />}</AnimatePresence>
      <p id={descriptionId} className="sr-only">
        {mapKeysDescription(enabled)}
      </p>
      {/* Always mounted, so each pick is read out (a freshly mounted region often isn't) */}
      <div role="status" aria-live="polite" className="sr-only">
        {said.text}
        {said.n % 2 ? ' ' : ''}
      </div>
    </>,
    map.getContainer(),
  );
}
