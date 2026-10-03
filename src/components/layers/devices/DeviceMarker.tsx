import { memo, useCallback } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import arrow from '@/assets/images/arrow.svg';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useHoverTooltip } from '../markers/useHoverTooltip';

const MARKER_STYLE = { cursor: 'pointer' };

interface DeviceMarkerProps {
  deviceId: number;
  deviceName: string;
  longitude: number;
  latitude: number;
  /** Heading in degrees */
  course: number;
  fixTime: string;
  icon: string;
  /** Moving with a recent fix: show the heading arrow */
  moving: boolean;
  /** No fix in the last five minutes: greyed out */
  stale: boolean;
  /** Any device popup is open: no hover tooltips then */
  tooltipsDisabled: boolean;
  onSelect: (deviceId: number) => void;
}

/**
 * CSS for the heading arrow: placed 30px from the device towards the course and rotated along it.
 * For example, with a course of 45 (P = device position):
 *
 *         *
 *        /
 *       P
 */
function coursePositionStyle(course: number) {
  const distance = 30;
  const translateX = Math.sin((course * Math.PI) / 180) * distance;
  const translateY = -Math.cos((course * Math.PI) / 180) * distance;
  return {
    transform: `translate(${translateX}px, ${translateY}px) rotate(${course}deg)`,
    transformOrigin: 'center center',
  };
}

/** Map icon for a hunter's tracker, with its own hover tooltip so hovering only re-renders this icon. */
function DeviceMarker({ deviceId, deviceName, longitude, latitude, course, fixTime, icon, moving, stale, tooltipsDisabled, onSelect }: DeviceMarkerProps) {
  const tooltip = useHoverTooltip(tooltipsDisabled);

  const handleClick = useCallback(
    (e: { originalEvent: MouseEvent }) => {
      e.originalEvent.stopPropagation();
      onSelect(deviceId);
    },
    [deviceId, onSelect],
  );

  return (
    <Marker longitude={longitude} latitude={latitude} anchor="center" onClick={handleClick} style={MARKER_STYLE} className={tooltip.open ? 'z-20' : 'z-10'}>
      <Tooltip delayDuration={0} open={tooltip.open} onOpenChange={tooltip.onOpenChange}>
        <TooltipTrigger asChild>
          <div className={cn('h-10 hover:brightness-125 hover:scale-105 transition-all ease-in-out', stale && 'grayscale')}>
            {moving && (
              <div className="absolute w-10 h-10 transform flex items-center justify-center" style={coursePositionStyle(course)}>
                <img src={arrow} alt="arrow" className="w-7 h-7" />
              </div>
            )}
            <img alt="device" src={icon} className="h-10" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="flex gap-2 items-center">
          <span className="text-sm font-medium">{deviceName}</span>
          <Badge>{formatDistanceToNow(fixTime, { locale: nl, addSuffix: true })}</Badge>
        </TooltipContent>
      </Tooltip>
    </Marker>
  );
}

export default memo(DeviceMarker);
