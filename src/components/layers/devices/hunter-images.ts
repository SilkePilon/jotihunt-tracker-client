import type { Map as MaplibreMap } from 'maplibre-gl';
import carIcon from '@/assets/images/car.svg';
import bicycleIcon from '@/assets/images/bicycle.svg';
import walkingIcon from '@/assets/images/walking.svg';
import motorbikeIcon from '@/assets/images/motorbike.svg';
import phoneIcon from '@/assets/images/phone.svg';
import arrowIcon from '@/assets/images/arrow.svg';
import { parseHunterImageId, type HunterIcon } from '@/lib/map-layers';
import { brighten, grayscale, mapImagePixelRatio, rasterize } from '../map-images';

const ICONS: Record<HunterIcon, string> = { walking: walkingIcon, bike: bicycleIcon, car: carIcon, motorcycle: motorbikeIcon, phone: phoneIcon };

/** Same sizes as the former HTML marker (icon h-10, heading arrow w-7 h-7). */
const ICON_SIZE_PX = 40;
const ARROW_SIZE_PX = 28;

/** Map image id of the heading arrow. */
export const HUNTER_ARROW_IMAGE = 'hunter-arrow';

export interface HunterImages {
  pixelRatio: number;
  icons: Record<HunterIcon, ImageData>;
  arrow: ImageData;
}

let loading: Promise<HunterImages> | undefined;

/** The vehicle icons and the heading arrow, rasterised once for the screen's pixel ratio. */
export function loadHunterImages(): Promise<HunterImages> {
  loading ??= (async () => {
    const pixelRatio = mapImagePixelRatio();
    const [arrow, ...icons] = await Promise.all([rasterize(arrowIcon, ARROW_SIZE_PX, pixelRatio), ...Object.values(ICONS).map((url) => rasterize(url, ICON_SIZE_PX, pixelRatio))]);
    const keys = Object.keys(ICONS) as HunterIcon[];
    return { pixelRatio, arrow, icons: Object.fromEntries(keys.map((key, i) => [key, icons[i]])) as Record<HunterIcon, ImageData> };
  })();
  // A failed load (e.g. offline before the icons were cached) may be retried by the next caller
  loading.catch(() => (loading = undefined));
  return loading;
}

/**
 * Add a hunter image (the arrow, or a vehicle icon variant: grey when stale, brighter when hovered) when `id` is one.
 * Runs on `styleimagemissing`, so variants are made when first needed and again after a style switch.
 * @returns whether `id` is a hunter image
 */
export function addHunterImage(map: MaplibreMap, { pixelRatio, icons, arrow }: HunterImages, id: string): boolean {
  let image: ImageData;
  if (id === HUNTER_ARROW_IMAGE) {
    image = arrow;
  } else {
    const variant = parseHunterImageId(id);
    if (!variant) return false;
    image = icons[variant.icon];
    if (variant.stale) image = grayscale(image);
    if (variant.hover) image = brighten(image);
  }
  if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio });
  return true;
}
