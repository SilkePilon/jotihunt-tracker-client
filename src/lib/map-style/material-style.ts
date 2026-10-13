/**
 * The Android app's "Material You" map, for the website: OpenFreeMap Liberty recoloured with Material 3 colour roles.
 * A port of the app's `MapStyles.materialYou`, `MapPalette` and `waterColors`; pure, so it is unit tested.
 */
import { Hct, SchemeTonalSpot } from '@material/material-color-utilities';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/** The Android app's fallback seed (#4C8C4A). */
export const ANDROID_SEED = 0x4c8c4a;

/**
 * Seed of the map's Material 3 scheme (tonal spot): the Android app's default green, so parks and woods stay green and
 * water stays blue. The site's orange (#ea580c) works too but turns parks rust-brown in dark mode.
 */
export const MAP_SEED = ANDROID_SEED;

/** The theme roles the map style uses, as CSS colours. */
export interface MapPalette {
  dark: boolean;
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  primaryContainer: string;
  warnContainer: string;
  water: string;
  onWater: string;
}

/** Road-number text on Liberty's white `road_N` shield sprites, in light and dark (Android `MapStyles.SHIELD_TEXT`). */
export const SHIELD_TEXT = '#191d17';

/** The app's `LightStatusColors` / `DarkStatusColors` warn container (amber; Material 3 has no warn role). */
const WARN_CONTAINER = { light: '#ffddb8', dark: '#693c00' };

/** "#rrggbb" when opaque, else "rgba(r, g, b, a)" (a with up to 3 decimals). */
export function argbToCss(argb: number): string {
  const a = (argb >>> 24) & 0xff;
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  if (a === 0xff) return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;
}

/** The map palette of the tonal-spot scheme for [seed] (RGB, alpha ignored). */
export function mapPalette(seed: number, dark: boolean): MapPalette {
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

// ---- Water: always blue (Android `WaterColors.kt`) ----

/** Water's own hue (#4A90C8), pulled a little towards the theme's primary and kept within the blues. */
const WATER_HUE = 207;
const HARMONIZE = 0.15;
const MIN_HUE = 190;
const MAX_HUE = 228;

/** Water fill/line colour and its label colour as opaque ARGB (container / on-container tones). */
export interface WaterColors {
  water: number;
  onWater: number;
}

/**
 * A fixed blue hue harmonised ~15 % towards [primary], at container tones (light: water L* 85 / label 30, dark: 30 / 85),
 * so water stays blue whatever the seed.
 */
export function waterColors(primary: number, dark: boolean): WaterColors {
  let delta = hslHue(primary) - WATER_HUE;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const hue = Math.min(MAX_HUE, Math.max(MIN_HUE, WATER_HUE + delta * HARMONIZE));
  return {
    water: withLstar(hue, dark ? 0.3 : 0.55, dark ? 30 : 85),
    onWater: withLstar(hue, dark ? 0.6 : 0.5, dark ? 85 : 30),
  };
}

/** HSL hue in degrees of a "#rrggbb" colour (0 for greys). */
export function hueOf(css: string): number {
  return hslHue(Number.parseInt(css.slice(1, 7), 16));
}

function hslHue(argb: number): number {
  const r = ((argb >>> 16) & 0xff) / 255;
  const g = ((argb >>> 8) & 0xff) / 255;
  const b = (argb & 0xff) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0) return 0;
  let h: number;
  if (mx === r) {
    h = (g - b) / d;
    if (h < 0) h += 6;
  } else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h * 60;
}

/** CIELAB L* (= HCT tone) of an sRGB colour. */
export function lstar(argb: number): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin((argb >>> 16) & 0xff) + 0.7152 * lin((argb >>> 8) & 0xff) + 0.0722 * lin(argb & 0xff);
  const f = y > 216 / 24389 ? Math.cbrt(y) : ((24389 / 27) * y + 16) / 116;
  return 116 * f - 16;
}

/** The HSL colour of [hue]/[saturation] whose L* is closest to [target] (bisection on HSL lightness). */
function withLstar(hue: number, saturation: number, target: number): number {
  let lo = 0;
  let hi = 1;
  let best = hsl(hue, saturation, 0.5);
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    best = hsl(hue, saturation, mid);
    if (lstar(best) < target) lo = mid;
    else hi = mid;
  }
  return best;
}

function hsl(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const ch = (v: number) => Math.min(255, Math.max(0, Math.round((v + m) * 255)));
  return ((0xff << 24) | (ch(r) << 16) | (ch(g) << 8) | ch(b)) >>> 0;
}

// ---- Layer roles (Android `roleOf`) ----

/** Colour role of a Liberty layer in the Material style. */
export type Role =
  | 'background'
  | 'hide'
  | 'water'
  | 'green'
  | 'building'
  | 'landuse'
  | 'ground'
  | 'waterLine'
  | 'casing'
  | 'motorway'
  | 'road'
  | 'rail'
  | 'boundary'
  | 'runway'
  | 'parkOutline'
  | 'waterLabel'
  | 'shield'
  | 'label'
  | 'keep';

const GREEN_FILLS = new Set(['park', 'landcover_wood', 'landcover_grass', 'landcover_wetland', 'landuse_pitch', 'landuse_cemetery']);

export function roleOf(type: string, id: string): Role {
  switch (type) {
    case 'background':
      return 'background';
    case 'raster':
    case 'fill-extrusion':
      return 'hide';
    case 'symbol':
      if (id.startsWith('poi_') || id === 'airport') return 'hide';
      if (id.includes('shield')) return 'shield';
      return id.includes('water') ? 'waterLabel' : 'label';
    case 'fill':
      if (id === 'water') return 'water';
      if (GREEN_FILLS.has(id)) return 'green';
      if (id === 'building') return 'building';
      if (id === 'road_area_pattern') return 'hide';
      if (id.startsWith('landuse_')) return 'landuse';
      return 'ground';
    case 'line':
      if (id.startsWith('waterway')) return 'waterLine';
      if (id.includes('casing')) return 'casing';
      if (id.includes('rail')) return 'rail';
      if (id.includes('motorway')) return 'motorway';
      if (id.startsWith('road_') || id.startsWith('tunnel_') || id.startsWith('bridge_')) return 'road';
      if (id.startsWith('boundary')) return 'boundary';
      if (id.startsWith('aeroway')) return 'runway';
      if (id === 'park_outline') return 'parkOutline';
      return 'keep';
    default:
      return 'keep';
  }
}

type Paint = Record<string, unknown>;

/** The paint changes of [role]: properties to set and to remove. */
function paintFor(role: Role, p: MapPalette): { set: Paint; remove?: string[] } | null {
  switch (role) {
    case 'background':
      return { set: { 'background-color': p.surface } };
    case 'water':
      return { set: { 'fill-color': p.water }, remove: ['fill-pattern'] };
    case 'green':
      return {
        set: { 'fill-color': p.primaryContainer, 'fill-opacity': p.dark ? 0.35 : 0.55 },
        remove: ['fill-pattern', 'fill-outline-color'],
      };
    case 'building':
      return { set: { 'fill-color': p.surfaceContainerHighest }, remove: ['fill-pattern', 'fill-outline-color'] };
    case 'landuse':
      return { set: { 'fill-color': p.surfaceContainer }, remove: ['fill-pattern'] };
    case 'ground':
      return { set: { 'fill-color': p.surfaceContainerLow }, remove: ['fill-pattern'] };
    case 'waterLine':
      return { set: { 'line-color': p.water } };
    case 'casing':
      return { set: { 'line-color': p.outlineVariant } };
    case 'motorway':
      return { set: { 'line-color': p.warnContainer } };
    case 'road':
      return { set: { 'line-color': p.dark ? p.surfaceContainerHigh : p.surfaceContainerLowest } };
    case 'rail':
    case 'boundary':
      return { set: { 'line-color': p.outline } };
    case 'runway':
      return { set: { 'line-color': p.surfaceContainerHighest } };
    case 'parkOutline':
      return { set: { 'line-color': p.primaryContainer } };
    case 'waterLabel':
      return { set: { 'text-color': p.onWater, 'text-halo-color': p.surface } };
    case 'shield':
      // The road_N shield sprites are opaque white in both themes (not SDF, so not tintable): always dark text.
      return { set: { 'text-color': SHIELD_TEXT } };
    case 'label':
      return { set: { 'text-color': p.onSurfaceVariant, 'text-halo-color': p.surface } };
    case 'hide':
    case 'keep':
      return null;
  }
}

function recolour(layer: LayerSpecification, p: MapPalette): LayerSpecification {
  const role = roleOf(layer.type, layer.id);
  const loose = layer as LayerSpecification & { paint?: Paint; layout?: Paint };
  if (role === 'hide') return { ...loose, layout: { ...loose.layout, visibility: 'none' } } as LayerSpecification;
  const change = paintFor(role, p);
  if (!change) return layer;
  const paint: Paint = { ...loose.paint };
  for (const key of change.remove ?? []) delete paint[key];
  Object.assign(paint, change.set);
  return { ...loose, paint } as LayerSpecification;
}

/** Liberty recoloured with the palette's roles; POIs, 3D buildings and the shaded-relief raster hidden. */
export function materialStyle(liberty: StyleSpecification, p: MapPalette): StyleSpecification {
  return { ...liberty, layers: liberty.layers.map((l) => recolour(l, p)) };
}
