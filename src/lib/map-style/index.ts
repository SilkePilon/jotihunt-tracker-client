import type { StyleSpecification } from 'maplibre-gl';
import libertyJson from './liberty.json';
import { MAP_SEED, mapPalette, materialStyle } from './material-style';

/**
 * OpenFreeMap Liberty, bundled (a copy of the Android app's `assets/map/liberty.json`) so the default map style is
 * built without a style round-trip. Tiles, glyphs and sprite load from tiles.openfreemap.org (not cached by the service
 * worker, so offline the map shows only what the browser's HTTP cache still has).
 */
const LIBERTY = libertyJson as unknown as StyleSpecification;

const cache: Partial<Record<'light' | 'dark', StyleSpecification>> = {};

/** The Material map style (seed {@link MAP_SEED}) for the light or dark theme; built once per theme. */
export function materialMapStyle(dark: boolean): StyleSpecification {
  const key = dark ? 'dark' : 'light';
  return (cache[key] ??= materialStyle(LIBERTY, mapPalette(MAP_SEED, dark)));
}
