import { useMemo } from 'react';
import { Layer, Source, type FillLayerSpecification } from 'react-map-gl/maplibre';
import { useHomeTeam } from '@/hooks/teams.hook';
import { createCircle, createWindSector } from '@/lib/utils';
import { useCounterHunt } from '@/hooks/counter-hunt.hook';

const HOME_RADIUS_M = 500;
// 45-degree sector, counter hunts can be up to 45 degrees (probably)
const WIND_ANGLE_RANGE = 45;

const HOME_SOURCE = 'circle-source-home';
const HOME_PAINT: FillLayerSpecification['paint'] = {
  'fill-color': 'hsla(256, 90%, 61%, 0.2)',
  'fill-outline-color': 'hsla(256, 90%, 61%, 0.5)',
};

/**
 * Circle around our own group (the "Tegenhunt cirkel" layer), or the wind sector while the server reports an active
 * tegenhunt with a known direction. The sector shows even with the circle layer off: everyone must see it.
 */
export default function HomeCircle({ showCircle }: { showCircle: boolean }) {
  const homeTeam = useHomeTeam();
  const { view } = useCounterHunt();
  // The server keeps `active` for 30 minutes; the sector goes when the next poll says it ended
  const direction = view?.active ? view.direction : null;

  const lng = homeTeam?.location.coordinates[0];
  const lat = homeTeam?.location.coordinates[1];
  const data = useMemo(() => {
    if (lng === undefined || lat === undefined) return undefined;
    if (direction !== null) return createWindSector(lng, lat, HOME_RADIUS_M, direction, WIND_ANGLE_RANGE);
    return showCircle ? createCircle(lng, lat, HOME_RADIUS_M) : undefined;
  }, [lng, lat, showCircle, direction]);

  if (!data) return null;

  return (
    <Source id={HOME_SOURCE} type="geojson" data={data}>
      <Layer id="circle-layer-home" type="fill" source={HOME_SOURCE} paint={HOME_PAINT} />
    </Source>
  );
}
