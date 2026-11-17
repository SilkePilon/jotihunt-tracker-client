import type { RasterLayerSpecification, StyleSpecification } from 'maplibre-gl';
import { darkStreetsStyle } from '@/lib/map-style';
import { MapStyle } from '@/types/MapStyle';

// Free, token-less map sources. See docs in the migration report for why
// each was picked.
const OPENFREEMAP_LIBERTY_URL = 'https://tiles.openfreemap.org/styles/liberty';

const PDOK_BRT_TILES_URL =
  'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png';
const PDOK_LUCHTFOTO_TILES_URL =
  'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg';

const SATELLITE_RASTER_SOURCE_ID = 'pdok-luchtfoto';
const OUTDOORS_RASTER_ID = 'pdok-brt';

/**
 * Raster paint in the dark theme: the bright PDOK topo map (mostly white paper) is toned down and slightly muted so it
 * doesn't glare next to the dark UI; the aerial photos only lose their brightest highlights. Light theme: unchanged.
 */
export const DARK_RASTER_PAINT: Record<string, RasterLayerSpecification['paint']> = {
  [OUTDOORS_RASTER_ID]: { 'raster-brightness-max': 0.75, 'raster-saturation': -0.2, 'raster-contrast': 0.05 },
  [SATELLITE_RASTER_SOURCE_ID]: { 'raster-brightness-max': 0.85 },
};

/** `style` with the dark raster paint ({@link DARK_RASTER_PAINT}) on its raster layers; `style` itself when light. */
export function themeRasters(style: StyleSpecification, dark: boolean): StyleSpecification {
  if (!dark) return style;
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const paint = layer.type === 'raster' ? DARK_RASTER_PAINT[layer.id] : undefined;
      return paint && layer.type === 'raster' ? { ...layer, paint: { ...layer.paint, ...paint } } : layer;
    }),
  };
}

const OUTDOORS_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    [OUTDOORS_RASTER_ID]: {
      type: 'raster',
      tiles: [PDOK_BRT_TILES_URL],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Kaartgegevens © Kadaster',
    },
  },
  layers: [
    {
      id: OUTDOORS_RASTER_ID,
      type: 'raster',
      source: OUTDOORS_RASTER_ID,
    },
  ],
};

const SATELLITE_RASTER_ONLY_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    [SATELLITE_RASTER_SOURCE_ID]: {
      type: 'raster',
      tiles: [PDOK_LUCHTFOTO_TILES_URL],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Luchtfoto © Beeldmateriaal Nederland / PDOK',
    },
  },
  layers: [
    {
      id: SATELLITE_RASTER_SOURCE_ID,
      type: 'raster',
      source: SATELLITE_RASTER_SOURCE_ID,
    },
  ],
};

let hybridSatelliteStylePromise: Promise<StyleSpecification> | null = null;

/**
 * Builds the "Satelliet" style: PDOK aerial imagery with OpenFreeMap's
 * street/place labels drawn on top. Fetched at runtime because we only want
 * the label (symbol) layers, sources, glyphs and sprite from the liberty
 * style - not its base map layers. Falls back to raster-only satellite
 * imagery if the fetch fails (offline, CORS, upstream outage, ...).
 */
async function buildHybridSatelliteStyle(): Promise<StyleSpecification> {
  try {
    const response = await fetch(OPENFREEMAP_LIBERTY_URL);
    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status} while fetching liberty style`);
    }

    const liberty = (await response.json()) as StyleSpecification;
    const symbolLayers = (liberty.layers ?? []).filter((layer) => layer.type === 'symbol');

    return {
      version: 8,
      sources: {
        ...liberty.sources,
        ...SATELLITE_RASTER_ONLY_STYLE.sources,
      },
      glyphs: liberty.glyphs,
      sprite: liberty.sprite,
      layers: [
        {
          id: SATELLITE_RASTER_SOURCE_ID,
          type: 'raster',
          source: SATELLITE_RASTER_SOURCE_ID,
        },
        ...symbolLayers,
      ],
    };
  } catch (error) {
    console.warn(
      'Kon de hybride satellietstijl niet laden, val terug op alleen luchtfoto zonder labels.',
      error,
    );
    return SATELLITE_RASTER_ONLY_STYLE;
  }
}

/**
 * Lazily fetches (and caches) the hybrid satellite style. Consumers should
 * render {@link resolveStaticMapStyle} first for an immediate paint, then
 * swap in this style once it resolves.
 */
export function getHybridSatelliteStyle(): Promise<StyleSpecification> {
  if (!hybridSatelliteStylePromise) {
    hybridSatelliteStylePromise = buildHybridSatelliteStyle();
  }
  return hybridSatelliteStylePromise;
}

/**
 * Resolves a map style id to a style URL or inline style object that can be
 * rendered immediately (synchronously, no network round-trip on the critical
 * path). For 'satellite' this is the raster-only fallback; call
 * {@link getHybridSatelliteStyle} to upgrade to the hybrid style with labels (pass that through {@link themeRasters}).
 * @param dark Dark theme: the raster styles get {@link DARK_RASTER_PAINT}; streets is the darkened Liberty copy
 */
export function resolveStaticMapStyle(id: MapStyle, dark = false): string | StyleSpecification {
  switch (id) {
    case MapStyle.Streets:
      // Dark: the bundled Liberty copy with a darkening pass and the dark road shields; light: Liberty itself
      return dark ? darkStreetsStyle() : OPENFREEMAP_LIBERTY_URL;
    case MapStyle.Outdoors:
      return themeRasters(OUTDOORS_STYLE, dark);
    case MapStyle.Satellite:
      return themeRasters(SATELLITE_RASTER_ONLY_STYLE, dark);
  }
}

/**
 * Type guard used to validate values coming out of persisted storage
 * (localStorage). Old builds persisted mapbox://styles/... URLs; those must
 * not be handed to MapLibre.
 */
export function isMapStyle(value: unknown): value is MapStyle {
  return typeof value === 'string' && (Object.values(MapStyle) as string[]).includes(value);
}
