import { booleanPointInPolygon } from '@turf/turf';
import type { Feature, MultiPolygon } from 'geojson';
import boundary from './nl-boundary.json';

// PDOK "landgebied" (land + inland and territorial water), simplified to roughly 150 m
const NETHERLANDS = boundary as Feature<MultiPolygon>;

/**
 * Whether a WGS84 coordinate lies within the Netherlands.
 * @param lng Longitude
 * @param lat Latitude
 * @returns True when the point is inside the Dutch border
 */
export function isInNetherlands(lng: number, lat: number): boolean {
  return booleanPointInPolygon([lng, lat], NETHERLANDS);
}
