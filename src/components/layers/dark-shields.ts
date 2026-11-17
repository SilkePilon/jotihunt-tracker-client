import { useEffect } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { darkShieldColours, darkShieldSize, mapPalette } from '@/lib/map-style/material-style';
import { mapImagePixelRatio } from './map-images';

/** Corner radius (CSS px): a little rounder than Liberty's sprite, like the app's other tiles. */
const RADIUS = 3;

/** A dark road shield the size of Liberty's `road_N` sprite: the map palette's raised tile with a 1px outline. */
function drawDarkShield(width: number, height: number, ratio: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  const { fill, outline } = darkShieldColours(mapPalette(true));
  ctx.scale(ratio, ratio);
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, width - 1, height - 1, RADIUS);
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * styleimagemissing handler for the dark theme's `jh-dark-road_N` shields (see `DARK_SHIELD_PREFIX`); ignores other ids.
 * @returns whether `id` is a dark shield
 */
export function addDarkShield(map: MaplibreMap, id: string): boolean {
  const size = darkShieldSize(id);
  if (!size) return false;
  if (map.hasImage(id)) return true;
  const pixelRatio = mapImagePixelRatio();
  try {
    map.addImage(id, drawDarkShield(size.width, size.height, pixelRatio), { pixelRatio });
  } catch {
    // No 2D canvas (iOS Safari's memory limit): the road number shows without a shield
  }
  return true;
}

/** Draws the dark road shields whenever the (dark) map style asks for one; a theme switch drops them, so it asks again. */
export function useDarkShields(map: MaplibreMap | undefined) {
  useEffect(() => {
    if (!map) return;
    const onMissing = (e: { id: string }) => void addDarkShield(map, e.id);
    map.on('styleimagemissing', onMissing);
    return () => {
      map.off('styleimagemissing', onMissing);
    };
  }, [map]);
}
