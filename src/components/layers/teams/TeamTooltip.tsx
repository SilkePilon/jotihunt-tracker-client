import MapTooltip from '@/components/map/MapTooltip';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { Team } from '@/types/Team';

// Above the hovered group (28px circle, centred)
const TOOLTIP_OFFSET: [number, number] = [0, -20];

/** Hover tooltip of a group: area colour, name, area. */
export default function TeamTooltip({ team }: { team: Team }) {
  return (
    <MapTooltip
      longitude={team.location.coordinates[0]}
      latitude={team.location.coordinates[1]}
      offset={TOOLTIP_OFFSET}
      color={team.area ? getColorFromArea(team.area) : 'var(--map-muted)'}
      title={team.name}
      meta={team.area ? capitalizeFirstLetter(team.area) : undefined}
    />
  );
}
