import { useEffect, useMemo, useState } from 'react';
import { Layer, Source, useMap, type FillLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import { isHomeTeam, useTeams } from '@/hooks/teams.hook';
import { useAreas } from '@/hooks/areas.hook';
import { useVisits } from '@/hooks/predictions.hook';
import { useIsMobile } from '@/hooks/media.hook';
import useLayersStore from '@/stores/layers.store';
import { TEAM_PINS_LAYER, teamCircles, teamPinFeatures } from '@/lib/map-layers';
import { featureId, useLayerInteractions, usePopupSelection } from './map-interactions';
import { addTeamPinImage } from './teams/team-pin-images';
import TeamPopup from './teams/TeamPopup';
import TeamTooltip from './teams/TeamTooltip';

/** On phones the bottom sheet covers the lower ~130px; aim a bit higher so the team isn't hidden behind it. */
const MOBILE_CENTER_OFFSET: [number, number] = [0, -65];

const TEAM_CIRCLES_SOURCE = 'team-circles';
const TEAM_CIRCLES_PAINT: FillLayerSpecification['paint'] = { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 };

// All group pins are one GeoJSON source + symbol layer instead of an HTML marker each
const TEAM_PINS_SOURCE = 'team-pins';
const TEAM_PINS_HOVER_LAYER = 'team-pins-hover';
const TEAM_PINS_LAYOUT: SymbolLayerSpecification['layout'] = { 'icon-image': ['get', 'icon'], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true };
// Like the former HTML pin's hover: brighter (the hover image) and 5% larger
const TEAM_PINS_HOVER_LAYOUT: SymbolLayerSpecification['layout'] = { ...TEAM_PINS_LAYOUT, 'icon-image': ['get', 'hoverIcon'], 'icon-size': 1.05 };
const TEAM_INTERACTIVE_LAYERS = [TEAM_PINS_LAYER];

export default function Teams() {
  const showGroupCircles = useLayersStore((state) => state.showGroupCircles);
  const map = useMap().current?.getMap();
  const isMobile = useIsMobile();
  const { teams, setTeamArea } = useTeams();
  const { isVisible } = useAreas();
  const { visits } = useVisits();

  const { active, open: openPopup, close: closePopup, dismiss: dismissPopup } = usePopupSelection<string>();
  const [hoveredId, setHoveredId] = useState<string>();
  // Derived from the current data, so the popup never shows a stale copy (and closes if the team disappears)
  const activeTeam = active ? teams?.find((team) => team._id === active.id) : undefined;
  // No hover tooltips while a group's popup is open
  const hoveredTeam = hoveredId !== undefined && !activeTeam ? teams?.find((team) => team._id === hoveredId) : undefined;

  const visibleTeams = useMemo(() => (teams ?? []).filter((team) => isVisible(team.area || '')), [teams, isVisible]);
  const visitedIds = useMemo(() => new Set((visits ?? []).filter((visit) => visit.state === 'visited').map((visit) => visit.teamApiId)), [visits]);
  // Our own group gets no circle (the home circle layer draws that one)
  const circles = useMemo(() => teamCircles(visibleTeams.filter((team) => !isHomeTeam(team))), [visibleTeams]);
  const pins = useMemo(() => teamPinFeatures(visibleTeams, visitedIds), [visibleTeams, visitedIds]);
  const hoverFilter = useMemo<SymbolLayerSpecification['filter']>(() => ['==', ['get', 'id'], hoveredId ?? ''], [hoveredId]);

  // Pin images are drawn when the map first needs them (and again after a style switch dropped them)
  useEffect(() => {
    if (!map) return;
    const onMissing = (e: { id: string }) => addTeamPinImage(map, e.id);
    map.on('styleimagemissing', onMissing);
    return () => {
      map.off('styleimagemissing', onMissing);
    };
  }, [map]);

  // Click → popup (clicking the selected group closes it again) and centre the group; hover → tooltip
  useLayerInteractions(map, TEAM_INTERACTIVE_LAYERS, {
    onClick: (feature) => {
      const id = featureId(feature);
      const team = typeof id === 'string' ? teams?.find((candidate) => candidate._id === id) : undefined;
      if (!team) return;
      setHoveredId(undefined);
      if (team._id === activeTeam?._id) {
        dismissPopup();
        return;
      }
      openPopup(team._id);
      map?.easeTo({
        center: [team.location.coordinates[0], team.location.coordinates[1]],
        offset: isMobile ? MOBILE_CENTER_OFFSET : [0, 0],
        duration: 600,
      });
    },
    onHover: (feature) => {
      const id = featureId(feature);
      setHoveredId(typeof id === 'string' ? id : undefined);
    },
  });

  return (
    <>
      {showGroupCircles && (
        <Source id={TEAM_CIRCLES_SOURCE} type="geojson" data={circles}>
          <Layer id="team-circles-fill" type="fill" source={TEAM_CIRCLES_SOURCE} paint={TEAM_CIRCLES_PAINT} />
        </Source>
      )}
      <Source id={TEAM_PINS_SOURCE} type="geojson" data={pins}>
        <Layer id={TEAM_PINS_LAYER} type="symbol" source={TEAM_PINS_SOURCE} layout={TEAM_PINS_LAYOUT} />
        <Layer id={TEAM_PINS_HOVER_LAYER} type="symbol" source={TEAM_PINS_SOURCE} layout={TEAM_PINS_HOVER_LAYOUT} filter={hoverFilter} />
      </Source>
      {hoveredTeam && <TeamTooltip team={hoveredTeam} />}
      {activeTeam && <TeamPopup key={active!.opened} team={activeTeam} onClose={closePopup} setTeamArea={setTeamArea} />}
    </>
  );
}
