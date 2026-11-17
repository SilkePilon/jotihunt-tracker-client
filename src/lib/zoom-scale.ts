/**
 * Zoom-scaled map symbols: zoomed out (a whole province on screen) every icon, dot and line of our own layers is drawn
 * smaller so the overview stays readable; from street level on they are full size. One curve for the MapLibre layers
 * (an `interpolate` expression) and the HTML markers (a CSS variable set from the same function).
 */
import type { ExpressionSpecification } from 'maplibre-gl';

/** [zoom, scale] stops, linear in between and flat outside: 0.55× up to z8, 0.75× at z10, full size from z13 on. */
export const ZOOM_SCALE_STOPS: readonly (readonly [zoom: number, scale: number])[] = [
  [8, 0.55],
  [10, 0.75],
  [13, 1],
];

/** Text-bearing HTML markers (chips) never shrink below this: smaller text is unreadable. */
export const LABEL_MIN_SCALE = 0.8;

/** CSS variables on the map container that HTML markers scale by (`scale: var(...)`). */
export const MARKER_SCALE_VAR = '--map-marker-scale';
export const LABEL_SCALE_VAR = '--map-label-scale';

/** The symbol scale at `zoom` (the JS twin of {@link zoomScaled}). */
export function zoomScale(zoom: number): number {
  const first = ZOOM_SCALE_STOPS[0];
  const last = ZOOM_SCALE_STOPS[ZOOM_SCALE_STOPS.length - 1];
  if (!(zoom > first[0])) return first[1];
  if (zoom >= last[0]) return last[1];
  for (let i = 1; i < ZOOM_SCALE_STOPS.length; i++) {
    const [z1, s1] = ZOOM_SCALE_STOPS[i];
    if (zoom > z1) continue;
    const [z0, s0] = ZOOM_SCALE_STOPS[i - 1];
    return s0 + ((zoom - z0) / (z1 - z0)) * (s1 - s0);
  }
  return last[1];
}

/** Scale for HTML markers that carry text: follows {@link zoomScale} but stays readable. */
export function labelScale(zoom: number): number {
  return Math.max(LABEL_MIN_SCALE, zoomScale(zoom));
}

/**
 * `base` (an icon-size, line-width or circle-radius at full size) times the zoom scale, as a MapLibre expression. Zoom
 * expressions must be the outermost `interpolate`, so the base is multiplied into the stops.
 * @param isLabel Features for which this holds (images with text, e.g. hint labels) keep {@link LABEL_MIN_SCALE}
 */
export function zoomScaled(base: number, isLabel?: ExpressionSpecification): ExpressionSpecification {
  const stops = ZOOM_SCALE_STOPS.flatMap(([zoom, scale]) => {
    const value = round(base * scale);
    const label = round(base * Math.max(LABEL_MIN_SCALE, scale));
    return [zoom, isLabel && label !== value ? ['case', isLabel, label, value] : value];
  });
  return ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** `icon-size` of every marker symbol layer, and of its hover layer (10% larger). */
export const ICON_SIZE = zoomScaled(1);
export const HOVER_ICON_SIZE = zoomScaled(1.1);
