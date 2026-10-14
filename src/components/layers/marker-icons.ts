import { useEffect, type CSSProperties } from 'react';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import type { Map as MaplibreMap } from 'maplibre-gl';
import {
  areaLetter,
  groupColors,
  MARKER_PALETTES,
  type MarkerIconKey,
  type MarkerPalette,
  parseMarkerImageId,
  statusColors,
  vehicleGlyph,
  type AreaOrNone,
  type GlyphName,
  type MarkerTheme,
} from '@/lib/marker-style';
import { FOX_OUTLINE, GLYPHS } from './marker-glyphs';
import { mapImagePixelRatio } from './map-images';
import { BADGE_COOKIE_DEPTH, cookiePoints, MARKER_COOKIE_DEPTH } from '@/lib/cookie-shape';

/*
 * The map marker images, drawn like the Android app's MarkerIconFactory: every shape has a 2px surfaceContainerLowest
 * rim and a soft shadow, sizes below are the shape including the rim (Android dp = CSS px), and every image has PAD
 * room for the shadow. Drawn on demand from `styleimagemissing`, so a theme or style switch just draws them again.
 */

const PAD = 4;
const RIM = 2;
const BADGE = 16;
const SHADOW = 'rgba(0, 0, 0, 0.25)';
/** Hint label: the anchor dot sits this far right of the pill's left edge. */
const HINT_DOT_X = 8;
const FONT = '"Google Sans Flex", "Google Sans", Roboto, system-ui, sans-serif';

/**
 * `icon-offset` for hint images with `icon-anchor: bottom-left` that puts the anchor dot on the point: its centre is
 * PAD + HINT_DOT_X right of and PAD + 3 above the image's bottom-left corner.
 */
export const HINT_ANCHOR_OFFSET: [number, number] = [-(PAD + HINT_DOT_X), PAD + 3];

type Ctx = CanvasRenderingContext2D;

class Painter {
  constructor(
    readonly ctx: Ctx,
    readonly palette: MarkerPalette,
    private readonly ratio: number,
  ) {}

  /** Soft shadow for the next fill; Android `setShadowLayer(radius, 0, dy)` (shadows ignore the canvas transform). */
  shadow(radius: number, dy: number) {
    this.ctx.shadowColor = SHADOW;
    this.ctx.shadowBlur = radius * 1.5 * this.ratio;
    this.ctx.shadowOffsetY = dy * this.ratio;
  }

  noShadow() {
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetY = 0;
  }

  circle(cx: number, cy: number, r: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  /** Circle of `size` at (0, 0) with rim and shadow. */
  round(size: number, fill: string) {
    const r = size / 2;
    this.shadow(3, 1);
    this.circle(r, r, r, this.palette.surfaceContainerLowest);
    this.noShadow();
    this.circle(r, r, r - RIM, fill);
  }

  /** Square with 14px corners at (0, 0) with rim and shadow. */
  roundedSquare(size: number, fill: string) {
    const { ctx } = this;
    this.shadow(3, 1);
    ctx.fillStyle = this.palette.surfaceContainerLowest;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 14);
    ctx.fill();
    this.noShadow();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(RIM, RIM, size - 2 * RIM, size - 2 * RIM, 14 - RIM);
    ctx.fill();
  }

  /** 9-lobe cookie (Android `cookie`), see {@link cookiePoints}. */
  cookie(cx: number, cy: number, radius: number, color: string, depth = MARKER_COOKIE_DEPTH) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const [x, y] of cookiePoints(cx, cy, radius, depth)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }

  /** Material Symbol of `size` centred on (cx, cy). */
  glyph(name: GlyphName, cx: number, cy: number, size: number, color: string) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ctx.fill(new Path2D(GLYPHS[name]));
    ctx.restore();
  }

  /** The outline fox of `size` centred on (cx, cy). */
  fox(cx: number, cy: number, size: number, color: string) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color;
    ctx.lineWidth = FOX_OUTLINE.headStrokeWidth;
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(FOX_OUTLINE.head));
    ctx.fillStyle = color;
    ctx.fill(new Path2D(FOX_OUTLINE.features));
    ctx.restore();
  }

  font(size: number, bold: boolean) {
    this.ctx.font = `${bold ? 700 : 500} ${size}px ${FONT}`;
  }

  /** Text centred on (cx, cy) with the font set by {@link font}. */
  text(s: string, cx: number, cy: number, color: string) {
    const { ctx } = this;
    const metrics = ctx.measureText(s);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, cx, cy + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);
  }
}

interface Drawing {
  width: number;
  height: number;
  draw: (p: Painter) => void;
}

/** Circle icon of `size` (plus PAD); `content` draws into the size × size square at (0, 0). */
function circleIcon(size: number, fill: string, content: (p: Painter, size: number) => void): Drawing {
  return {
    width: size + 2 * PAD,
    height: size + 2 * PAD,
    draw: (p) => {
      p.ctx.translate(PAD, PAD);
      p.round(size, fill);
      content(p, size);
    },
  };
}

/**
 * Shape of `size` drawn at (0, 0) plus a 16px badge over its bottom-right corner (an area letter, or `badge` for
 * other contents) on a round or cookie-shaped rim. The overhang is added on all sides, so the shape stays centred
 * on the point.
 */
function badged(
  size: number,
  shape: (p: Painter, size: number) => void,
  badge?: (p: Painter, cx: number, cy: number) => void,
  base: 'round' | 'cookie' = 'round',
): Drawing {
  const overhang = BADGE / 4;
  const side = size + overhang + 2 * PAD;
  return {
    width: side,
    height: side,
    draw: (p) => {
      p.ctx.translate(PAD + overhang / 2, PAD + overhang / 2);
      shape(p, size);
      if (!badge) return;
      const c = size - BADGE / 2 + overhang / 2;
      p.shadow(1.5, 0.5);
      if (base === 'cookie') p.cookie(c, c, BADGE / 2, p.palette.surfaceContainerLowest, BADGE_COOKIE_DEPTH);
      else p.circle(c, c, BADGE / 2, p.palette.surfaceContainerLowest);
      p.noShadow();
      badge(p, c, c);
    },
  };
}

function letterBadge(area: AreaOrNone, color: string) {
  const letter = areaLetter(area);
  if (!letter) return undefined;
  return (p: Painter, cx: number, cy: number) => {
    p.font(10, true);
    p.text(letter, cx, cy, color);
  };
}

/** Lock instead of the area letter: a marker of an area we may not hunt (rule 5.1). */
function lockBadge(color: string) {
  return (p: Painter, cx: number, cy: number) => p.glyph('lock', cx, cy, 10, color);
}

/** Locked markers are drawn at this opacity (applied to the finished image, so rim and fill don't show through each other). */
const LOCKED_ALPHA = 0.8;

function isLocked(key: MarkerIconKey): boolean {
  return (key.kind === 'fox' || key.kind === 'prediction') && key.locked;
}

/** Scale the alpha channel (ImageData is not premultiplied). */
function fadeImage(image: ImageData, alpha: number) {
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = Math.round(image.data[i] * alpha);
}

const FOX_SIZE = 38;
const HUNTER_SIZE = 38;
const GROUP_SIZE = 28;
const PREDICTION_SIZE = 30;
const ARROW_SIZE = 14;

function drawing(key: MarkerIconKey, palette: MarkerPalette, measure: Ctx): Drawing {
  switch (key.kind) {
    case 'hunter': {
      const glyph = vehicleGlyph(key.icon);
      return key.stale
        ? circleIcon(HUNTER_SIZE, palette.surfaceContainerHighest, (p, s) => {
            p.ctx.globalAlpha = 0.6;
            p.glyph(glyph, s / 2, s / 2, 20, palette.onSurfaceVariant);
            p.ctx.globalAlpha = 1;
          })
        : circleIcon(HUNTER_SIZE, palette.secondaryContainer, (p, s) => p.glyph(glyph, s / 2, s / 2, 20, palette.onSecondaryContainer));
    }
    case 'fox': {
      // Locked (an area we may not hunt): neutral grey with a lock badge, whatever the type or status
      const neutral = { container: palette.surfaceContainerHighest, on: palette.onSurfaceVariant };
      const badge = (on: string) => (key.locked ? lockBadge(neutral.on) : letterBadge(key.area, on));
      if (key.type === 'hunt') {
        const { container, on } = key.locked ? neutral : { container: palette.tertiaryContainer, on: palette.onTertiaryContainer };
        return badged(
          FOX_SIZE,
          (p, s) => {
            p.shadow(3, 1);
            p.cookie(s / 2, s / 2, s / 2, palette.surfaceContainerLowest);
            p.noShadow();
            p.cookie(s / 2, s / 2, s / 2 - RIM, container);
            p.glyph('photo_camera', s / 2, s / 2, 20, on);
          },
          badge(on),
        );
      }
      // A spot in the area's status colours; an unknown type (web only) in neutral grey
      const { container, on } = key.locked || key.type !== 'spot' ? neutral : statusColors(key.status, palette);
      return badged(
        FOX_SIZE,
        (p, s) => {
          p.roundedSquare(s, container);
          p.fox(s / 2, s / 2, 22, on);
        },
        badge(on),
      );
    }
    case 'prediction': {
      const grey = key.stale || key.locked;
      const [fill, on] = grey ? [palette.surfaceContainerHighest, palette.onSurfaceVariant] : [palette.tertiary, palette.onTertiary];
      return badged(
        PREDICTION_SIZE,
        (p, s) => {
          p.round(s, fill);
          p.fox(s / 2, s / 2, 18, on);
        },
        // The badge is light: the letter takes the pin colour (on-colour when greyed out); a lock when locked
        key.locked ? lockBadge(on) : letterBadge(key.area, key.stale ? on : fill),
      );
    }
    case 'group': {
      const colors = groupColors(key.area);
      const shape = (p: Painter, s: number) => {
        p.round(s, colors?.fill ?? palette.surfaceContainerLowest);
        if (!colors) {
          p.ctx.strokeStyle = palette.secondary;
          p.ctx.lineWidth = 2;
          p.ctx.beginPath();
          p.ctx.arc(s / 2, s / 2, s / 2 - 1, 0, 2 * Math.PI);
          p.ctx.stroke();
        }
        p.glyph('home', s / 2, s / 2, 16, colors?.on ?? palette.secondary);
      };
      if (!key.visited) return circleIcon(GROUP_SIZE, colors?.fill ?? palette.surfaceContainerLowest, (p, s) => shape(p, s));
      // Visited (web only): the cookie check badge of the "Mijn tracker" card, on the ok colour
      return badged(
        GROUP_SIZE,
        shape,
        (p, cx, cy) => {
          p.cookie(cx, cy, BADGE / 2 - 1.5, palette.ok, BADGE_COOKIE_DEPTH);
          p.glyph('check', cx, cy, 11, palette.surfaceContainerLowest);
        },
        'cookie',
      );
    }
    case 'hint': {
      const letter = areaLetter(key.area);
      const label = [letter, key.label].filter(Boolean).join(' · ');
      measure.font = `500 12px ${FONT}`;
      const height = 24;
      const width = Math.ceil(measure.measureText(label).width) + 16;
      const dot = 6;
      const gap = 2;
      return {
        width: width + 2 * PAD,
        height: PAD + height + gap + dot + PAD,
        draw: (p) => {
          const { ctx } = p;
          p.shadow(3, 1);
          ctx.fillStyle = palette.primaryContainer;
          ctx.beginPath();
          ctx.roundRect(PAD, PAD, width, height, height / 2);
          ctx.fill();
          p.noShadow();
          p.font(12, false);
          p.text(label, PAD + width / 2, PAD + height / 2, palette.onPrimaryContainer);
          const x = PAD + HINT_DOT_X;
          const y = PAD + height + gap + dot / 2;
          p.circle(x, y, dot / 2 + 1, palette.surfaceContainerLowest);
          p.circle(x, y, dot / 2, palette.primary);
        },
      };
    }
    case 'hintdot': {
      const dot = 6;
      return {
        width: 2 * PAD + 2 * HINT_DOT_X,
        height: 2 * PAD + dot,
        draw: (p) => {
          const x = PAD + HINT_DOT_X;
          const y = PAD + dot / 2;
          p.shadow(2, 1);
          p.circle(x, y, dot / 2 + 1, palette.surfaceContainerLowest);
          p.noShadow();
          p.circle(x, y, dot / 2, palette.primary);
        },
      };
    }
    case 'arrow':
      return {
        width: ARROW_SIZE + 2 * PAD,
        height: ARROW_SIZE + 2 * PAD,
        draw: (p) => {
          const { ctx } = p;
          const s = ARROW_SIZE;
          const path = new Path2D();
          path.moveTo(PAD + s / 2, PAD);
          path.lineTo(PAD + s, PAD + s);
          path.lineTo(PAD + s / 2, PAD + s * 0.72);
          path.lineTo(PAD, PAD + s);
          path.closePath();
          p.shadow(2, 1);
          ctx.fillStyle = palette.secondary;
          ctx.fill(path);
          p.noShadow();
          ctx.strokeStyle = palette.surfaceContainerLowest;
          ctx.lineWidth = 1.5;
          ctx.stroke(path);
        },
      };
  }
}

/** Draw one marker image at `pixelRatio`. Throws when there is no 2D canvas. */
export function drawMarkerIcon(key: MarkerIconKey, palette: MarkerPalette, pixelRatio: number): ImageData {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  const { width, height, draw } = drawing(key, palette, ctx);
  canvas.width = Math.ceil(width * pixelRatio);
  canvas.height = Math.ceil(height * pixelRatio);
  ctx.scale(pixelRatio, pixelRatio);
  draw(new Painter(ctx, palette, pixelRatio));
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (isLocked(key)) fadeImage(image, LOCKED_ALPHA);
  // Release the backing store right away (iOS Safari limits the total canvas memory)
  canvas.width = 0;
  canvas.height = 0;
  return image;
}

/** A 16px dot drawn pixel by pixel, so the marker stays on the map without a canvas (iOS Safari's memory limit). */
function fallbackDot(color: string): ImageData {
  const size = 16;
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1] ?? '3b6939';
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const data = new Uint8ClampedArray(size * size * 4);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - center, y - center);
      const i = (y * size + x) * 4;
      const ring = distance > size / 2 - 2.5;
      data[i] = ring ? 255 : r;
      data[i + 1] = ring ? 255 : g;
      data[i + 2] = ring ? 255 : b;
      data[i + 3] = distance <= size / 2 ? 255 : 0;
    }
  }
  return new ImageData(data, size, size);
}

/**
 * Draw and add the marker image `id` when it is one of ours (see themedImageId).
 * @returns whether `id` is a marker image
 */
export function addMarkerImage(map: MaplibreMap, id: string): boolean {
  const parsed = parseMarkerImageId(id);
  if (!parsed) return false;
  if (map.hasImage(id)) return true;
  const palette = MARKER_PALETTES[parsed.theme];
  const pixelRatio = mapImagePixelRatio();
  try {
    map.addImage(id, drawMarkerIcon(parsed.key, palette, pixelRatio), { pixelRatio });
  } catch {
    map.addImage(id, fallbackDot(palette.primary), { pixelRatio: 1 });
  }
  return true;
}

/** The marker theme: follows the site's dark mode (the `dark` class on the body). */
export function useMarkerTheme(): MarkerTheme {
  return useDarkMode() ? 'dark' : 'light';
}

/** The marker colours for the site's current theme. */
export function useMarkerPalette(): MarkerPalette {
  return MARKER_PALETTES[useMarkerTheme()];
}

/**
 * Draw marker images when the map asks for them (first use, a theme switch, or a style switch that dropped them).
 * Used once, by MarkerImages: react-map-gl only renders the map's children once the map exists, and MarkerImages comes
 * before the layer components, so this effect subscribes before their Layer effects add the layers.
 */
export function useMarkerImages(map: MaplibreMap | undefined) {
  useEffect(() => {
    if (!map) return;
    const onMissing = (e: { id: string }) => addMarkerImage(map, e.id);
    map.on('styleimagemissing', onMissing);
    return () => {
      map.off('styleimagemissing', onMissing);
    };
  }, [map]);
}

/**
 * CSS variables for the HTML markers (own position, picked location; see index.css): the marker colours and the
 * own-position glyph as an SVG mask.
 */
export function markerCssVars(palette: MarkerPalette, meGlyph: GlyphName): CSSProperties {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${GLYPHS[meGlyph]}"/></svg>`;
  return {
    '--jh-marker-primary': palette.primary,
    '--jh-marker-on-primary': palette.onPrimary,
    '--jh-marker-rim': palette.surfaceContainerLowest,
    '--jh-marker-stale': palette.surfaceContainerHighest,
    '--jh-marker-on-stale': palette.onSurfaceVariant,
    '--jh-me-glyph': `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
  } as CSSProperties;
}
