import type { Map as MaplibreMap } from 'maplibre-gl';

/** How long turning back to north-up and flat takes (MapLibre jumps instead under prefers-reduced-motion) */
const RESET_MS = 500;

export const RESET_NORTH_LABEL = 'Noorden boven en plat';

/**
 * Turn the map back to north-up and flat. MapLibre's easeTo skips the animation (a jump) when the OS asks for reduced
 * motion, since this isn't marked `essential`.
 */
export function resetNorth(map: MaplibreMap) {
  map.easeTo({ bearing: 0, pitch: 0, duration: RESET_MS });
}

/**
 * The reset tile is about to fold away under the keyboard focus: hand the focus to the map, so it isn't lost on the page
 * (a mouse or tap press keeps it where it was).
 */
export function keepFocusAfterReset(button: HTMLElement, map: MaplibreMap) {
  if (button.matches(':focus-visible')) map.getCanvas().focus();
}
