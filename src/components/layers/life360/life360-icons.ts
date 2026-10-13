import { BADGE_COOKIE_DEPTH, cookiePoints } from '@/lib/cookie-shape';
import { initialsColor } from '@/lib/life360';
import { coverRect, greyOut, type Life360Badge, type Life360IconSpec } from '@/lib/life360-map';
import { MARKER_PALETTES, type GlyphName, type MarkerPalette, type MarkerTheme } from '@/lib/marker-style';
import { GLYPHS } from '../marker-glyphs';

/*
 * A member marker, built like the visited group marker (marker-icons.ts): a round avatar with the surface rim and a
 * soft shadow, plus a cookie badge over its bottom-right corner telling what the member is doing.
 */

/** Avatar size including the rim. */
export const LIFE360_ICON_SIZE = 34;
const RIM = 2;
const BADGE = 20;
const BADGE_GLYPH = 14;
/** Room for the shadow. */
const PAD = 4;
const SHADOW = 'rgba(0, 0, 0, 0.25)';
const FONT = '"Google Sans Flex", "Google Sans", Roboto, system-ui, sans-serif';

/** Driving badge: darker than the accuracy green, so the white car reads (5:1 on light). */
const DRIVING_GREEN: Record<MarkerTheme, string> = { light: '#15803d', dark: '#16a34a' };
/** Low battery badge: amber-500 in both themes (the "Mijn tracker" warn badge). */
const BATTERY_AMBER = '#f59e0b';

/** Badge fill, glyph and glyph colour; undefined for a still member (no badge). */
function badgeStyle(badge: Life360Badge, theme: MarkerTheme, palette: MarkerPalette): { fill: string; glyph: GlyphName; on: string } | undefined {
  switch (badge) {
    case 'stale':
      return { fill: palette.surfaceContainerHighest, glyph: 'schedule', on: palette.onSurfaceVariant };
    case 'driving':
      return { fill: DRIVING_GREEN[theme], glyph: 'directions_car', on: '#ffffff' };
    case 'walking':
      return { fill: palette.secondaryContainer, glyph: 'directions_walk', on: palette.onSecondaryContainer };
    case 'battery':
      return { fill: BATTERY_AMBER, glyph: 'battery_alert', on: '#ffffff' };
    case 'still':
      return undefined;
  }
}

function circle(cx: number, cy: number, r: number): Path2D {
  const path = new Path2D();
  path.arc(cx, cy, r, 0, 2 * Math.PI);
  return path;
}

function cookie(cx: number, cy: number, radius: number): Path2D {
  const path = new Path2D();
  for (const [x, y] of cookiePoints(cx, cy, radius, BADGE_COOKIE_DEPTH)) path.lineTo(x, y);
  path.closePath();
  return path;
}

/** Soft shadow for the next fill (shadows ignore the canvas transform, hence × pixelRatio). */
function shadow(ctx: CanvasRenderingContext2D, radius: number, dy: number, pixelRatio: number) {
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = radius * 1.5 * pixelRatio;
  ctx.shadowOffsetY = dy * pixelRatio;
}

function noShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Draw one member marker at `pixelRatio`: the photo (or initials on the member's colour) in a round avatar with rim and
 * shadow, and the badge of {@link Life360IconSpec.badge}. A stale avatar is greyed, its clock badge is not.
 * Throws without a 2D canvas.
 */
export function drawLife360Icon(spec: Life360IconSpec, photo: HTMLImageElement | undefined, pixelRatio: number): ImageData {
  const palette = MARKER_PALETTES[spec.theme];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  // The badge overhang is added on all sides, so the avatar stays centred on the point
  const overhang = BADGE / 4;
  const side = LIFE360_ICON_SIZE + overhang + 2 * PAD;
  canvas.width = Math.ceil(side * pixelRatio);
  canvas.height = Math.ceil(side * pixelRatio);
  ctx.scale(pixelRatio, pixelRatio);
  ctx.translate(PAD + overhang / 2, PAD + overhang / 2);
  const c = LIFE360_ICON_SIZE / 2;

  shadow(ctx, 3, 1, pixelRatio);
  ctx.fillStyle = palette.surfaceContainerLowest;
  ctx.fill(circle(c, c, c));
  noShadow(ctx);

  const inner = circle(c, c, c - RIM);
  const inside = LIFE360_ICON_SIZE - 2 * RIM;
  if (photo && photo.naturalWidth > 0 && photo.naturalHeight > 0) {
    const { sx, sy, sw, sh } = coverRect(photo.naturalWidth, photo.naturalHeight);
    ctx.save();
    ctx.clip(inner);
    ctx.drawImage(photo, sx, sy, sw, sh, RIM, RIM, inside, inside);
    ctx.restore();
  } else {
    ctx.fillStyle = initialsColor(spec.memberId);
    ctx.fill(inner);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.initials, c, c + 0.5);
  }

  if (spec.badge === 'stale') {
    const avatar = ctx.getImageData(0, 0, canvas.width, canvas.height);
    greyOut(avatar.data);
    ctx.putImageData(avatar, 0, 0);
  }

  const style = badgeStyle(spec.badge, spec.theme, palette);
  if (style) {
    const b = LIFE360_ICON_SIZE - BADGE / 2 + overhang / 2;
    shadow(ctx, 1.5, 0.5, pixelRatio);
    ctx.fillStyle = palette.surfaceContainerLowest;
    ctx.fill(cookie(b, b, BADGE / 2));
    noShadow(ctx);
    ctx.fillStyle = style.fill;
    ctx.fill(cookie(b, b, BADGE / 2 - 1.5));
    ctx.save();
    ctx.translate(b - BADGE_GLYPH / 2, b - BADGE_GLYPH / 2);
    ctx.scale(BADGE_GLYPH / 24, BADGE_GLYPH / 24);
    ctx.fillStyle = style.on;
    ctx.fill(new Path2D(GLYPHS[style.glyph]));
    ctx.restore();
  }

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Release the backing store right away (iOS Safari limits the total canvas memory)
  canvas.width = 0;
  canvas.height = 0;
  return image;
}
