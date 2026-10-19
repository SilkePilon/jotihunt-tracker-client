import type { Map as MaplibreMap } from 'maplibre-gl';
import { parseBadgeImageId } from '@/lib/trails';
import { mapImagePixelRatio } from '../map-images';

// Car glyph on a 24px grid (same as the leg-style mockup)
const CAR_PATH = 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zm2.2-1h9.6l-1-3H8.2zM7.5 14a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4m9 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4';
/** Badge size in CSS pixels */
const SIZE = 26;

/** White rounded tile with the car in the area colour; `extra` (extra verplaatsing) adds a "+" dot top-right. */
function drawBadge(mode: 'car' | 'extra', color: string, ratio: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  ctx.scale(ratio, ratio);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e7e5e4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, SIZE - 1, SIZE - 1, 9);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(4, 4);
  ctx.scale(18 / 24, 18 / 24);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(CAR_PATH));
  ctx.restore();
  if (mode === 'extra') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(SIZE - 6, 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(SIZE - 8.5, 5.25, 5, 1.5);
    ctx.fillRect(SIZE - 6.75, 3.5, 1.5, 5);
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * styleimagemissing handler for the `trail-badge:<mode>:<color>` ids (see badgeImageId); ignores other ids.
 * @returns whether `id` is a trail badge
 */
export function addTrailBadge(map: MaplibreMap, id: string): boolean {
  const parsed = parseBadgeImageId(id);
  if (!parsed) return false;
  if (map.hasImage(id)) return true;
  const pixelRatio = mapImagePixelRatio();
  try {
    map.addImage(id, drawBadge(parsed.mode, parsed.color, pixelRatio), { pixelRatio });
  } catch {
    // No 2D canvas (iOS Safari's memory limit) or added concurrently: no badge until the next style change
  }
  return true;
}
