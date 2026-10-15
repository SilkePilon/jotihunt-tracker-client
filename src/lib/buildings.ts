import type { ExpressionSpecification } from 'maplibre-gl';
import { MapStyle } from '@/types/MapStyle';
import { mapPalette, MAP_SEED } from '@/lib/map-style/material-style';

/** 3D buildings from 3DBAG, served by our server as z15 vector tiles (layer "buildings", property h in metres). */
export const BUILDINGS_SOURCE = 'buildings3d';
export const BUILDINGS_LAYER = 'buildings-3d';
export const BUILDINGS_TILE_LAYER = 'buildings';
export const BUILDINGS_ZOOM = 15;
export const BUILDINGS_ATTRIBUTION = '<a href="https://docs.3dbag.nl/en/copyright/" target="_blank" rel="noopener">© 3DBAG by tudelft3d and 3DGI</a>';
/** Camera pitch when the toggle tilts a flat map, and what counts as flat */
export const BUILDINGS_TILT = 50;
export const FLAT_PITCH = 20;
export const BUILDINGS_OPACITY = 0.9;
export const BUILDINGS_FADE_MS = 400;
/** Height (m) where the Material ramp reaches its darkest/lightest tone */
const RAMP_TOP_M = 30;
const GREY_LIGHT = '#d6d6d6';
const GREY_DARK = '#5a5a5a';

/**
 * The building source loads its tiles through this MapLibre protocol instead of plain URLs: past z15 MapLibre requests
 * the same z15 tile once per overzoomed child tile, so the protocol handler shares one download per tile.
 */
export const BUILDINGS_PROTOCOL = 'jhbuildings';
export const BUILDINGS_TILES = `${BUILDINGS_PROTOCOL}://{z}/{x}/{y}`;
/** Resolved tiles kept for overzoomed children and panning back (in-flight ones count too) */
export const BUILDINGS_CACHE_SIZE = 32;

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/** `jhbuildings://15/1/2` → tile coordinates; anything else: undefined */
export function parseBuildingsUrl(url: string): TileCoord | undefined {
  const match = new RegExp(`^${BUILDINGS_PROTOCOL}://(\\d+)/(\\d+)/(\\d+)$`).exec(url);
  return match ? { z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) } : undefined;
}

export const buildingsApiUrl = (apiBase: string, { z, x, y }: TileCoord) => `${apiBase}/buildings/${z}/${x}/${y}.pbf`;

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** One tile from our API: 204 is an empty tile, any other non-OK status rejects (MapLibre marks the tile errored). */
export async function fetchBuildingTile(url: string, authHeader: string, fetchFn: FetchFn = fetch): Promise<ArrayBuffer> {
  const response = await fetchFn(url, { headers: { Authorization: authHeader } });
  if (response.status === 204) return new ArrayBuffer(0);
  if (!response.ok) throw new Error(`Building tile ${url}: HTTP ${response.status}`);
  return response.arrayBuffer();
}

/**
 * Promise cache per tile key, least recently used out beyond `capacity`. Callers asking for a tile that's in flight
 * get the same promise; a rejected promise is dropped, so the next call retries.
 */
export function createTileCache(load: (key: string) => Promise<ArrayBuffer>, capacity = BUILDINGS_CACHE_SIZE) {
  // Map keeps insertion order: the first key is the least recently used
  const entries = new Map<string, Promise<ArrayBuffer>>();
  return {
    get(key: string): Promise<ArrayBuffer> {
      const hit = entries.get(key);
      if (hit) {
        entries.delete(key);
        entries.set(key, hit);
        return hit;
      }
      const promise = load(key);
      entries.set(key, promise);
      promise.catch(() => {
        if (entries.get(key) === promise) entries.delete(key);
      });
      while (entries.size > capacity) entries.delete(entries.keys().next().value!);
      return promise;
    },
  };
}

/** '' is the Material map: palette tones by height (follows the theme); the other basemaps get a fixed grey. */
export function buildingColor(mapStyle: MapStyle | '', dark: boolean): string | ExpressionSpecification {
  if (!mapStyle) {
    const p = mapPalette(MAP_SEED, dark);
    return ['interpolate', ['linear'], ['get', 'h'], 0, p.surfaceContainerHigh, RAMP_TOP_M, p.surfaceContainerHighest];
  }
  return mapStyle === MapStyle.Dark || mapStyle === MapStyle.Satellite ? GREY_DARK : GREY_LIGHT;
}

/** The buildings go below the style's labels; a raster style without labels: undefined (on top of the style). */
export function firstSymbolLayerId(layers: { id: string; type: string }[]): string | undefined {
  return layers.find((layer) => layer.type === 'symbol')?.id;
}

export const BUILDINGS_ADMIN_URL = '/admin/buildings';
export const PREFETCH_RADII = [5, 10, 20] as const;
const RUNNING_POLL_MS = 1000;
const IDLE_POLL_MS = 30_000;

export interface BuildingsJob {
  kind: 'refresh' | 'prefetch';
  done: number;
  total: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface BuildingsStatus {
  tiles: number;
  buildings: number;
  bytes: number;
  oldest: string | null;
  newest: string | null;
  job: BuildingsJob | null;
}

export const jobRunning = (status?: BuildingsStatus) => !!status?.job && status.job.finishedAt === null;

export const buildingsRefreshInterval = (status?: BuildingsStatus) => (jobRunning(status) ? RUNNING_POLL_MS : IDLE_POLL_MS);

export function formatMegabytes(bytes: number): string {
  if (!bytes) return '0 MB';
  return `${(bytes / 1_000_000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} MB`;
}

export const JOB_NAMES: Record<BuildingsJob['kind'], string> = { refresh: 'Vernieuwen', prefetch: 'Vooraf laden' };

export function jobLine(job: BuildingsJob): string {
  if (job.finishedAt !== null) return `${JOB_NAMES[job.kind]} klaar: ${job.done - job.failed} van ${job.total} tegels gelukt`;
  const failed = job.failed ? ` (${job.failed} mislukt)` : '';
  return `${JOB_NAMES[job.kind]}… ${job.done} van ${job.total} tegels${failed}`;
}
