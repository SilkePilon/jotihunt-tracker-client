import { useCallback, useMemo, useState } from 'react';
import { Layer, Source, useMap, type FillLayerSpecification } from 'react-map-gl/maplibre';
import { isHomeTeam, useTeams } from '@/hooks/teams.hook';
import { useAreas } from '@/hooks/areas.hook';
import { useVisits } from '@/hooks/predictions.hook';
import { useIsMobile } from '@/hooks/media.hook';
import useLayersStore from '@/stores/layers.store';
import { teamCircles } from '@/lib/map-layers';
import type { Team } from '@/types/Team';
import TeamMarker from './teams/TeamMarker';
import TeamPopup from './teams/TeamPopup';

/** On phones the bottom sheet covers the lower ~130px; aim a bit higher so the team isn't hidden behind it. */
const MOBILE_CENTER_OFFSET: [number, number] = [0, -65];

const TEAM_CIRCLES_SOURCE = 'team-circles';
const TEAM_CIRCLES_PAINT: FillLayerSpecification['paint'] = { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 };

export default function Teams() {
  const showGroupCircles = useLayersStore((state) => state.showGroupCircles);
  const { current: map } = useMap();
  const isMobile = useIsMobile();
  const { teams, setTeamArea } = useTeams();
  const { isVisible } = useAreas();
  const { visits } = useVisits();

  const [activeTeamId, setActiveTeamId] = useState<string>();
  // Derived from the current data, so the popup never shows a stale copy (and closes if the team disappears)
  const activeTeam = activeTeamId !== undefined ? teams?.find((team) => team._id === activeTeamId) : undefined;

  const visibleTeams = useMemo(() => (teams ?? []).filter((team) => isVisible(team.area || '')), [teams, isVisible]);
  const visitedIds = useMemo(() => new Set((visits ?? []).filter((visit) => visit.state === 'visited').map((visit) => visit.teamApiId)), [visits]);
  // Our own group gets no circle (the home circle layer draws that one)
  const circles = useMemo(() => teamCircles(visibleTeams.filter((team) => !isHomeTeam(team))), [visibleTeams]);

  const selectTeam = useCallback(
    (team: Team) => {
      setActiveTeamId(team._id);
      map?.easeTo({
        center: [team.location.coordinates[0], team.location.coordinates[1]],
        offset: isMobile ? MOBILE_CENTER_OFFSET : [0, 0],
        duration: 600,
      });
    },
    [map, isMobile],
  );
  const deselectTeam = useCallback(() => setActiveTeamId(undefined), []);

  return (
    <>
      {showGroupCircles && (
        <Source id={TEAM_CIRCLES_SOURCE} type="geojson" data={circles}>
          <Layer id="team-circles-fill" type="fill" source={TEAM_CIRCLES_SOURCE} paint={TEAM_CIRCLES_PAINT} />
        </Source>
      )}
      {visibleTeams.map((team) => (
        <TeamMarker
          key={team._id}
          team={team}
          visited={visitedIds.has(team.apiId)}
          selected={team._id === activeTeam?._id}
          tooltipsDisabled={activeTeam !== undefined}
          onSelect={selectTeam}
          onDeselect={deselectTeam}
        />
      ))}
      {activeTeam && <TeamPopup team={activeTeam} onClose={deselectTeam} setTeamArea={setTeamArea} />}
    </>
  );
}
