import { useMemo, useRef } from 'react';
import { Marker, useMap } from 'react-map-gl/maplibre';
import { offsetScaleAt, scaleOffset, type OffsetScale } from '@/lib/zoom-scale';
import { POPUP_FADE_MS, TOOLTIP_LINGER_MS, useMapElementFade } from './map-fade';

// Never catches the pointer itself
const TOOLTIP_STYLE = { pointerEvents: 'none', zIndex: 40 } as const;
const ENTER = { duration: POPUP_FADE_MS };
const LEAVE = { duration: TOOLTIP_LINGER_MS };

interface MapTooltipProps {
  longitude: number;
  latitude: number;
  /** From the marker's position to the tooltip's bottom centre (px) */
  offset: [number, number];
  /** How the offset follows the zoom (see MapPopup's offsetScale) */
  offsetScale?: OffsetScale;
  /** The marker's colour, as a dot before the title */
  color: string;
  title: string;
  /** Muted text after the title */
  meta?: string;
}

/**
 * One-line hover tooltip above a canvas map marker: colour dot, bold title, muted meta. Fades in; after the pointer
 * leaves, the last one lingers briefly while it fades out (see map-fade.ts).
 */
export default function MapTooltip({ longitude, latitude, offset, offsetScale = 'none', color, title, meta }: MapTooltipProps) {
  const { current: map } = useMap();
  const content = useRef<HTMLDivElement>(null);
  useMapElementFade(content, '.maplibregl-marker', ENTER, LEAVE, () => undefined);
  const zoom = map?.getZoom() ?? Infinity;
  const factor = offsetScaleAt(offsetScale, zoom);
  const scaledOffset = useMemo(() => scaleOffset(offset, factor), [offset, factor]);
  return (
    <Marker longitude={longitude} latitude={latitude} anchor="bottom" offset={scaledOffset} style={TOOLTIP_STYLE}>
      <div ref={content} className="relative flex w-fit items-center gap-[7px] rounded-md bg-(--map-surface) px-2.5 py-1.5 font-(family-name:--map-font) text-caption whitespace-nowrap text-(--map-on-surface) shadow-(--shadow-tooltip)">
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="font-semibold">{title}</span>
        {meta && <span className="text-(--map-muted) tabular-nums">{meta}</span>}
        <span className="absolute top-full left-1/2 size-2 -translate-x-1/2 -translate-y-1 rotate-45 rounded-[1px] bg-(--map-surface)" />
      </div>
    </Marker>
  );
}
