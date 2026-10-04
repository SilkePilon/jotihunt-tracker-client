import MapTooltip from '@/components/map/MapTooltip';
import { Badge } from '@/components/ui/badge';
import { getColorFromArea } from '@/lib/utils';
import type { Team } from '@/types/Team';

// Above the hovered pin (34.8px high, anchored at its tip), where the Radix tooltip used to be
const TOOLTIP_OFFSET: [number, number] = [0, -46];

/** Hover tooltip of a group pin (same content and look as the former per-pin Radix tooltip). */
export default function TeamTooltip({ team }: { team: Team }) {
  return (
    <MapTooltip longitude={team.location.coordinates[0]} latitude={team.location.coordinates[1]} offset={TOOLTIP_OFFSET}>
      <span className="text-sm font-medium">{team.name}</span>
      {team.area && (
        <Badge className="text-white border-0" style={{ backgroundColor: getColorFromArea(team.area) }}>
          {team.area}
        </Badge>
      )}
    </MapTooltip>
  );
}
