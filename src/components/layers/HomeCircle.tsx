import { useMemo } from 'react';
import { Layer, Source, type FillLayerSpecification } from 'react-map-gl/maplibre';
import { useHomeTeam } from '@/hooks/teams.hook';
import { createCircle, createWindSector } from '@/lib/utils';
import useCounterHuntStore from '@/stores/counterhunt.store';

const HOME_RADIUS_M = 500;
// 45-degree sector, counter hunts can be up to 45 degrees (probably)
const WIND_ANGLE_RANGE = 45;

const HOME_SOURCE = 'circle-source-home';
const HOME_PAINT: FillLayerSpecification['paint'] = {
  'fill-color': 'hsla(256, 90%, 61%, 0.2)',
  'fill-outline-color': 'hsla(256, 90%, 61%, 0.5)',
};

/** Circle around our own group, or the counter-hunt wind sector while that is shown. */
export default function HomeCircle() {
  const homeTeam = useHomeTeam();
  const counterHuntVisible = useCounterHuntStore((state) => state.visible);
  const direction = useCounterHuntStore((state) => state.direction);

  const lng = homeTeam?.location.coordinates[0];
  const lat = homeTeam?.location.coordinates[1];
  const data = useMemo(() => {
    if (lng === undefined || lat === undefined) return undefined;
    return counterHuntVisible ? createWindSector(lng, lat, HOME_RADIUS_M, direction, WIND_ANGLE_RANGE) : createCircle(lng, lat, HOME_RADIUS_M);
  }, [lng, lat, counterHuntVisible, direction]);

  if (!data) return null;

  return (
    <Source id={HOME_SOURCE} type="geojson" data={data}>
      <Layer id="circle-layer-home" type="fill" source={HOME_SOURCE} paint={HOME_PAINT} />
    </Source>
  );
}
