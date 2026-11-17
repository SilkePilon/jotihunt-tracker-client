/** After the first base-map error, how long tiles may still show up before the map counts as unavailable */
export const MAP_ERROR_GRACE_MS = 4000;
/** Offline with nothing drawn yet for this long: unavailable (nothing errors while requests simply hang) */
export const MAP_OFFLINE_TIMEOUT_MS = 15_000;

/** What the map has done since its style was (re)set */
export interface MapLoadProgress {
  startedAt: number;
  /** First error from the base style (its sources, glyphs or sprite), null if none */
  firstErrorAt: number | null;
  /** A base-map tile loaded (from the network or the cache): the map shows something, never block it */
  hasContent: boolean;
}

export function startMapLoad(now: number): MapLoadProgress {
  return { startedAt: now, firstErrorAt: null, hasContent: false };
}

/** Whether to show "Kaart niet beschikbaar": the base map errored or (offline) never drew, and nothing rendered since */
export function isMapUnavailable(progress: MapLoadProgress, now: number, online: boolean): boolean {
  if (progress.hasContent) return false;
  if (progress.firstErrorAt !== null && now - progress.firstErrorAt >= MAP_ERROR_GRACE_MS) return true;
  return !online && now - progress.startedAt >= MAP_OFFLINE_TIMEOUT_MS;
}

/**
 * Whether an error/tile event is about the base map: one of the style's own sources, or (no source) the style, its
 * glyphs or sprite. Our overlay layers (hunters, fastfood, buildings) have their own error handling. Without a known
 * list of base sources (a style URL) every source counts.
 */
export function isBaseMapEvent(sourceId: string | undefined, baseSourceIds: ReadonlySet<string> | null): boolean {
  if (sourceId === undefined) return true;
  return baseSourceIds === null || baseSourceIds.has(sourceId);
}

interface StyleSourceLike {
  type?: string;
  url?: string;
  tiles?: string[];
}

/**
 * Identity of a map style's base sources: what has to load before it shows anything. A style URL is its own key;
 * a style object is keyed on its sources' ids and where their tiles come from, so a theme switch (only paint colours
 * change) keeps the key while switching to e.g. satellite gives a new one.
 */
export function mapStyleKey(style: string | { sources: Record<string, unknown> }): string {
  if (typeof style === 'string') return style;
  return Object.entries(style.sources)
    .map(([id, value]) => {
      const source = (value ?? {}) as StyleSourceLike;
      return `${id}=${source.url ?? source.tiles?.join(',') ?? source.type ?? ''}`;
    })
    .sort()
    .join('|');
}

/** MapUnavailableCard's heading: the desktop skip link focuses it when the map can't take focus */
export const MAP_UNAVAILABLE_HEADING_ID = 'map-unavailable-heading';
