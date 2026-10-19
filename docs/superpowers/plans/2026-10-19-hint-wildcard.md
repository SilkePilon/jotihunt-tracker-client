# Partly Solved Hints (Wildcard Digits) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a hunter type `?` for unknown hint digits (hint card and Intel hint row), see every possible location on the map judged against the fox's reach, and tap one to fill it in.

**Architecture:** Client only. Pure logic in `src/lib/hint-guess.ts` (patterns → candidate points or an RD rectangle, reach ranking, GeoJSON). A zustand store `src/stores/hint-guess.store.ts` holds the one current guess and routes a pick back to the card (existing `useHintFormBridge`) or to Intel (`pendingAnswer` + `openIntel`). `src/components/layers/HintGuess.tsx` draws it: HTML `Marker` dots (animated with motion, CSS colours) plus a GeoJSON source for the rectangle and reach circle.

**Tech Stack:** React 19, TypeScript, zustand, react-map-gl/maplibre, motion/react, turf, proj4 (`lib/rd.ts`), Tailwind v4 tokens in `src/index.css`, `bun test`.

Spec: `docs/superpowers/specs/2026-10-19-hint-wildcard-design.md`.

## Global Constraints

- Dutch UI copy exactly as in the spec: "N mogelijk · tik er een op de kaart", "Onbekend cijfer maakt niet uit · tik de stip", "Te breed — vul meer cijfers in", "Gebied op kaart · vul meer cijfers in", "Geen mogelijkheden in Nederland", "Toon op kaart".
- Wildcard keys in the digit boxes: `?` `.` `,` `*` `-` space → `?`. Intel text: `?` and `*` → `?` (`,` stays a separator there).
- Reach speed 6 km/h; collapse when all candidates within 50 m; "te breed" when the rectangle spans more than 60 km on either axis.
- Colours: `--guess` `#7b61d1` / dark `#b9a6ff`; `--guess-container` `#e8e2f8` / dark `#352a5c`; `--on-guess-container` `#3b2a73` / dark `#e3dbff`. Reach circle red `#ba1a1a` / dark `#ffb4ab`.
- Icons from lucide-react only, no emoji in new UI.
- Every appearing/disappearing UI piece animates (motion/react, existing `SWAP` / `Reveal`).
- Nothing is stored server-side; no server or Android change.
- Commands run from `jotihunt-tracker-client/`: tests `npx bun test <file>`, lint `npx bun run lint`, build `npx bun run build`.

---

### Task 1: Guess logic (`lib/hint-guess.ts`)

**Files:**
- Create: `src/lib/hint-guess.ts`
- Test: `src/lib/hint-guess.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - `HINT_GUESS_SOURCE`, `HINT_GUESS_REACH_LAYER`, `HINT_GUESS_AREA_FILL_LAYER`, `HINT_GUESS_AREA_LINE_LAYER` (string constants)
  - `REACH_KMH = 6`
  - `normalizeWildcard(char: string): string`
  - `sanitizeDigits(value: string, max?: number): string`
  - `hasWildcard(...patterns: string[]): boolean`
  - `fillPattern(pattern: string, digit: number): string`
  - `type GuessPoint = { digit: number; x: number; y: number; lng: number; lat: number }`
  - `type Guess = { kind: 'points'; points: GuessPoint[]; collapsed: boolean } | { kind: 'area'; ring: [number, number][]; wide: boolean }`
  - `parseGuess(x: string, y: string): Guess | null`
  - `type GuessFormat = 'split' | 'joined'`, `interface GuessAnswer { x: string; y: string; format: GuessFormat }`
  - `parseGuessAnswer(text: string): GuessAnswer | null`
  - `guessAnswerText(x: string, y: string, format: GuessFormat): string`
  - `interface FoxFix { lng: number; lat: number; time: number }`
  - `lastFoxFix(markers: Marker[], area: string, before: number): FoxFix | null`
  - `type GuessRole = 'best' | 'in' | 'out'`, `interface GuessRank { reach: Feature<Polygon> | null; roles: GuessRole[] }`
  - `rankGuess(guess: Guess, fix: FoxFix | null, at: number | null): GuessRank`
  - `type GuessShapeProps = { role: 'area' | 'reach' }`
  - `guessShapes(guess: Guess | null, rank: GuessRank | null): FeatureCollection<Polygon, GuessShapeProps>`
  - `guessBounds(guess: Guess, fix: FoxFix | null): [[number, number], [number, number]] | null`
  - `interface GuessStatus { tone: 'guess' | 'warn'; text: string }`, `guessStatus(guess: Guess | null): GuessStatus`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/hint-guess.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import {
  fillPattern, guessAnswerText, guessBounds, guessShapes, guessStatus, hasWildcard, lastFoxFix, normalizeWildcard,
  parseGuess, parseGuessAnswer, rankGuess, sanitizeDigits, type Guess,
} from './hint-guess';
import { fromRD, isPlausibleRD } from './rd';
import { isInNetherlands } from './netherlands';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

const points = (guess: Guess | null) => (guess?.kind === 'points' ? guess.points : []);

describe('wildcard input', () => {
  test('normalizeWildcard maps the phone keys to ?', () => {
    for (const key of ['?', '.', ',', '*', '-', ' ']) expect(normalizeWildcard(key)).toBe('?');
    expect(normalizeWildcard('7')).toBe('7');
  });
  test('sanitizeDigits keeps digits and wildcards, max 6', () => {
    expect(sanitizeDigits('15.2a00')).toBe('15?200');
    expect(sanitizeDigits('1234567')).toBe('123456');
  });
  test('hasWildcard and fillPattern', () => {
    expect(hasWildcard('155000', '46?000')).toBe(true);
    expect(hasWildcard('155000', '463000')).toBe(false);
    expect(fillPattern('15?000', 4)).toBe('154000');
  });
});

describe('parseGuess', () => {
  test('no wildcard or bad lengths give null', () => {
    expect(parseGuess('155000', '463000')).toBeNull();
    expect(parseGuess('15?000', '4630')).toBeNull();
    expect(parseGuess('15?00', '46300')).toBeNull();
  });
  test('one ? in a 6-digit X gives 10 points 1 km apart', () => {
    const list = points(parseGuess('15?000', '463000'));
    expect(list.map((point) => point.digit)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(list[4].x).toBe(154000);
    expect(list[4].y).toBe(463000);
    expect(list[5].x - list[4].x).toBe(1000);
  });
  test('4-digit parts are hectometres', () => {
    const list = points(parseGuess('15?0', '4630'));
    expect(list[1].x).toBe(151000);
    expect(list[1].y).toBe(463000);
  });
  test('candidates outside the RD grid or the Netherlands are dropped', () => {
    const list = points(parseGuess('?55000', '463000'));
    expect(list.some((point) => point.digit === 1)).toBe(true);
    expect(list.every((point) => point.digit <= 2)).toBe(true);
    for (const point of list) {
      expect(isPlausibleRD(point.x, point.y)).toBe(true);
      expect(isInNetherlands(point.lng, point.lat)).toBe(true);
    }
  });
  test('a ? in the last digit collapses to one point', () => {
    const guess = parseGuess('15500?', '463000');
    expect(guess).toEqual({ kind: 'points', points: [expect.objectContaining({ digit: 0, x: 155000 })], collapsed: true });
  });
  test('two ? give a rectangle; wide past 60 km', () => {
    const narrow = parseGuess('15??00', '463000');
    expect(narrow?.kind).toBe('area');
    if (narrow?.kind !== 'area') return;
    expect(narrow.wide).toBe(false);
    expect(narrow.ring[0]).toEqual(narrow.ring[narrow.ring.length - 1]);
    const [minLng] = fromRD(150000, 463000);
    expect(narrow.ring[0][0]).toBeCloseTo(minLng, 6);
    const wide = parseGuess('1??000', '463000');
    expect(wide?.kind === 'area' && wide.wide).toBe(true);
  });
});

describe('parseGuessAnswer', () => {
  test('split and joined formats with ?', () => {
    expect(parseGuessAnswer('15?2 4631')).toEqual({ x: '15?2', y: '4631', format: 'split' });
    expect(parseGuessAnswer('15?200, 463100')).toEqual({ x: '15?200', y: '463100', format: 'split' });
    expect(parseGuessAnswer('15?24631')).toEqual({ x: '15?2', y: '4631', format: 'joined' });
    expect(parseGuessAnswer('15*200463100')).toEqual({ x: '15?200', y: '463100', format: 'joined' });
  });
  test('no wildcard, words or mismatched lengths give null', () => {
    expect(parseGuessAnswer('1552 4631')).toBeNull();
    expect(parseGuessAnswer('vos?')).toBeNull();
    expect(parseGuessAnswer('15?2 463100')).toBeNull();
  });
  test('guessAnswerText writes it back in the typed format', () => {
    expect(guessAnswerText('1542', '4631', 'split')).toBe('1542 4631');
    expect(guessAnswerText('1542', '4631', 'joined')).toBe('15424631');
  });
});

const marker = (area: string, type: MarkerType, time: string, x: number, y: number): Marker => {
  const [lng, lat] = fromRD(x, y);
  return { area, type, time: new Date(time), location: { type: 'Point', coordinates: [lng, lat] } };
};

describe('lastFoxFix', () => {
  const markers = [
    marker('Alpha', MarkerType.Hint, '2026-10-17T11:00:00Z', 150000, 460000),
    marker('alpha', MarkerType.Hunt, '2026-10-17T12:30:00Z', 155000, 463000),
    marker('alpha', MarkerType.Spot, '2026-10-17T12:45:00Z', 1, 1),
    marker('bravo', MarkerType.Hint, '2026-10-17T12:50:00Z', 2, 2),
    marker('alpha', MarkerType.Hint, '2026-10-17T13:00:00Z', 3, 3),
  ];
  test('newest hint or hunt of the area before the time', () => {
    const fix = lastFoxFix(markers, 'alpha', Date.parse('2026-10-17T13:00:00Z'));
    expect(fix?.time).toBe(Date.parse('2026-10-17T12:30:00Z'));
  });
  test('nothing earlier gives null', () => {
    expect(lastFoxFix(markers, 'alpha', Date.parse('2026-10-17T10:00:00Z'))).toBeNull();
  });
});

describe('rankGuess', () => {
  const guess = parseGuess('15?000', '463000')!;
  const [lng, lat] = fromRD(155000, 463000);
  const at = Date.parse('2026-10-17T13:00:00Z');
  test('reach 2.5 km after 25 min: digits 3-7 in, 5 best', () => {
    const rank = rankGuess(guess, { lng, lat, time: at - 25 * 60_000 }, at);
    expect(rank.reach).not.toBeNull();
    expect(rank.roles).toEqual(['out', 'out', 'out', 'in', 'in', 'best', 'in', 'in', 'out', 'out']);
  });
  test('no fix: all in, no circle', () => {
    const rank = rankGuess(guess, null, at);
    expect(rank.reach).toBeNull();
    expect(rank.roles.every((role) => role === 'in')).toBe(true);
  });
});

describe('shapes, bounds and status', () => {
  test('guessShapes has the area and the reach', () => {
    const area = parseGuess('15??00', '463000')!;
    const [lng, lat] = fromRD(155000, 463000);
    const rank = rankGuess(area, { lng, lat, time: 0 }, 3_600_000);
    expect(guessShapes(area, rank).features.map((feature) => feature.properties.role)).toEqual(['area', 'reach']);
    expect(guessShapes(parseGuess('1??000', '463000'), null).features).toEqual([]);
  });
  test('guessBounds spans the points', () => {
    const bounds = guessBounds(parseGuess('15?000', '463000')!, null)!;
    expect(bounds[0][0]).toBeLessThan(bounds[1][0]);
    expect(guessBounds(parseGuess('1??000', '463000')!, null)).toBeNull();
  });
  test('guessStatus texts', () => {
    expect(guessStatus(parseGuess('15?000', '463000')).text).toBe('10 mogelijk · tik er een op de kaart');
    expect(guessStatus(parseGuess('15500?', '463000')).text).toBe('Onbekend cijfer maakt niet uit · tik de stip');
    expect(guessStatus(parseGuess('15??00', '463000')).text).toBe('Gebied op kaart · vul meer cijfers in');
    expect(guessStatus(parseGuess('1??000', '463000'))).toEqual({ tone: 'warn', text: 'Te breed — vul meer cijfers in' });
    expect(guessStatus({ kind: 'points', points: [], collapsed: false })).toEqual({ tone: 'warn', text: 'Geen mogelijkheden in Nederland' });
    expect(guessStatus(null).text).toBe('Vul alle vakjes in · ? = onbekend');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx bun test src/lib/hint-guess.test.ts`
Expected: FAIL, cannot find module `./hint-guess`.

- [ ] **Step 3: Implement `src/lib/hint-guess.ts`**

```ts
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

  const minX = Number(x.replaceAll('?', '0')) * scale;
  const maxX = Number(x.replaceAll('?', '9')) * scale;
  const minY = Number(y.replaceAll('?', '0')) * scale;
  const maxY = Number(y.replaceAll('?', '9')) * scale;
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
}

/** The line under the input. null: a '?' is typed but not every box is filled yet. */
export function guessStatus(guess: Guess | null): GuessStatus {
  if (!guess) return { tone: 'guess', text: 'Vul alle vakjes in · ? = onbekend' };
  if (guess.kind === 'area') {
    return guess.wide ? { tone: 'warn', text: 'Te breed — vul meer cijfers in' } : { tone: 'guess', text: 'Gebied op kaart · vul meer cijfers in' };
  }
  if (!guess.points.length) return { tone: 'warn', text: 'Geen mogelijkheden in Nederland' };
  if (guess.collapsed) return { tone: 'guess', text: 'Onbekend cijfer maakt niet uit · tik de stip' };
  return { tone: 'guess', text: `${guess.points.length} mogelijk · tik er een op de kaart` };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx bun test src/lib/hint-guess.test.ts`
Expected: all PASS. If `?55000` keeps digit 2 or drops it, the test only requires digit 1 kept and nothing above 2; if digit 1 itself is dropped, check `isInNetherlands(fromRD(155000, 463000))` (Amersfoort, must be true).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hint-guess.ts src/lib/hint-guess.test.ts
git commit -m "feat(hints): wildcard digit guesses (candidates, reach, shapes)"
```

---

### Task 2: Guess store + map layer + colours

**Files:**
- Create: `src/stores/hint-guess.store.ts`
- Create: `src/components/layers/HintGuess.tsx`
- Modify: `src/lib/map-layers.ts` (import ids, add to the underlay group of `MAP_LAYER_STACK`, line ~65)
- Modify: `src/components/Map.tsx` (mount next to `HuntFocus`, line ~295)
- Modify: `src/index.css` (tokens after `--fox-on-ov-container` in `:root` ~line 55 and `.dark` ~line 109; theme entries after `--color-fox-ov-container` ~line 168)
- Test: `src/stores/hint-guess.store.test.ts`

**Interfaces:**
- Consumes: Task 1 (`parseGuess`, `lastFoxFix`, `rankGuess`, `guessShapes`, `guessBounds`, `fillPattern`, `guessAnswerText`, `GuessFormat`, layer id constants).
- Produces:
  - `type GuessSource = 'card' | 'intel'`
  - `interface GuessInput { source: GuessSource; x: string; y: string; area: string | null; at: number | null; articleId: number | null; format: GuessFormat }`
  - `interface PendingAnswer { id: number; articleId: number; area: string; text: string }`
  - default export `useHintGuessStore` with `input: GuessInput | null`, `pendingAnswer: PendingAnswer | null`, `show(input: GuessInput): void`, `clear(source?: GuessSource): void`, `pick(digit: number): void`, `clearPending(id: number): void`
  - Tailwind colours `guess`, `guess-container`, `on-guess-container` (`bg-guess`, `text-on-guess-container`, …)

- [ ] **Step 1: Write the failing store test**

Create `src/stores/hint-guess.store.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'bun:test';
import useHintGuessStore, { type GuessInput } from './hint-guess.store';
import { useHintFormBridge } from '@/hooks/hint-bridge.hook';
import useIntelStore from './intel.store';

const card: GuessInput = { source: 'card', x: '15?000', y: '463000', area: 'alpha', at: null, articleId: null, format: 'split' };
const intel: GuessInput = { source: 'intel', x: '15?2', y: '4631', area: 'alpha', at: 1, articleId: 7, format: 'split' };

beforeEach(() => {
  useHintGuessStore.setState({ input: null, pendingAnswer: null });
  useHintFormBridge.getState().clear();
  useIntelStore.setState({ open: false, articleId: null, area: null });
});

describe('hint guess store', () => {
  test('show keeps the same object for an equal input', () => {
    useHintGuessStore.getState().show(card);
    const first = useHintGuessStore.getState().input;
    useHintGuessStore.getState().show({ ...card });
    expect(useHintGuessStore.getState().input).toBe(first);
  });
  test('clear(source) only clears that source', () => {
    useHintGuessStore.getState().show(intel);
    useHintGuessStore.getState().clear('card');
    expect(useHintGuessStore.getState().input).not.toBeNull();
    useHintGuessStore.getState().clear();
    expect(useHintGuessStore.getState().input).toBeNull();
  });
  test('a card pick fills the hint form through the bridge', () => {
    useHintGuessStore.getState().show(card);
    useHintGuessStore.getState().pick(4);
    expect(useHintFormBridge.getState().coords).toEqual({ x: '154000', y: '463000' });
    expect(useHintGuessStore.getState().input).toBeNull();
  });
  test('an intel pick leaves a pending answer and reopens Intel on the hint', () => {
    useHintGuessStore.getState().show(intel);
    useHintGuessStore.getState().pick(3);
    expect(useHintGuessStore.getState().pendingAnswer).toMatchObject({ articleId: 7, area: 'alpha', text: '1532 4631' });
    expect(useIntelStore.getState()).toMatchObject({ open: true, articleId: 7, area: 'alpha' });
    const { id } = useHintGuessStore.getState().pendingAnswer!;
    useHintGuessStore.getState().clearPending(id);
    expect(useHintGuessStore.getState().pendingAnswer).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx bun test src/stores/hint-guess.store.test.ts`
Expected: FAIL, cannot find module `./hint-guess.store`.

- [ ] **Step 3: Implement the store `src/stores/hint-guess.store.ts`**

```ts
import { create } from 'zustand';
import { useHintFormBridge } from '@/hooks/hint-bridge.hook';
import { fillPattern, guessAnswerText, type GuessFormat } from '@/lib/hint-guess';
import useIntelStore from '@/stores/intel.store';

/** Where the guess was typed: the Hint registreren card or an Intel hint row */
export type GuessSource = 'card' | 'intel';

export interface GuessInput {
  source: GuessSource;
  /** Digit patterns with '?' (4 or 6 characters each) */
  x: string;
  y: string;
  /** Area key for the reach circle, null when unknown */
  area: string | null;
  /** Epoch ms of the hint hour, null when unknown */
  at: number | null;
  /** Intel only: the hint article to reopen on a pick */
  articleId: number | null;
  format: GuessFormat;
}

/** A picked Intel answer waiting for its row to open again (filled in, not saved) */
export interface PendingAnswer {
  id: number;
  articleId: number;
  area: string;
  text: string;
}

interface HintGuessState {
  /** The one guess on the map (only the person typing sees it) */
  input: GuessInput | null;
  pendingAnswer: PendingAnswer | null;
  show: (input: GuessInput) => void;
  /** Clear the guess; with a source only when it came from there */
  clear: (source?: GuessSource) => void;
  /** Fill every '?' with `digit` and hand the answer back to where it was typed */
  pick: (digit: number) => void;
  clearPending: (id: number) => void;
}

const sameInput = (a: GuessInput | null, b: GuessInput) =>
  !!a && a.source === b.source && a.x === b.x && a.y === b.y && a.area === b.area && a.at === b.at && a.articleId === b.articleId && a.format === b.format;

let pendingCount = 0;

const useHintGuessStore = create<HintGuessState>()((set, get) => ({
  input: null,
  pendingAnswer: null,
  // The card calls this from an effect on every render with typed values: an equal input keeps the same object
  show: (input) => {
    if (!sameInput(get().input, input)) set({ input });
  },
  clear: (source) => {
    const current = get().input;
    if (current && (!source || current.source === source)) set({ input: null });
  },
  pick: (digit) => {
    const input = get().input;
    if (!input) return;
    const x = fillPattern(input.x, digit);
    const y = fillPattern(input.y, digit);
    set({ input: null });
    if (input.source === 'card') {
      useHintFormBridge.getState().setCoords(x, y);
    } else if (input.articleId !== null && input.area) {
      pendingCount += 1;
      set({ pendingAnswer: { id: pendingCount, articleId: input.articleId, area: input.area, text: guessAnswerText(x, y, input.format) } });
      useIntelStore.getState().openIntel(input.articleId, input.area);
    }
  },
  clearPending: (id) => {
    if (get().pendingAnswer?.id === id) set({ pendingAnswer: null });
  },
}));

export default useHintGuessStore;
```

- [ ] **Step 4: Run the store test**

Run: `npx bun test src/stores/hint-guess.store.test.ts`
Expected: all PASS.

- [ ] **Step 5: Add the colour tokens to `src/index.css`**

In `:root`, directly after `--fox-on-ov-container: #1a0f5c;`:

```css
  /* Partly solved hint: unknown digit boxes and the candidate dots/area on the map (lib/hint-guess.ts) */
  --guess: #7b61d1;
  --guess-container: #e8e2f8;
  --on-guess-container: #3b2a73;
```

In `.dark`, directly after `--fox-on-ov-container: #e5deff;`:

```css
  --guess: #b9a6ff;
  --guess-container: #352a5c;
  --on-guess-container: #e3dbff;
```

In the theme block, directly after `--color-fox-ov-container: var(--fox-ov-container);`:

```css
  --color-guess: var(--guess);
  --color-guess-container: var(--guess-container);
  --color-on-guess-container: var(--on-guess-container);
```

- [ ] **Step 6: Add the layers to `MAP_LAYER_STACK` in `src/lib/map-layers.ts`**

Add the import next to the other layer-id imports:

```ts
import { HINT_GUESS_AREA_FILL_LAYER, HINT_GUESS_AREA_LINE_LAYER, HINT_GUESS_REACH_LAYER } from '@/lib/hint-guess';
```

In `MAP_LAYER_STACK`, append the three ids to the end of the second group (the one starting with `'device-accuracy-fill'`, ending with `'marker-trails-line'`):

```ts
  ['device-accuracy-fill', LIFE360_ACCURACY_LAYER, HUNT_ACCURACY_FILL_LAYER, HUNT_ACCURACY_LINE_LAYER, HUNT_ACCURACY_ESTIMATE_LINE_LAYER, 'prediction-areas-fill', 'prediction-areas-line', 'prediction-pin-lines', 'circle-layer-home', 'team-circles-fill', 'marker-trails-line', HINT_GUESS_REACH_LAYER, HINT_GUESS_AREA_FILL_LAYER, HINT_GUESS_AREA_LINE_LAYER],
```

(The dots are HTML markers, always above the canvas layers.)

- [ ] **Step 7: Create `src/components/layers/HintGuess.tsx`**

```tsx
import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckIcon } from 'lucide-react';
import { Layer, Marker, Source, useMap, type FillLayerSpecification, type LineLayerSpecification } from 'react-map-gl/maplibre';
import { useMarkers } from '@/hooks/markers.hook';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import {
  guessBounds, guessShapes, HINT_GUESS_AREA_FILL_LAYER, HINT_GUESS_AREA_LINE_LAYER, HINT_GUESS_REACH_LAYER, HINT_GUESS_SOURCE,
  lastFoxFix, parseGuess, rankGuess,
} from '@/lib/hint-guess';
import { INTEL_CLOSE_MS } from '@/lib/intel-window';
import { cn } from '@/lib/utils';
import useHintGuessStore from '@/stores/hint-guess.store';

const AREA_FILTER: FillLayerSpecification['filter'] = ['==', ['get', 'role'], 'area'];
const REACH_FILTER: LineLayerSpecification['filter'] = ['==', ['get', 'role'], 'reach'];

/**
 * The partly solved hint being typed (hint card or Intel row): numbered candidate dots (tap = fill in that digit), or
 * the rectangle of everything that could match, plus the red dashed reach of the fox since its last known spot.
 */
export default function HintGuess() {
  const input = useHintGuessStore((state) => state.input);
  const pick = useHintGuessStore((state) => state.pick);
  const clear = useHintGuessStore((state) => state.clear);
  const { markers } = useMarkers();
  const dark = useDarkMode();
  const map = useMap().current;

  const guess = useMemo(() => (input ? parseGuess(input.x, input.y) : null), [input]);
  const fix = useMemo(() => (input?.area && input.at !== null ? lastFoxFix(markers, input.area, input.at) : null), [input, markers]);
  const rank = useMemo(() => (guess ? rankGuess(guess, fix, input?.at ?? null) : null), [guess, fix, input]);
  const shapes = useMemo(() => guessShapes(guess, rank), [guess, rank]);

  // Fly to the candidates when the guess itself changes (from Intel: once the window has closed)
  const fitKey = input ? `${input.source}|${input.x}|${input.y}|${input.area}` : '';
  useEffect(() => {
    if (!map || !guess || !input) return;
    const bounds = guessBounds(guess, fix);
    if (!bounds) return;
    const timer = setTimeout(() => map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1200 }), input.source === 'intel' ? INTEL_CLOSE_MS : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the guess changes, not on every marker poll
  }, [map, fitKey]);

  // Escape takes the guess off the map
  useEffect(() => {
    if (!input) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input, clear]);

  const purple = dark ? '#b9a6ff' : '#7b61d1';
  const red = dark ? '#ffb4ab' : '#ba1a1a';
  const points = guess?.kind === 'points' ? guess.points : [];
  const keyBase = input ? `${input.x}|${input.y}` : '';

  return (
    <>
      <Source id={HINT_GUESS_SOURCE} type="geojson" data={shapes}>
        <Layer id={HINT_GUESS_REACH_LAYER} type="line" filter={REACH_FILTER} paint={{ 'line-color': red, 'line-width': 2, 'line-dasharray': [2, 2] }} />
        <Layer id={HINT_GUESS_AREA_FILL_LAYER} type="fill" filter={AREA_FILTER} paint={{ 'fill-color': purple, 'fill-opacity': 0.15 }} />
        <Layer id={HINT_GUESS_AREA_LINE_LAYER} type="line" filter={AREA_FILTER} paint={{ 'line-color': purple, 'line-width': 2, 'line-dasharray': [3, 2] }} />
      </Source>
      <AnimatePresence>
        {points.map((point, index) => {
          const role = rank?.roles[index] ?? 'in';
          return (
            <Marker key={`${keyBase}|${point.digit}`} longitude={point.lng} latitude={point.lat} anchor="center"
                    onClick={(event) => {
                      event.originalEvent.stopPropagation();
                      pick(point.digit);
                    }}>
              <motion.button
                type="button"
                aria-label={guess?.kind === 'points' && guess.collapsed ? 'Gebruik deze plek' : `Gebruik cijfer ${point.digit}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: role === 'out' ? 0.4 : 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                className={cn(
                  'flex cursor-pointer items-center justify-center rounded-full font-bold tabular-nums shadow-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  role === 'best'
                    ? 'size-7 bg-guess text-[12px] text-card ring-4 ring-guess/30'
                    : 'size-[22px] bg-card text-[11px] text-on-guess-container ring-2 ring-guess',
                )}
              >
                {guess?.kind === 'points' && guess.collapsed ? <CheckIcon aria-hidden className="size-3.5" /> : point.digit}
              </motion.button>
            </Marker>
          );
        })}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 8: Mount it in `src/components/Map.tsx`**

Add the import next to `import HuntAccuracy from './layers/HuntAccuracy';`:

```tsx
import HintGuess from './layers/HintGuess';
```

Directly after `{!wall && <HuntFocus/>}`:

```tsx
                {!wall && <HintGuess/>}
```

- [ ] **Step 9: Verify**

Run: `npx bun test src/lib/hint-guess.test.ts src/stores/hint-guess.store.test.ts src/lib/map-layers.test.ts && npx bun run lint && npx bun run build`
Expected: tests PASS, lint clean, build succeeds. If lint flags the `eslint-disable-next-line` as unused, remove that comment line.

- [ ] **Step 10: Commit**

```bash
git add src/stores/hint-guess.store.ts src/stores/hint-guess.store.test.ts src/components/layers/HintGuess.tsx src/lib/map-layers.ts src/components/Map.tsx src/index.css
git commit -m "feat(hints): map layer and store for partly solved hint candidates"
```

---

### Task 3: Hint registreren card with `?` boxes

**Files:**
- Modify: `src/components/cards/hint-entry/DigitBoxes.tsx`
- Modify: `src/components/cards/hint-entry/CoordinateStatus.tsx`
- Modify: `src/components/cards/hint-entry/HintEntryCard.tsx`

**Interfaces:**
- Consumes: Task 1 `sanitizeDigits`, `hasWildcard`, `parseGuess`, `guessStatus`, `GuessStatus`; Task 2 `useHintGuessStore` (`show`, `clear`), `--guess*` Tailwind colours.
- Produces: `CoordinateStatus` gets an optional prop `guess?: GuessStatus | null`.

- [ ] **Step 1: `DigitBoxes.tsx` accepts `?`**

Replace the import line `import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from 'input-otp';` with:

```tsx
import { OTPInput, OTPInputContext } from 'input-otp';
import { sanitizeDigits } from '@/lib/hint-guess';
```

Update the `/** All 6 digits entered … */` doc block above the component to mention wildcards, and replace the component body:

```tsx
/**
 * One RD coordinate: axis label and 6 digit boxes (input-otp keeps paste, the keyboard and focus handling). A box also
 * takes '?' for an unknown digit; '.', ',', '*', '-' and space become '?' too (a phone's number pad has no '?').
 */
export default function DigitBoxes({ id, label, bad, onChange, ...field }: DigitBoxesProps) {
  return (
    <div className="grid grid-cols-[16px_1fr] items-center gap-1">
      <label htmlFor={id} className="text-xs font-bold text-muted-foreground">{label}</label>
      <OTPInput
        id={id}
        autoComplete="off"
        // decimal: the number pad with a '.' or ',' key for unknown digits
        inputMode="decimal"
        maxLength={6}
        aria-invalid={bad || undefined}
        containerClassName="grid grid-cols-6 gap-1"
        onChange={(value) => onChange(sanitizeDigits(value))}
        {...field}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => <DigitSlot key={index} index={index} bad={bad} />)}
      </OTPInput>
    </div>
  );
}
```

In `DigitSlot`, replace the fill class expression line
`!char ? 'bg-card' : bad ? 'bg-fox-error-container text-fox-on-error' : 'bg-primary-container text-on-primary-container',`
with:

```tsx
        !char
          ? 'bg-card'
          : char === '?'
            ? 'bg-guess-container text-on-guess-container [outline:1.5px_dashed_var(--guess)] [outline-offset:-1.5px]'
            : bad
              ? 'bg-fox-error-container text-fox-on-error'
              : 'bg-primary-container text-on-primary-container',
```

and update its doc comment to: `/** Card-coloured box; the box being typed in gets a primary ring, filled boxes an orange (or red) tonal fill, an unknown digit a dashed purple one. */`

- [ ] **Step 2: `CoordinateStatus.tsx` shows a guess line**

Replace the file with:

```tsx
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheckIcon, CircleHelpIcon, KeyboardIcon, TriangleAlertIcon } from 'lucide-react';
import type { GuessStatus } from '@/lib/hint-guess';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type CoordinateState = 'idle' | 'inside' | 'outside';

const STATES = {
  idle: { Icon: KeyboardIcon, text: 'Tik op de vakjes om te typen', className: 'text-muted-foreground' },
  inside: { Icon: CircleCheckIcon, text: 'Ligt in Nederland', className: 'text-fox-ok' },
  outside: { Icon: TriangleAlertIcon, text: 'Buiten Nederland', className: 'text-fox-error' },
} as const;

/** Live check under the digit boxes: typing hint, inside the Netherlands, outside, or (with a '?') the guess line. */
export default function CoordinateStatus({ state, guess }: { state: CoordinateState; guess?: GuessStatus | null }) {
  const view = guess
    ? guess.tone === 'warn'
      ? { Icon: TriangleAlertIcon, text: guess.text, className: 'text-fox-error' }
      : { Icon: CircleHelpIcon, text: guess.text, className: 'text-on-guess-container' }
    : STATES[state];
  const { Icon, text, className } = view;
  return (
    <p role="status" aria-live="polite" className="min-w-0 flex-1 text-[11px] font-medium">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={text} {...SWAP} className={cn('inline-flex items-center gap-1.5', className)}>
          <Icon aria-hidden className="size-3 shrink-0" />
          {text}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}
```

- [ ] **Step 3: `HintEntryCard.tsx` drives the guess**

Add imports:

```tsx
import {guessStatus, hasWildcard, parseGuess} from '@/lib/hint-guess';
import useHintGuessStore from '@/stores/hint-guess.store';
```

Replace the block from `// Live check once both coordinates are complete` through the `coordinateState` line with:

```tsx
    // A '?' in a box is an unknown digit: the candidates go on the map (lib/hint-guess.ts) and Registreren waits
    const wildcard = hasWildcard(xValue ?? '', yValue ?? '');
    const complete = xValue?.length === 6 && yValue?.length === 6;
    // Live check once both coordinates are complete: hints are always in the Netherlands
    const typedLocation = complete && !wildcard ? fromRD(Number(xValue), Number(yValue)) : undefined;
    const outsideNetherlands = !!typedLocation && !isInNetherlands(typedLocation[0], typedLocation[1]);
    // Hours for the chosen area; hours that already have a hint are kept but marked taken
    const hours = hintHours(selectedArea);
    const days = groupByDay(hours);

    // setValue without validation doesn't update formState.isValid in onSubmit mode, so derive from values.
    // The chosen hour is rechecked: a teammate can register it while this form is open.
    const canSubmit = !!selectedArea && !!timeValue && complete && !wildcard && !outsideNetherlands
        && isFreeHour(hours, timeValue);
    const coordinateState: CoordinateState = outsideNetherlands ? 'outside' : typedLocation ? 'inside' : 'idle';
    const guess = wildcard && complete ? parseGuess(xValue, yValue) : null;
    const status = wildcard ? guessStatus(guess) : null;

    // Show (or take away) the candidates on the map as the boxes change; picking one fills the boxes via the bridge
    useEffect(() => {
        const {show, clear: clearGuess} = useHintGuessStore.getState();
        if (wildcard && complete) {
            show({source: 'card', x: xValue, y: yValue, area: selectedArea || null, at: timeValue ? Date.parse(timeValue) : null, articleId: null, format: 'split'});
        } else {
            clearGuess('card');
        }
    }, [wildcard, complete, xValue, yValue, selectedArea, timeValue]);
    useEffect(() => () => useHintGuessStore.getState().clear('card'), []);
```

In `clearCoordinates()`, after `form.clearErrors(['x', 'y']);` add:

```tsx
        useHintGuessStore.getState().clear('card');
```

Change `<CoordinateStatus state={coordinateState}/>` to:

```tsx
                    <CoordinateStatus state={coordinateState} guess={status}/>
```

- [ ] **Step 4: Verify**

Run: `npx bun test src/components/cards/hint-entry && npx bun run lint && npx bun run build`
Expected: existing hint-times tests PASS, lint clean, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/cards/hint-entry/DigitBoxes.tsx src/components/cards/hint-entry/CoordinateStatus.tsx src/components/cards/hint-entry/HintEntryCard.tsx
git commit -m "feat(hints): unknown digits in the hint card show candidates on the map"
```

---

### Task 4: Intel hint row with `?`

**Files:**
- Modify: `src/components/intel-window/HintPane.tsx` (`AreaBody`, line ~224 onwards, plus a new `GuessLine` component at the end)

**Interfaces:**
- Consumes: Task 1 `parseGuessAnswer`, `parseGuess`, `guessStatus`, `GuessStatus`; Task 2 `useHintGuessStore` (`show`, `pendingAnswer`, `clearPending`).

- [ ] **Step 1: Imports**

Add to the imports in `HintPane.tsx`:

```tsx
import { type GuessStatus, guessStatus, parseGuess, parseGuessAnswer } from '@/lib/hint-guess';
import useHintGuessStore from '@/stores/hint-guess.store';
```

and change `import { areaOptions, getColorFromArea } from '@/lib/utils';` to:

```tsx
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
```

- [ ] **Step 2: Take a picked answer back into the row**

In `AreaBody`, directly after the `const [popIn, setPopIn] = useState(false);` line, add:

```tsx
  // A candidate picked on the map for this row (Toon op kaart): filled into the field, not saved yet
  const pending = useHintGuessStore((state) => state.pendingAnswer);
  const [usedPending, setUsedPending] = useState<number | null>(null);
  if (pending && pending.id !== usedPending && pending.articleId === cell.articleId && pending.area === cell.area) {
    setUsedPending(pending.id);
    setAnswer(pending.text);
    setTeammate(null);
    setPopIn(false);
    setEditing(true);
  }
  useEffect(() => {
    if (usedPending !== null) useHintGuessStore.getState().clearPending(usedPending);
  }, [usedPending]);
```

(`useEffect` is already imported at the top of the file.)

- [ ] **Step 3: Guess preview and save guard**

Directly after `const shown = settled ? current : line;` add:

```tsx
  // '?' (or '*') for unknown digits: candidates instead of the RD preview, and no saving until it's filled in
  const guessAnswer = editing ? parseGuessAnswer(answer) : null;
  const guess = guessAnswer ? parseGuess(guessAnswer.x, guessAnswer.y) : null;
  const wildcard = editing && /[?*]/.test(answer);
  const canShowGuess = !!guess && (guess.kind === 'points' ? guess.points.length > 0 : !guess.wide);

  function showGuess() {
    if (!guessAnswer) return;
    useHintGuessStore.getState().show({
      source: 'intel',
      x: guessAnswer.x,
      y: guessAnswer.y,
      area: cell.area,
      at: Date.parse(cell.slotTime || cell.publishAt) || null,
      articleId: cell.articleId,
      format: guessAnswer.format,
    });
    close();
  }
```

In `save()`, change `if (!value || saving) return;` to:

```tsx
    if (!value || saving || /[?*]/.test(value)) return;
```

On the Opslaan `Pill`, change `disabled={!answer.trim() || saving}` to:

```tsx
disabled={!answer.trim() || saving || wildcard}
```

Replace the preview `Reveal` block (the one rendering `{shown && (...<PreviewLine preview={shown} />...)}`) with:

```tsx
      <Reveal>
        {shown && !guessAnswer && (
          <div className="pt-2 text-xs">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={shown.kind} {...SWAP}>
                <PreviewLine preview={shown} />
              </motion.p>
            </AnimatePresence>
          </div>
        )}
      </Reveal>
      <Reveal>
        {guessAnswer && (
          <div className="pt-2 text-xs">
            <GuessLine status={guessStatus(guess)} onShow={canShowGuess ? showGuess : undefined} />
          </div>
        )}
      </Reveal>
```

- [ ] **Step 4: `GuessLine` component**

Append at the end of `HintPane.tsx`:

```tsx
/** The preview line for an answer with unknown digits: how many candidates, and a button to see them on the map. */
function GuessLine({ status, onShow }: { status: GuessStatus; onShow?: () => void }) {
  return (
    <span className={cn('flex flex-wrap items-center gap-2', status.tone === 'warn' ? 'text-amber-600 dark:text-amber-300' : 'text-on-guess-container')}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={status.text} {...SWAP}>
          {status.tone === 'warn' ? '⚠ ' : ''}
          {status.text.replace(' · tik er een op de kaart', '').replace(' · tik de stip', '')}
        </motion.span>
      </AnimatePresence>
      {onShow && (
        <Pill onClick={onShow}>
          <MapIcon data-icon="inline-start" /> Toon op kaart
        </Pill>
      )}
    </span>
  );
}
```

(The `⚠` matches the existing `PreviewLine` warnings in this pane.)

- [ ] **Step 5: Verify**

Run: `npx bun test src/lib && npx bun run lint && npx bun run build`
Expected: tests PASS, lint clean, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/intel-window/HintPane.tsx
git commit -m "feat(intel): unknown digits in a hint answer, Toon op kaart picks one"
```

---

### Task 5: Browser check

**Files:** none committed (temporary harness only, as in earlier redesigns).

- [ ] **Step 1: Run the dev server against a local or demo backend**

Run: `npx bun run dev` (with the usual `.env.local`; demo mode gives markers and hints).

- [ ] **Step 2: Hint card**

Pick Alpha + an hour, type X `15?000` (or `15.000` on a phone) and Y `463000`:
- the `?` box is purple and dashed; status "10 mogelijk · tik er een op de kaart" (fewer outside NL); Registreren disabled;
- the map flies to 10 numbered dots; with an earlier Alpha marker a red dashed reach circle, faded dots outside it, one big "best" dot;
- tapping a dot fills the digit, dots fade out, status turns "Ligt in Nederland", Registreren enabled;
- `15??00` → purple rectangle, "Gebied op kaart · vul meer cijfers in"; `1??000` → "Te breed — vul meer cijfers in", nothing drawn; `15500?` → one check dot;
- Wissen and Escape take the dots away. Check light and dark, and phone width (bottom sheet).

- [ ] **Step 3: Intel row**

Open a hint in Intel, type `15?2 4631` in a row: line "10 mogelijk" (or fewer) with "Toon op kaart"; Opslaan disabled. Toon op kaart closes Intel and shows the dots; tapping one reopens Intel on that hint and area with `15x2 4631` filled in, not saved; Opslaan then saves it.

- [ ] **Step 4: Report** what was checked and any deviations; fix in a follow-up commit if needed.
