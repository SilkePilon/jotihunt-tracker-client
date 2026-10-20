import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type AreaGeometry = Polygon | MultiPolygon;

/** One fox's reachable area since its last spot (GET /routes/reach). */
export interface AreaReach {
  area: string;
  fix: { id: string; type: 'hint' | 'hunt'; at: string; lng: number; lat: number };
  speedKmh: number;
  measured: boolean;
  legs: number;
  distanceM: number;
  capped: boolean;
  night: boolean;
  estimate: boolean;
  polygon: AreaGeometry;
  cone: { teamApiId: number; name: string; bearing: number; distanceM: number; polygon: AreaGeometry } | null;
}

export interface ReachResponse { enabled: boolean; areas: AreaReach[] }

export interface ReachShapeProps { area: string; role: 'area' | 'cone'; color: string }

export const REACH_SOURCE = 'fox-reach';
export const REACH_FILL_LAYER = 'fox-reach-fill';
export const REACH_CONE_LAYER = 'fox-reach-cone';
export const REACH_LINE_LAYER = 'fox-reach-line';

/** "52 min", from an hour "1u05m". */
export function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}u${String(minutes % 60).padStart(2, '0')}m`;
}

/** "Alpha · 52 min · 4,6 km/u"; "~5 km/u" when the speed is a default, "3u+" once the area stopped growing. */
export function reachChipText(reach: AreaReach, now: number): string {
  const name = reach.area.charAt(0).toUpperCase() + reach.area.slice(1);
  const elapsed = reach.capped ? '3u+' : formatElapsed(now - Date.parse(reach.fix.at));
  const speed = `${reach.measured ? '' : '~'}${reach.speedKmh.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} km/u`;
  return `${name} · ${elapsed} · ${speed}`;
}

/** The areas and cones as one collection; the layers filter on `role`. */
export function reachFeatures(areas: AreaReach[], colorFor: (area: string) => string): FeatureCollection<AreaGeometry, ReachShapeProps> {
  const features: Feature<AreaGeometry, ReachShapeProps>[] = [];
  for (const reach of areas) {
    const color = colorFor(reach.area);
    features.push({ type: 'Feature', geometry: reach.polygon, properties: { area: reach.area, role: 'area', color } });
    if (reach.cone) features.push({ type: 'Feature', geometry: reach.cone.polygon, properties: { area: reach.area, role: 'cone', color } });
  }
  return { type: 'FeatureCollection', features };
}
