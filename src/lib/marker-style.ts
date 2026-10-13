/**
 * Map marker styling shared with the Android app (`MarkerIconFactory`, `IconKey`, `MapPalette`): which shape, colours
 * and glyph each marker gets, and the map image ids that carry all of that. Pure, so it is unit tested; the canvas
 * drawing lives in `components/layers/marker-icons.ts`.
 */
import type { HintBoard } from '@/types/HintCell';
import { getColorFromArea } from './utils';

export type MarkerTheme = 'light' | 'dark';

/**
 * The Material 3 roles the markers use: the Android app's fallback scheme (seed #4C8C4A) + its status colours, with the
 * website's orange in the primary roles (own position, hint labels, picked location).
 */
export interface MarkerPalette {
  surfaceContainerLowest: string;
  surfaceContainerHighest: string;
  onSurfaceVariant: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  errorContainer: string;
  onErrorContainer: string;
  ok: string;
  okContainer: string;
  onOkContainer: string;
  warnContainer: string;
  onWarnContainer: string;
}

/**
 * Android `LightFallbackScheme` / `DarkFallbackScheme` + `LightStatusColors` / `DarkStatusColors`; primary is the site's
 * orange (#ea580c, the dark theme's --primary: the light theme's #f97316 is too pale under a white glyph), the hint
 * label containers Tailwind's orange-100 / orange-900.
 */
export const MARKER_PALETTES: Record<MarkerTheme, MarkerPalette> = {
  light: {
    surfaceContainerLowest: '#ffffff',
    surfaceContainerHighest: '#e0e4db',
    onSurfaceVariant: '#424940',
    primary: '#ea580c',
    onPrimary: '#ffffff',
    primaryContainer: '#ffedd5',
    onPrimaryContainer: '#7c2d12',
    secondary: '#52634f',
    secondaryContainer: '#d6e8ce',
    onSecondaryContainer: '#3b4b38',
    tertiary: '#38656a',
    onTertiary: '#ffffff',
    tertiaryContainer: '#bcebf0',
    onTertiaryContainer: '#1f4d52',
    errorContainer: '#ffdad6',
    onErrorContainer: '#93000a',
    ok: '#2f6b2c',
    okContainer: '#b7f2ae',
    onOkContainer: '#0b3a0e',
    warnContainer: '#ffddb8',
    onWarnContainer: '#2c1600',
  },
  dark: {
    surfaceContainerLowest: '#0b0f0a',
    surfaceContainerHighest: '#323630',
    onSurfaceVariant: '#c2c9bd',
    primary: '#ea580c',
    onPrimary: '#ffffff',
    primaryContainer: '#7c2d12',
    onPrimaryContainer: '#ffedd5',
    secondary: '#baccb3',
    secondaryContainer: '#3b4b38',
    onSecondaryContainer: '#d6e8ce',
    tertiary: '#a0cfd4',
    onTertiary: '#00363b',
    tertiaryContainer: '#1f4d52',
    onTertiaryContainer: '#bcebf0',
    errorContainer: '#93000a',
    onErrorContainer: '#ffdad6',
    ok: '#9bd893',
    okContainer: '#1e5120',
    onOkContainer: '#b7f2ae',
    warnContainer: '#693c00',
    onWarnContainer: '#ffddb8',
  },
};

// --- areas ---

const AREAS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'oscar'] as const;
export type AreaKey = (typeof AREAS)[number];
/** An area, or `none` when the data names no known area. */
export type AreaOrNone = AreaKey | 'none';

/** Lowercase area wire name ("Alpha" from /areas and /teams, "alpha" from /markers), undefined when unknown. */
export function areaKey(name: string | undefined): AreaKey | undefined {
  const key = name?.trim().toLowerCase();
  return (AREAS as readonly string[]).includes(key ?? '') ? (key as AreaKey) : undefined;
}

/** Badge letter: A…H, O; empty for `none`. */
export function areaLetter(area: AreaOrNone): string {
  return area === 'none' ? '' : area[0].toUpperCase();
}

function isArea(value: string): value is AreaOrNone {
  return value === 'none' || (AREAS as readonly string[]).includes(value);
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const ON_AREA_LIGHT = '#ffffff';
/** Android neutral N10 (onSurface in light) */
const ON_AREA_DARK = '#191d17';

/**
 * Group marker colours: filled with the area colour (the website's `getColorFromArea` palette, the same in light and
 * dark theme), the glyph in whichever of white / near-black reads best on it. Undefined for a team without an area.
 */
export function groupColors(area: AreaOrNone): { fill: string; on: string } | undefined {
  if (area === 'none') return undefined;
  const fill = getColorFromArea(area);
  return { fill, on: contrastRatio(fill, ON_AREA_LIGHT) >= contrastRatio(fill, ON_AREA_DARK) ? ON_AREA_LIGHT : ON_AREA_DARK };
}

// --- status ---

export type FoxStatus = 'green' | 'orange' | 'red';
const STATUSES: readonly string[] = ['green', 'orange', 'red'] satisfies FoxStatus[];

/** Area status from /areas; anything unknown counts as inactive (red), like the Android app. */
export function foxStatus(wire: string | undefined): FoxStatus {
  return STATUSES.includes(wire ?? '') ? (wire as FoxStatus) : 'red';
}

/** Spot marker colours: the ok / warn / error container roles. */
export function statusColors(status: FoxStatus, palette: MarkerPalette): { container: string; on: string } {
  switch (status) {
    case 'green':
      return { container: palette.okContainer, on: palette.onOkContainer };
    case 'orange':
      return { container: palette.warnContainer, on: palette.onWarnContainer };
    default:
      return { container: palette.errorContainer, on: palette.onErrorContainer };
  }
}

// --- glyphs ---

/** Hunter icon: the vehicle of the device's Traccar group, `phone` when the group isn't a vehicle. */
export type HunterIcon = 'walking' | 'bike' | 'car' | 'motorcycle' | 'phone';
const HUNTER_ICONS: readonly string[] = ['walking', 'bike', 'car', 'motorcycle', 'phone'] satisfies HunterIcon[];

export type GlyphName =
  | 'directions_walk'
  | 'directions_bike'
  | 'directions_car'
  | 'two_wheeler'
  | 'person'
  | 'photo_camera'
  | 'home'
  | 'check'
  | 'close'
  | 'assignment_turned_in'
  | 'celebration'
  | 'chat'
  | 'e911_emergency';

/** Material Symbol per vehicle (Android `vehicleGlyph`); a device without vehicle is a person. */
export function vehicleGlyph(icon: HunterIcon): GlyphName {
  switch (icon) {
    case 'walking':
      return 'directions_walk';
    case 'bike':
      return 'directions_bike';
    case 'car':
      return 'directions_car';
    case 'motorcycle':
      return 'two_wheeler';
    default:
      return 'person';
  }
}

// --- image ids ---

export type FoxKind = 'spot' | 'hunt' | 'other';
const FOX_KINDS: readonly string[] = ['spot', 'hunt', 'other'] satisfies FoxKind[];

/** Everything needed to draw one marker image (the Android `IconKey`, plus the web's extras). */
export type MarkerIconKey =
  | { kind: 'hunter'; icon: HunterIcon; stale: boolean }
  | { kind: 'fox'; type: FoxKind; status: FoxStatus; area: AreaOrNone }
  | { kind: 'hint'; area: AreaOrNone; label: string }
  | { kind: 'hintdot' }
  | { kind: 'group'; area: AreaOrNone; visited: boolean }
  | { kind: 'prediction'; area: AreaOrNone; stale: boolean }
  | { kind: 'arrow' };

const live = (stale: boolean) => (stale ? 'stale' : 'live');

/** Theme-less id of a marker image, e.g. `fox|spot|green|alpha`; features carry this one. */
export function markerIconId(key: MarkerIconKey): string {
  switch (key.kind) {
    case 'hunter':
      return `hunter|${key.icon}|${live(key.stale)}`;
    case 'fox':
      return `fox|${key.type}|${key.status}|${key.area}`;
    case 'hint':
      return `hint|${key.area}|${key.label}`;
    case 'group':
      return `group|${key.area}|${key.visited ? 'visited' : 'open'}`;
    case 'prediction':
      return `predict|${key.area}|${live(key.stale)}`;
    default:
      return key.kind;
  }
}

const IMAGE_PREFIX = 'jh';

/** The map image id: the theme goes in front, so a theme switch asks for (and draws) new images. */
export function themedImageId(theme: MarkerTheme, iconId: string): string {
  return `${IMAGE_PREFIX}|${theme}|${iconId}`;
}

/** Symbol layer `icon-image` for features with an `icon` property holding a {@link markerIconId}. */
export function themedIconExpression(theme: MarkerTheme, property = 'icon'): ['concat', string, ['get', string]] {
  return ['concat', `${IMAGE_PREFIX}|${theme}|`, ['get', property]];
}

function parseStale(value: string): boolean | undefined {
  return value === 'stale' ? true : value === 'live' ? false : undefined;
}

function parseKey(p: string[]): MarkerIconKey | undefined {
  switch (p[0]) {
    case 'hunter': {
      const stale = parseStale(p[2]);
      return p.length === 3 && HUNTER_ICONS.includes(p[1]) && stale !== undefined ? { kind: 'hunter', icon: p[1] as HunterIcon, stale } : undefined;
    }
    case 'fox':
      return p.length === 4 && FOX_KINDS.includes(p[1]) && STATUSES.includes(p[2]) && isArea(p[3])
        ? { kind: 'fox', type: p[1] as FoxKind, status: p[2] as FoxStatus, area: p[3] }
        : undefined;
    case 'hint':
      return p.length === 3 && isArea(p[1]) ? { kind: 'hint', area: p[1], label: p[2] } : undefined;
    case 'group':
      return p.length === 3 && isArea(p[1]) && (p[2] === 'visited' || p[2] === 'open') ? { kind: 'group', area: p[1], visited: p[2] === 'visited' } : undefined;
    case 'predict': {
      const stale = parseStale(p[2]);
      return p.length === 3 && isArea(p[1]) && stale !== undefined ? { kind: 'prediction', area: p[1], stale } : undefined;
    }
    case 'hintdot':
    case 'arrow':
      return p.length === 1 ? { kind: p[0] } : undefined;
    default:
      return undefined;
  }
}

/** Theme and key of one of our map images, undefined for any other image id. */
export function parseMarkerImageId(id: string): { theme: MarkerTheme; key: MarkerIconKey } | undefined {
  const [prefix, theme, ...rest] = id.split('|');
  if (prefix !== IMAGE_PREFIX || (theme !== 'light' && theme !== 'dark')) return undefined;
  const key = parseKey(rest);
  return key && { theme, key };
}

// --- hints ---

/** Hints older than this are drawn as a dot without label (Android `HINT_LABEL_MS`). */
export const HINT_LABEL_MS = 6 * 60 * 60_000;

/** "A · H3" label when the board knows the number, else the clock; only a dot once older than {@link HINT_LABEL_MS}. */
export function hintIconKey(area: AreaOrNone, timeMs: number, number: number | undefined, nowMs: number, clock: string): MarkerIconKey {
  if (nowMs - timeMs > HINT_LABEL_MS) return { kind: 'hintdot' };
  return { kind: 'hint', area, label: number !== undefined ? `H${number}` : clock };
}

const HINT_CLOCK = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

/** Hint label clock: always Dutch time (the game is played in the Netherlands), whatever the viewer's time zone. */
export function formatHintClock(timeMs: number): string {
  return HINT_CLOCK.format(timeMs);
}

/** Test hints seeded on the server have ids from here on; they never get a number. */
const SEEDED_HINT_ID = 900_000;
/** A hint published this long before the start still counts as a game hint. */
const HINT_START_LEAD_MS = 30 * 60_000;

export interface HuntWindow {
  startMs: number;
  endMs: number;
}

export interface HintNumbering {
  numberOf(markerId: string, area: string, timeMs: number): number | undefined;
}

/**
 * Game hint numbers for the "A · H3" labels (Android `hintsFrom` + `hintNumbering`): articles oldest first (ties by
 * id), without seeded test hints, and once the board has hints inside the hunt only those. A marker finds its number
 * by its id, else by area + time slot (the older hint with a puzzle for the area wins the slot).
 */
export function hintNumbering(board: HintBoard | undefined, hunt: HuntWindow): HintNumbering {
  const byMarkerId = new Map<string, number>();
  const bySlot = new Map<string, number>();
  if (board) {
    const time = (iso: string) => {
      const ms = Date.parse(iso);
      return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
    };
    const real = [...board.articles].sort((a, b) => time(a.publishAt) - time(b.publishAt) || a.id - b.id).filter((a) => a.id < SEEDED_HINT_ID);
    const inHunt = real.filter((a) => {
      const ms = time(a.publishAt);
      return ms >= hunt.startMs - HINT_START_LEAD_MS && ms <= hunt.endMs;
    });
    const numbered = inHunt.length ? inHunt : real;
    const cellsByArticle = new Map<number, HintBoard['cells']>();
    for (const cell of board.cells) cellsByArticle.set(cell.articleId, [...(cellsByArticle.get(cell.articleId) ?? []), cell]);
    numbered.forEach((article, index) => {
      for (const cell of cellsByArticle.get(article.id) ?? []) {
        if (cell.markerId) byMarkerId.set(cell.markerId, index + 1);
        const area = areaKey(cell.area);
        const slot = Date.parse(cell.slotTime);
        const key = `${area}|${slot}`;
        if (area && !Number.isNaN(slot) && cell.status !== 'none' && !bySlot.has(key)) bySlot.set(key, index + 1);
      }
    });
  }
  return {
    numberOf: (markerId, area, timeMs) => byMarkerId.get(markerId) ?? bySlot.get(`${areaKey(area)}|${timeMs}`),
  };
}
