import type { Map as MaplibreMap } from 'maplibre-gl';
import { markerImageId } from '@/lib/map-layers';
import { markerIcon } from '@/lib/markers';
import { MarkerType } from '@/types/MarkerType';
import { mapImagePixelRatio, rasterize } from '../map-images';

/** Map image id → icon URL, for every marker type plus the plain fox for unknown types. */
const FOX_ICONS: Record<string, string> = Object.fromEntries([...Object.values(MarkerType), 'unknown' as MarkerType].map((type) => [markerImageId(type), markerIcon(type)]));

/** Same size as the former HTML marker (h-7). */
const ICON_SIZE_PX = 28;

export interface FoxImages {
  pixelRatio: number;
  images: Record<string, ImageData>;
}

let loading: Promise<FoxImages> | undefined;

/** The fox icons rasterised once for the screen's pixel ratio (the SVGs can't be added to MapLibre directly). */
export function loadFoxImages(): Promise<FoxImages> {
  loading ??= (async () => {
    const pixelRatio = mapImagePixelRatio();
    const entries = await Promise.all(Object.entries(FOX_ICONS).map(async ([id, url]) => [id, await rasterize(url, ICON_SIZE_PX, pixelRatio)] as const));
    return { pixelRatio, images: Object.fromEntries(entries) };
  })();
  // A failed load (e.g. offline before the icons were cached) may be retried by the next caller
  loading.catch(() => (loading = undefined));
  return loading;
}

/**
 * Add the fox images the map's current style lacks. A style switch drops all images, so this also runs on
 * `styleimagemissing`; returns whether `id` (when given) is one of ours.
 */
export function addFoxImages(map: MaplibreMap, { pixelRatio, images }: FoxImages, id?: string): boolean {
  for (const [imageId, data] of Object.entries(images)) {
    if ((id === undefined || id === imageId) && !map.hasImage(imageId)) map.addImage(imageId, data, { pixelRatio });
  }
  return id === undefined || id in images;
}
