import MapTooltip from '@/components/map/MapTooltip';
import { BRAND_DOT, BRAND_LABEL, fastfoodStatus } from '@/lib/fastfood';
import type { FastfoodRestaurant } from '@/types/Fastfood';

// Above the hovered tile (28px, centred)
const TOOLTIP_OFFSET: [number, number] = [0, -20];

/** Hover tooltip of a restaurant: brand dot, "McDonald's Arnhem Rijnstraat", status ("open tot 01:30"). */
export default function FastFoodTooltip({ restaurant, nowMs }: { restaurant: FastfoodRestaurant; nowMs: number }) {
  const [lng, lat] = restaurant.location.coordinates;
  return (
    <MapTooltip
      longitude={lng}
      latitude={lat}
      offset={TOOLTIP_OFFSET}
      color={BRAND_DOT[restaurant.brand]}
      title={[BRAND_LABEL[restaurant.brand], restaurant.branch].filter(Boolean).join(' ')}
      meta={fastfoodStatus(restaurant.intervals, nowMs).short}
    />
  );
}
