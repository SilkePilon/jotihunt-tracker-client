import { addProtocol } from 'maplibre-gl';
import { BUILDINGS_PROTOCOL, buildingsApiUrl, createTileCache, fetchBuildingTile, parseBuildingsUrl } from '@/lib/buildings';

// The current Authorization header; Map.tsx keeps it up to date
let authHeader = '';
export const setBuildingsAuthHeader = (header: string) => {
  authHeader = header;
};

const cache = createTileCache((key) => {
  const [z, x, y] = key.split('/').map(Number);
  return fetchBuildingTile(buildingsApiUrl(import.meta.env.API_BASE_URL, { z, x, y }), authHeader);
});

let registered = false;

/**
 * Registers the `jhbuildings://z/x/y` protocol once: each tile is downloaded once from our API (with the auth header)
 * and shared by every overzoomed child tile that asks for it. The abort signal is ignored, as other tiles may be
 * waiting on the same download.
 */
export function registerBuildingsProtocol() {
  if (registered) return;
  registered = true;
  addProtocol(BUILDINGS_PROTOCOL, async (params) => {
    const tile = parseBuildingsUrl(params.url);
    if (!tile) throw new Error(`Bad building tile url ${params.url}`);
    // A copy per caller: MapLibre transfers the buffer to its worker, which detaches it
    return { data: (await cache.get(`${tile.z}/${tile.x}/${tile.y}`)).slice(0) };
  });
}
