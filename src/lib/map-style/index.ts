import type { StyleSpecification } from 'maplibre-gl';
import libertyJson from './liberty.json';
import { darkLibertyStyle } from './dark-liberty';
import { mapPalette, materialStyle } from './material-style';

/**
 * OpenFreeMap Liberty, bundled (a copy of the Android app's `assets/map/liberty.json`) so the default map style is
 * built without a style round-trip. Tiles, glyphs and sprite load from tiles.openfreemap.org; the service worker keeps
 * them (map-tile-cache.ts), so offline the map still draws the places already seen.
 */
const LIBERTY = libertyJson as unknown as StyleSpecification;

const cache: Partial<Record<'light' | 'dark', StyleSpecification>> = {};

/** The Material map style (seed `MAP_SEED`) for the light or dark theme; built once per theme. */
export function materialMapStyle(dark: boolean): StyleSpecification {
  const key = dark ? 'dark' : 'light';
  return (cache[key] ??= materialStyle(LIBERTY, mapPalette(dark)));
}

let darkStreets: StyleSpecification | undefined;

/** "Straten" in the dark theme: the bundled Liberty copy darkened (see dark-liberty.ts); built once. */
export function darkStreetsStyle(): StyleSpecification {
  return (darkStreets ??= darkLibertyStyle(LIBERTY));
}
