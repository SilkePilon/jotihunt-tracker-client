import { Marker } from 'react-map-gl/maplibre';

// Never catches the pointer itself
const TOOLTIP_STYLE = { pointerEvents: 'none', zIndex: 40 } as const;

interface MapTooltipProps {
  longitude: number;
  latitude: number;
  /** From the marker's position to the tooltip's bottom centre (px) */
  offset: [number, number];
  /** The marker's colour, as a dot before the title */
  color: string;
  title: string;
  /** Muted text after the title */
  meta?: string;
}

/** One-line hover tooltip above a canvas map marker: colour dot, bold title, muted meta. */
export default function MapTooltip({ longitude, latitude, offset, color, title, meta }: MapTooltipProps) {
  return (
    <Marker longitude={longitude} latitude={latitude} anchor="bottom" offset={offset} style={TOOLTIP_STYLE}>
      <div className="relative flex w-fit items-center gap-[7px] rounded-[10px] bg-(--map-surface) px-2.5 py-1.5 font-(family-name:--map-font) text-[12.5px] whitespace-nowrap text-(--map-on-surface) shadow-[0_0_0_1px_var(--map-hairline),0_4px_12px_rgb(0_0_0/0.5)]">
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="font-semibold">{title}</span>
        {meta && <span className="text-(--map-muted)">{meta}</span>}
        <span className="absolute top-full left-1/2 size-2 -translate-x-1/2 -translate-y-1 rotate-45 rounded-[1px] bg-(--map-surface)" />
      </div>
    </Marker>
  );
}
