import proj4 from 'proj4';

/**
 * Rijksdriehoeksmeting (RD New, EPSG:28992). Importing this module registers the 'RD' projection globally, so plain
 * `proj4('WGS84', 'RD', ...)` calls elsewhere work too once it has been imported (main.tsx does so at startup).
 */
proj4.defs(
  'RD',
  '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs',
);

/** Bounds of the RD grid over the Netherlands (metres): x 0–290 km, y 290–630 km. */
export const RD_BOUNDS = { minX: 0, maxX: 290_000, minY: 290_000, maxY: 630_000 } as const;

/** WGS84 longitude/latitude to RD metres (unrounded). */
export function toRD(lng: number, lat: number): { x: number; y: number } {
  const [x, y] = proj4('WGS84', 'RD', [lng, lat]);
  return { x, y };
}

/** RD metres to WGS84 [longitude, latitude]. */
export function fromRD(x: number, y: number): [number, number] {
  const [lng, lat] = proj4('RD', 'WGS84', [x, y]);
  return [lng, lat];
}

/** Whether x/y lie within the RD grid over the Netherlands (inclusive bounds). */
export function isPlausibleRD(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && x >= RD_BOUNDS.minX && x <= RD_BOUNDS.maxX && y >= RD_BOUNDS.minY && y <= RD_BOUNDS.maxY;
}
