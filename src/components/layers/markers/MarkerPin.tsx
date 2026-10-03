import { memo, useCallback } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMarkerTime, markerIcon } from '@/lib/markers';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { MarkerType } from '@/types/MarkerType';
import { useHoverTooltip } from './useHoverTooltip';

const MARKER_STYLE = { cursor: 'pointer' };

interface MarkerPinProps {
  id: string;
  longitude: number;
  latitude: number;
  type: MarkerType;
  area: string;
  /** Epoch milliseconds */
  time: number;
  /** Any marker popup is open: no hover tooltips then */
  tooltipsDisabled: boolean;
  onSelect: (id: string) => void;
}

/** Fox icon for a hint/hunt/spot, with its own hover tooltip so hovering only re-renders this pin. */
function MarkerPin({ id, longitude, latitude, type, area, time, tooltipsDisabled, onSelect }: MarkerPinProps) {
  const tooltip = useHoverTooltip(tooltipsDisabled);

  const handleClick = useCallback(
    (e: { originalEvent: MouseEvent }) => {
      e.originalEvent.stopPropagation();
      onSelect(id);
    },
    [id, onSelect],
  );

  return (
    <Marker longitude={longitude} latitude={latitude} anchor="center" onClick={handleClick} style={MARKER_STYLE} className={tooltip.open ? 'z-20' : undefined}>
      <Tooltip delayDuration={0} open={tooltip.open} onOpenChange={tooltip.onOpenChange}>
        <TooltipTrigger asChild>
          <div className="hover:brightness-125 hover:scale-105 transition-all ease-in-out">
            <img alt="marker" src={markerIcon(type)} className="h-7" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="flex gap-2 items-center">
          <div>
            {capitalizeFirstLetter(type)} - {formatMarkerTime(time)}
          </div>
          <Badge className="text-white border-0" style={{ backgroundColor: getColorFromArea(area) }}>
            {capitalizeFirstLetter(area)}
          </Badge>
        </TooltipContent>
      </Tooltip>
    </Marker>
  );
}

export default memo(MarkerPin);
