/**
 * Service-worker caching of the base map's third-party hosts (vite.config.ts → workbox runtimeCaching), so the map
 * still draws where the phone has been when the connection drops in a wood. Our own /api (3D buildings, fastfood,
 * everything else) is never cached here: the app's data must be live.
 *
 * Cross-origin patterns must match the URL from its start (workbox ignores mid-URL matches for other origins).
 */

/** OpenFreeMap glyph ranges and sprites: versioned paths that never change, so served from the cache first */
export const OPENFREEMAP_STATIC = /^https:\/\/tiles\.openfreemap\.org\/(fonts|sprites)\//;
/** OpenFreeMap vector tiles, TileJSON and the shaded-relief raster */
export const OPENFREEMAP_TILES = /^https:\/\/tiles\.openfreemap\.org\/(planet|natural_earth)(\/|$)/;
/** PDOK raster tiles (Satelliet luchtfoto, Buitenkaart BRT) */
export const PDOK_TILES = /^https:\/\/service\.pdok\.nl\/.+\/wmts\//;

const DAY_S = 24 * 60 * 60;
/** Opaque cross-origin responses (0) as well as plain 200s; never a 404 or a server error */
const cacheableResponse = { statuses: [0, 200] };

/** Workbox `runtimeCaching` entries, kept free of workbox types so the app's tsconfig can test the patterns */
export const MAP_RUNTIME_CACHING = [
  {
    urlPattern: OPENFREEMAP_STATIC,
    handler: 'CacheFirst' as const,
    options: { cacheName: 'map-static', expiration: { maxEntries: 500, maxAgeSeconds: 30 * DAY_S, purgeOnQuotaError: true }, cacheableResponse },
  },
  {
    urlPattern: OPENFREEMAP_TILES,
    handler: 'StaleWhileRevalidate' as const,
    options: { cacheName: 'map-tiles', expiration: { maxEntries: 3000, maxAgeSeconds: 7 * DAY_S, purgeOnQuotaError: true }, cacheableResponse },
  },
  {
    urlPattern: PDOK_TILES,
    handler: 'StaleWhileRevalidate' as const,
    options: { cacheName: 'map-pdok', expiration: { maxEntries: 3000, maxAgeSeconds: 7 * DAY_S, purgeOnQuotaError: true }, cacheableResponse },
  },
];
