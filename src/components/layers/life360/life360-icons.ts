import { cookiePoints, MARKER_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { initialsColor } from '@/lib/life360';
import { coverRect, greyOut, life360RimColor, type Life360IconSpec } from '@/lib/life360-map';

/** Cookie size including the rim (mockup markers.html option C). */
export const LIFE360_ICON_SIZE = 44;
/** Width of the coloured rim around the photo. */
const RIM = 4;
/** Room for the shadow. */
const PAD = 4;
const FONT = '"Google Sans Flex", "Google Sans", Roboto, system-ui, sans-serif';

/** 9-lobe cookie (the hunt markers' shape) of `radius` centred on (c, c). */
function cookie(c: number, radius: number): Path2D {
  const path = new Path2D();
  for (const [x, y] of cookiePoints(c, c, radius, MARKER_COOKIE_DEPTH)) path.lineTo(x, y);
  path.closePath();
  return path;
}

/**
 * Draw one member marker at `pixelRatio`: the photo (or initials on the member's colour) clipped to the cookie, a
 * purple rim (green while driving), a soft shadow; greyed and 60 % opaque when stale. Throws without a 2D canvas.
 */
export function drawLife360Icon(spec: Life360IconSpec, photo: HTMLImageElement | undefined, pixelRatio: number): ImageData {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  const side = LIFE360_ICON_SIZE + 2 * PAD;
  canvas.width = Math.ceil(side * pixelRatio);
  canvas.height = Math.ceil(side * pixelRatio);
  ctx.scale(pixelRatio, pixelRatio);
  const c = side / 2;

  // Rim with a soft shadow (shadows ignore the canvas transform, hence × pixelRatio); stale is greyed afterwards
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 3 * pixelRatio;
  ctx.shadowOffsetY = pixelRatio;
  ctx.fillStyle = life360RimColor(spec.tone === 'stale' ? 'live' : spec.tone);
  ctx.fill(cookie(c, LIFE360_ICON_SIZE / 2));
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const inner = cookie(c, LIFE360_ICON_SIZE / 2 - RIM);
  const inside = LIFE360_ICON_SIZE - 2 * RIM;
  if (photo && photo.naturalWidth > 0 && photo.naturalHeight > 0) {
    const { sx, sy, sw, sh } = coverRect(photo.naturalWidth, photo.naturalHeight);
    ctx.save();
    ctx.clip(inner);
    ctx.drawImage(photo, sx, sy, sw, sh, c - inside / 2, c - inside / 2, inside, inside);
    ctx.restore();
  } else {
    ctx.fillStyle = initialsColor(spec.memberId);
    ctx.fill(inner);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.initials, c, c + 0.5);
  }

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (spec.tone === 'stale') greyOut(image.data);
  // Release the backing store right away (iOS Safari limits the total canvas memory)
  canvas.width = 0;
  canvas.height = 0;
  return image;
}
