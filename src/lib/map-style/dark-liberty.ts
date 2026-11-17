/**
 * "Straten" in the dark theme: OpenFreeMap Liberty with every paint colour darkened in OKLab (hue kept, chroma toned
 * down), so the familiar Liberty map no longer glares next to the dark UI. Roads stay a step above the ground, labels
 * turn light on dark halos, and the white `road_N` shields swap to the drawn dark shields (material-style's
 * {@link darkShieldIcon}). Pure, so it is unit tested; the light theme keeps Liberty untouched.
 */
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { darkShieldIcon, roleOf, SHIELD_TEXT_DARK } from './material-style';

type Rgba = [r: number, g: number, b: number, a: number];

/** "#rgb", "#rrggbb", "rgb()/rgba()" or "hsl()/hsla()" as 0-1 sRGB + alpha; undefined for anything else. */
export function parseColour(text: string): Rgba | undefined {
  const s = text.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255).concat(1) as Rgba;
  }
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
  if (!fn) return undefined;
  const parts = fn[2].split(',').map((p) => p.trim());
  if (parts.length < 3 || parts.length > 4) return undefined;
  const alpha = parts[3] === undefined ? 1 : Number.parseFloat(parts[3]);
  const nums = parts.slice(0, 3).map((p) => Number.parseFloat(p));
  if ([...nums, alpha].some((n) => Number.isNaN(n))) return undefined;
  if (fn[1].startsWith('rgb')) return [nums[0] / 255, nums[1] / 255, nums[2] / 255, alpha];
  const [h, sat, l] = [nums[0], nums[1] / 100, nums[2] / 100];
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4), alpha];
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => {
  const v = Math.min(1, Math.max(0, c));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
};

/** sRGB (0-1) to OKLab [L, a, b]. */
export function toOklab([r, g, b]: Rgba): [number, number, number] {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function toCss([r, g, b]: [number, number, number], alpha: number): string {
  const ch = [r, g, b].map((c) => Math.round(c * 255));
  if (alpha >= 1) return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${ch.join(', ')}, ${Number(alpha.toFixed(3))})`;
}

/**
 * How a colour is darkened: ground (fills, water, halos, road casings) sinks, roads stay a step above the ground, the
 * thin dark lines of the light map (rails, borders) and the labels turn light.
 */
export type Tone = 'ground' | 'road' | 'line' | 'text';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * OKLab lightness in the dark map, from the light colour's L. Ground and roads keep Liberty's order (darker in light =
 * darker in dark), measured from white: the cream background lands near the dark card (~0.25), water and buildings a
 * little below it, white roads ~0.42. Lines and text flip: the darker they were on the light map, the lighter now.
 */
export function darkLightness(L: number, tone: Tone): number {
  const fromWhite = 1 - L;
  switch (tone) {
    case 'ground':
      return clamp(0.27 - fromWhite * 0.4, 0.17, 0.3);
    case 'road':
      return clamp(0.42 - fromWhite * 0.8, 0.28, 0.42);
    case 'line':
      return clamp(0.27 + fromWhite * 0.6, 0.32, 0.6);
    case 'text':
      return clamp(1.05 - L * 0.6, 0.6, 0.92);
  }
}

/** One colour string darkened for `tone`; anything that isn't a colour (expression operators, names) as is. */
export function darkenColour(text: string, tone: Tone): string {
  const rgba = parseColour(text);
  if (!rgba) return text;
  const [L, a, b] = toOklab(rgba);
  // Dark surfaces carry less chroma (no neon greens/oranges); text keeps a little more to stay recognisable
  const chroma = tone === 'text' ? 0.8 : 0.65;
  return toCss(fromOklab(darkLightness(L, tone), a * chroma, b * chroma), rgba[3]);
}

/** Every colour string inside a paint value (plain or an expression such as interpolate/match) darkened. */
function darkenValue(value: unknown, tone: Tone): unknown {
  if (typeof value === 'string') return darkenColour(value, tone);
  if (Array.isArray(value)) return value.map((v) => darkenValue(v, tone));
  return value;
}

/** The tone of a colour property on a layer: labels, roads, the thin lines, or ground (fills, outlines, halos). */
function toneOf(layer: LayerSpecification, key: string): Tone {
  if (key === 'text-color') return 'text';
  // Halos are the ground behind the label
  if (key === 'text-halo-color' || layer.type !== 'line') return 'ground';
  const role = roleOf(layer.type, layer.id);
  if (role === 'road' || role === 'motorway') return 'road';
  // Rivers drawn as lines match the water fill; road casings stay a dark edge around the lighter road
  return role === 'waterLine' || role === 'casing' ? 'ground' : 'line';
}

type Loose = LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown> };

function darkenLayer(layer: LayerSpecification): LayerSpecification {
  const loose = layer as Loose;
  const paint: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(loose.paint ?? {})) {
    paint[key] = key.endsWith('-color') ? darkenValue(value, toneOf(layer, key)) : value;
  }
  // The shaded-relief raster (zoomed out) and the bright sprite patterns (wetland, pedestrian areas) toned down
  if (layer.type === 'raster') paint['raster-brightness-max'] = 0.35;
  if (layer.type === 'fill' && 'fill-pattern' in paint) paint['fill-opacity'] = 0.25;
  const darkIcon = layer.type === 'symbol' ? darkShieldIcon(loose.layout?.['icon-image']) : undefined;
  if (darkIcon) return { ...loose, layout: { ...loose.layout, 'icon-image': darkIcon }, paint: { ...paint, 'text-color': SHIELD_TEXT_DARK } } as LayerSpecification;
  return (Object.keys(paint).length ? { ...loose, paint } : layer) as LayerSpecification;
}

/** Liberty with the dark-theme pass on every layer's paint colours and the dark road shields. */
export function darkLibertyStyle(liberty: StyleSpecification): StyleSpecification {
  return { ...liberty, layers: liberty.layers.map(darkenLayer) };
}
