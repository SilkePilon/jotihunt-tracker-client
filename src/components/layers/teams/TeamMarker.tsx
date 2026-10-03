import { memo, useCallback } from 'react';
import { Marker, type MarkerEvent } from 'react-map-gl/maplibre';
import { CheckIcon } from 'lucide-react';
import MapMarker from '../../map/MapMarker';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getColorFromArea } from '@/lib/utils';
import type { Team } from '@/types/Team';
import { useHoverTooltip } from '../markers/useHoverTooltip';

const MARKER_STYLE = { cursor: 'pointer' };

interface TeamMarkerProps {
  team: Team;
  visited: boolean;
  /** This team's popup is open (a click closes it again) */
  selected: boolean;
  /** Any team popup is open: no hover tooltips then */
  tooltipsDisabled: boolean;
  onSelect: (team: Team) => void;
  onDeselect: () => void;
}

/** Map pin for a group, with its own hover tooltip so hovering only re-renders this pin. */
function TeamMarker({ team, visited, selected, tooltipsDisabled, onSelect, onDeselect }: TeamMarkerProps) {
  const tooltip = useHoverTooltip(tooltipsDisabled);
  const color = getColorFromArea(team.area || '');

  const handleClick = useCallback(
    (e: MarkerEvent<MouseEvent>) => {
      e.originalEvent.stopPropagation();
      if (selected) onDeselect();
      else onSelect(team);
    },
    [selected, team, onSelect, onDeselect],
  );

  return (
    <Marker longitude={team.location.coordinates[0]} latitude={team.location.coordinates[1]} anchor="bottom" onClick={handleClick} style={MARKER_STYLE} className={tooltip.open ? 'z-20' : undefined}>
      <Tooltip delayDuration={0} open={tooltip.open} onOpenChange={tooltip.onOpenChange}>
        <TooltipTrigger asChild>
          <div data-team-api-id={team.apiId} className="relative hover:brightness-125 hover:scale-105 transition-all ease-in-out">
            <MapMarker color={color} />
            {visited && (
              <span aria-label="Bezocht" className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-green-600 text-white ring-2 ring-white">
                <CheckIcon className="size-2.5" strokeWidth={3} />
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="flex gap-2 items-center">
          <span className="text-sm font-medium">{team.name}</span>
          {team.area && (
            <Badge className="text-white border-0" style={{ backgroundColor: color }}>
              {team.area}
            </Badge>
          )}
        </TooltipContent>
      </Tooltip>
    </Marker>
  );
}

export default memo(TeamMarker);
