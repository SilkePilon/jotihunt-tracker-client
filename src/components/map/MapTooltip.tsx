import type { ReactNode } from 'react';
import { Marker } from 'react-map-gl/maplibre';

// Never catches the pointer itself
const TOOLTIP_STYLE = { pointerEvents: 'none', zIndex: 40 } as const;

/**
 * Hover tooltip above a canvas map marker, with the look of the app's Radix tooltips (font-sans: the map container
 * sets MapLibre's own font).
 * @param offset From the marker's position to the tooltip's bottom centre (px)
 */
export default function MapTooltip({ longitude, latitude, offset, children }: { longitude: number; latitude: number; offset: [number, number]; children: ReactNode }) {
  return (
    <Marker longitude={longitude} latitude={latitude} anchor="bottom" offset={offset} style={TOOLTIP_STYLE}>
      <div className="relative flex w-fit items-center gap-2 rounded-md border bg-popover px-3 py-1.5 font-sans text-xs text-popover-foreground shadow-md">
        {children}
        <span className="absolute left-1/2 top-full size-2.5 -translate-x-1/2 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-popover" />
      </div>
    </Marker>
  );
}
