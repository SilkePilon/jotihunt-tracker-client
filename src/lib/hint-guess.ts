import { distance } from '@turf/turf';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { isInNetherlands } from '@/lib/netherlands';
import { fromRD, isPlausibleRD } from '@/lib/rd';
import { createCircle } from '@/lib/utils';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

/**
 * Partly solved hints: RD digit patterns with `?` for unknown digits. One `?` gives up to 10 candidate points, two or
 * more an RD rectangle; candidates are judged against how far the fox could have walked since its last known spot.
 */

export const HINT_GUESS_SOURCE = 'hint-guess';
export const HINT_GUESS_REACH_LAYER = 'hint-guess-reach';
export const HINT_GUESS_AREA_FILL_LAYER = 'hint-guess-area-fill';
export const HINT_GUESS_AREA_LINE_LAYER = 'hint-guess-area-line';

/** Walking pace of a fox team (with some margin) for the reach circle */
export const REACH_KMH = 6;
/** Candidates this close together are one point: the unknown digit doesn't matter */
const COLLAPSE_M = 50;
/** A rectangle wider than this (either axis) is useless on the map */
const WIDE_M = 60_000;
/** Half-width of the strip around an axis without '?': that axis is exact, the corridor only makes the strip visible */
const CORRIDOR_M = 50;
/** Steps per rectangle edge: RD straight lines are slightly curved in WGS84 */
const RING_STEPS = 16;

// A phone's number keyboard has no '?': these keys mean "unknown digit" too
const WILDCARD_KEYS = new Set(['?', '.', ',', '*', '-', ' ']);

/** One typed character: a wildcard key becomes '?', anything else stays as it is. */
export function normalizeWildcard(char: string): string {
  return WILDCARD_KEYS.has(char) ? '?' : char;
}

/** Digit box value: wildcard keys become '?', other non-digits are dropped, at most `max` characters. */
export function sanitizeDigits(value: string, max = 6): string {
  return [...value].map(normalizeWildcard).filter((char) => /[0-9?]/.test(char)).join('').slice(0, max);
}

export const hasWildcard = (...patterns: string[]) => patterns.some((pattern) => pattern.includes('?'));

/** The pattern with every '?' replaced by `digit`. */
export function fillPattern(pattern: string, digit: number): string {
  return pattern.replaceAll('?', String(digit));
}

export interface GuessPoint {
  /** The digit the '?' stands for */
  digit: number;
  /** RD metres */
  x: number;
  y: number;
  lng: number;
  lat: number;
}

export type Guess = { kind: 'points'; points: GuessPoint[]; collapsed: boolean } | { kind: 'area'; ring: [number, number][]; wide: boolean };

const PATTERN = /^[0-9?]+$/;
const range = (values: number[]) => Math.max(...values) - Math.min(...values);

/** WGS84 ring of an RD rectangle, closed, each edge densified. */
function rdRing(minX: number, minY: number, maxX: number, maxY: number): [number, number][] {
  const corners = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]];
  const ring: [number, number][] = [];
  for (let edge = 0; edge < 4; edge++) {
    const [ax, ay] = corners[edge];
    const [bx, by] = corners[edge + 1];
    for (let step = 0; step < RING_STEPS; step++) {
      const t = step / RING_STEPS;
      ring.push(fromRD(ax + (bx - ax) * t, ay + (by - ay) * t));
    }
  }
  ring.push(ring[0]);
  return ring;
}

/** RD [min, max] of one axis of a rectangle guess: a '?' axis covers its whole last cell, a known axis a thin corridor. */
function axisExtent(pattern: string, scale: number): [number, number] {
  const min = Number(pattern.replaceAll('?', '0')) * scale;
  if (!pattern.includes('?')) return [min - CORRIDOR_M, min + CORRIDOR_M];
  const top = Number(pattern.replaceAll('?', '9'));
  // A hectometre value names a 100 m cell, so the last cell ends one step further; metre values are used as is
  return [min, scale === 100 ? (top + 1) * scale : top];
}

/**
 * The candidates of an X/Y digit pattern pair (both 4 digits = hectometres, or both 6 = metres).
 * @returns null without a '?' or when the lengths don't fit
 */
export function parseGuess(x: string, y: string): Guess | null {
  if (x.length !== y.length || (x.length !== 4 && x.length !== 6)) return null;
  if (!PATTERN.test(x) || !PATTERN.test(y)) return null;
  const wildcards = [...`${x}${y}`].filter((char) => char === '?').length;
  if (!wildcards) return null;
  const scale = x.length === 4 ? 100 : 1;

  if (wildcards === 1) {
    const points: GuessPoint[] = [];
    for (let digit = 0; digit <= 9; digit++) {
      const rx = Number(fillPattern(x, digit)) * scale;
      const ry = Number(fillPattern(y, digit)) * scale;
      if (!isPlausibleRD(rx, ry)) continue;
      const [lng, lat] = fromRD(rx, ry);
      if (!isInNetherlands(lng, lat)) continue;
      points.push({ digit, x: rx, y: ry, lng, lat });
    }
    if (points.length > 1 && Math.max(range(points.map((point) => point.x)), range(points.map((point) => point.y))) <= COLLAPSE_M) {
      return { kind: 'points', points: [points[0]], collapsed: true };
    }
    return { kind: 'points', points, collapsed: false };
  }

  const [minX, maxX] = axisExtent(x, scale);
  const [minY, maxY] = axisExtent(y, scale);
  return { kind: 'area', ring: rdRing(minX, minY, maxX, maxY), wide: maxX - minX > WIDE_M || maxY - minY > WIDE_M };
}

export type GuessFormat = 'split' | 'joined';

export interface GuessAnswer {
  x: string;
  y: string;
  /** "1234 5678" (split) or "12345678" (joined): picking writes the answer back the same way */
  format: GuessFormat;
}

/**
 * An Intel hint answer with '?' (or '*') for unknown digits, in the formats the server's parseRdAnswer reads:
 * "1234 5678", "12345678", "123400 567800", "123400567800" (separators whitespace , ;).
 * @returns null when the text has no wildcard or isn't coordinate-shaped
 */
export function parseGuessAnswer(text: string): GuessAnswer | null {
  const parts = text.trim().replaceAll('*', '?').split(/[\s,;]+/).filter(Boolean);
  let result: GuessAnswer | null = null;
  if (parts.length === 1 && /^([\d?]{8}|[\d?]{12})$/.test(parts[0])) {
    const half = parts[0].length / 2;
    result = { x: parts[0].slice(0, half), y: parts[0].slice(half), format: 'joined' };
  } else if (parts.length === 2 && parts[0].length === parts[1].length && parts.every((part) => /^([\d?]{4}|[\d?]{6})$/.test(part))) {
    result = { x: parts[0], y: parts[1], format: 'split' };
  }
  return result && hasWildcard(result.x, result.y) ? result : null;
}

/** A filled-in answer in the format it was typed in. */
export function guessAnswerText(x: string, y: string, format: GuessFormat): string {
  return format === 'joined' ? `${x}${y}` : `${x} ${y}`;
}

export interface FoxFix {
  lng: number;
  lat: number;
  /** Epoch ms */
  time: number;
}

/** Newest hint or hunt marker of the area from before `before` (epoch ms): the fox's last known spot. */
export function lastFoxFix(markers: Marker[], area: string, before: number): FoxFix | null {
  const key = area.toLowerCase();
  let fix: FoxFix | null = null;
  for (const marker of markers) {
    if (marker.area?.toLowerCase() !== key) continue;
    if (marker.type !== MarkerType.Hint && marker.type !== MarkerType.Hunt) continue;
    const time = new Date(marker.time).getTime();
    if (!(time < before) || (fix && time <= fix.time)) continue;
    const [lng, lat] = marker.location.coordinates;
    fix = { lng, lat, time };
  }
  return fix;
}

export type GuessRole = 'best' | 'in' | 'out';

export interface GuessRank {
  /** How far the fox could have walked since the fix, or null without a fix */
  reach: Feature<Polygon> | null;
  /** Per candidate point (empty for a rectangle) */
  roles: GuessRole[];
}

/**
 * Judge the candidates: inside the reach (REACH_KMH since the fix) or not; the one inside closest to the fix is best.
 * @param at Epoch ms of the hint (null: unknown)
 */
export function rankGuess(guess: Guess, fix: FoxFix | null, at: number | null): GuessRank {
  const count = guess.kind === 'points' ? guess.points.length : 0;
  if (!fix || at === null || at <= fix.time) return { reach: null, roles: Array<GuessRole>(count).fill('in') };
  const radius = REACH_KMH * 1000 * ((at - fix.time) / 3_600_000);
  const reach = createCircle(fix.lng, fix.lat, radius) as Feature<Polygon>;
  if (guess.kind !== 'points') return { reach, roles: [] };

  const distances = guess.points.map((point) => distance([fix.lng, fix.lat], [point.lng, point.lat], { units: 'meters' }));
  const roles: GuessRole[] = distances.map((meters) => (meters <= radius ? 'in' : 'out'));
  let best = -1;
  distances.forEach((meters, index) => {
    if (roles[index] === 'in' && (best === -1 || meters < distances[best])) best = index;
  });
  if (best !== -1) roles[best] = 'best';
  return { reach, roles };
}

export type GuessShapeProps = { role: 'area' | 'reach' };

/** GeoJSON for the map: the rectangle (unless too wide) and the reach circle. */
export function guessShapes(guess: Guess | null, rank: GuessRank | null): FeatureCollection<Polygon, GuessShapeProps> {
  const features: Feature<Polygon, GuessShapeProps>[] = [];
  if (guess?.kind === 'area' && !guess.wide) {
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [guess.ring] }, properties: { role: 'area' } });
  }
  if (rank?.reach) features.push({ ...rank.reach, properties: { role: 'reach' } });
  return { type: 'FeatureCollection', features };
}

/** [[west, south], [east, north]] around the candidates (and the fix), or null when there is nothing to show. */
export function guessBounds(guess: Guess, fix: FoxFix | null): [[number, number], [number, number]] | null {
  const coords: [number, number][] = guess.kind === 'points' ? guess.points.map((point) => [point.lng, point.lat]) : guess.wide ? [] : [...guess.ring];
  if (!coords.length) return null;
  if (fix) coords.push([fix.lng, fix.lat]);
  const lngs = coords.map(([lng]) => lng);
  const lats = coords.map(([, lat]) => lat);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export interface GuessStatus {
  tone: 'guess' | 'warn';
  text: string;
  /** What to do on the map (" · tik …"): the card shows it after the text, Intel (which has its own button) doesn't */
  action?: string;
}

/** The line under the input (a null guess: a '?' is typed but not every box is filled yet). */
export function guessStatus(guess: Guess | null): GuessStatus {
  if (!guess) return { tone: 'guess', text: 'Vul alle vakjes in · ? = onbekend' };
  if (guess.kind === 'area') {
    return guess.wide ? { tone: 'warn', text: 'Te breed — vul meer cijfers in' } : { tone: 'guess', text: 'Gebied op kaart · vul meer cijfers in' };
  }
  if (!guess.points.length) return { tone: 'warn', text: 'Geen mogelijkheden in Nederland' };
  if (guess.collapsed) return { tone: 'guess', text: 'Onbekend cijfer maakt niet uit', action: ' · tik de stip' };
  return { tone: 'guess', text: `${guess.points.length} mogelijk`, action: ' · tik er een op de kaart' };
}
