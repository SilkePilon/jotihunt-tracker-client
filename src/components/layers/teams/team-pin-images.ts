import type { Map as MaplibreMap } from 'maplibre-gl';
import { parseTeamPinImageId } from '@/lib/map-layers';
import { brighten, mapImagePixelRatio } from '../map-images';

// The former HTML pin (MapMarker SVG, 27 x 34.8 px) with its "visited" badge: a 14px green circle with a 2px white
// ring and a check, 4px outside the pin's top right corner
const PIN_WIDTH = 27;
const PIN_HEIGHT = 34.8;
const PIN_PATH = 'M27,13.5C27,19.07 20.25,27 14.75,34.5C14.02,35.5 12.98,35.5 12.25,34.5C6.75,27 0,19.22 0,13.5C0,6.04 6.04,0 13.5,0C20.96,0 27,6.04 27,13.5Z';
const PIN_OUTLINE_PATH =
  'M13.5,0C6.04,0 0,6.04 0,13.5C0,19.22 6.75,27 12.25,34.5C13,35.52 14.02,35.5 14.75,34.5C20.25,27 27,19.07 27,13.5C27,6.04 20.96,0 13.5,0ZM13.5,1C20.42,1 26,6.58 26,13.5C26,15.9 24.5,19.18 22.22,22.74C19.95,26.3 16.71,30.14 13.94,33.91C13.74,34.18 13.61,34.32 13.5,34.44C13.39,34.32 13.26,34.18 13.06,33.91C10.28,30.13 7.41,26.31 5.02,22.77C2.62,19.23 1,15.95 1,13.5C1,6.58 6.58,1 13.5,1Z';
const BADGE_CENTER = { x: PIN_WIDTH + 4 - 7, y: -4 + 7 };
const BADGE_RADIUS = 7;
const BADGE_RING = 2;
const BADGE_COLOR = '#16a34a';
/** lucide's check icon (24 x 24), drawn at 10px with stroke width 3 */
const CHECK_PATH = 'M20 6 9 17l-5-5';
const CHECK_SIZE = 10;

// Room for the badge (it sticks out above and to the right); the same on the left, so the pin's tip stays at the
// bottom centre of every image (icon-anchor: bottom), with or without badge
const PAD_X = BADGE_CENTER.x + BADGE_RADIUS + BADGE_RING - PIN_WIDTH;
const IMAGE_WIDTH = PIN_WIDTH + 2 * PAD_X;
const IMAGE_HEIGHT = 41;
const PAD_TOP = IMAGE_HEIGHT - PIN_HEIGHT;

function drawPin(color: string, visited: boolean, pixelRatio: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH * pixelRatio;
  canvas.height = IMAGE_HEIGHT * pixelRatio;
  const context = canvas.getContext('2d')!;
  context.scale(pixelRatio, pixelRatio);
  context.translate(PAD_X, PAD_TOP);

  context.save();
  // The SVG's viewport cut the tip off at its height
  context.beginPath();
  context.rect(0, 0, PIN_WIDTH, PIN_HEIGHT);
  context.clip();
  context.fillStyle = color;
  context.fill(new Path2D(PIN_PATH));
  context.fillStyle = 'rgba(0, 0, 0, 0.25)';
  context.fill(new Path2D(PIN_OUTLINE_PATH));
  context.restore();
  context.fillStyle = '#fff';
  context.beginPath();
  context.arc(13.5, 13.5, 5.5, 0, 2 * Math.PI);
  context.fill();

  if (visited) {
    context.beginPath();
    context.arc(BADGE_CENTER.x, BADGE_CENTER.y, BADGE_RADIUS + BADGE_RING, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = BADGE_COLOR;
    context.beginPath();
    context.arc(BADGE_CENTER.x, BADGE_CENTER.y, BADGE_RADIUS, 0, 2 * Math.PI);
    context.fill();
    context.translate(BADGE_CENTER.x - CHECK_SIZE / 2, BADGE_CENTER.y - CHECK_SIZE / 2);
    context.scale(CHECK_SIZE / 24, CHECK_SIZE / 24);
    context.strokeStyle = '#fff';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke(new Path2D(CHECK_PATH));
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Draw and add a group pin image when `id` is one (see teamPinImageId). Pins are drawn on demand from
 * `styleimagemissing`, so any area colour works and a style switch (which drops all images) just draws them again.
 * @returns whether `id` is a team pin image
 */
export function addTeamPinImage(map: MaplibreMap, id: string): boolean {
  const pin = parseTeamPinImageId(id);
  if (!pin) return false;
  if (map.hasImage(id)) return true;
  const pixelRatio = mapImagePixelRatio();
  let image: ImageData;
  try {
    image = drawPin(pin.color, pin.visited, pixelRatio);
  } catch {
    // No 2D canvas (e.g. iOS Safari over its canvas memory limit): a plain dot keeps the group on the map
    image = fallbackDot(pin.color);
    map.addImage(id, image, { pixelRatio: 1 });
    return true;
  }
  map.addImage(id, pin.hover ? brighten(image) : image, { pixelRatio });
  return true;
}

/** A 16 px dot in the pin colour (#rrggbb, otherwise orange), drawn pixel by pixel so it needs no canvas. */
function fallbackDot(color: string): ImageData {
  const size = 16;
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1] ?? 'f97316';
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
