/**
 * Derives the map palette from a seed with @material/material-color-utilities (a devDependency). Only the unit tests
 * use it, to check the precomputed `MAP_PALETTES` in material-style.ts; the app never imports this file.
 */
import { Hct, SchemeTonalSpot } from '@material/material-color-utilities';
import { argbToCss, type MapPalette, WARN_CONTAINER, waterColors } from './material-style';

/** The map palette of the tonal-spot scheme for [seed] (RGB, alpha ignored). */
export function mapPaletteFromSeed(seed: number, dark: boolean): MapPalette {
  const s = new SchemeTonalSpot(Hct.fromInt((0xff000000 | seed) >>> 0), dark, 0);
  const water = waterColors(s.primary, dark);
  return {
    dark,
    surface: argbToCss(s.surface),
    surfaceContainerLowest: argbToCss(s.surfaceContainerLowest),
    surfaceContainerLow: argbToCss(s.surfaceContainerLow),
    surfaceContainer: argbToCss(s.surfaceContainer),
    surfaceContainerHigh: argbToCss(s.surfaceContainerHigh),
    surfaceContainerHighest: argbToCss(s.surfaceContainerHighest),
    onSurfaceVariant: argbToCss(s.onSurfaceVariant),
    outline: argbToCss(s.outline),
    outlineVariant: argbToCss(s.outlineVariant),
    primaryContainer: argbToCss(s.primaryContainer),
    warnContainer: dark ? WARN_CONTAINER.dark : WARN_CONTAINER.light,
    water: argbToCss(water.water),
    onWater: argbToCss(water.onWater),
  };
}
