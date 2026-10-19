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
    const [minLng] = fromRD(150000, 462950);
    expect(narrow.ring[0][0]).toBeCloseTo(minLng, 6);
    const wide = parseGuess('1??000', '463000');
    expect(wide?.kind === 'area' && wide.wide).toBe(true);
  });
  test('a ? on one axis only draws a visible strip around the known axis', () => {
    const strip = parseGuess('15??00', '463000');
    if (strip?.kind !== 'area') throw new Error('expected an area');
    const lats = strip.ring.map(([, lat]) => lat);
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(0);
    const [minLng, minLat] = fromRD(150000, 462950);
    const [maxLng, maxLat] = fromRD(159900, 463050);
    expect(strip.ring[0][0]).toBeCloseTo(minLng, 6);
    expect(strip.ring[0][1]).toBeCloseTo(minLat, 6);
    const far = strip.ring[32]; // third corner: (maxX, maxY)
    expect(far[0]).toBeCloseTo(maxLng, 6);
    expect(far[1]).toBeCloseTo(maxLat, 6);
  });
  test('a 4-digit ? covers the whole last hectometre cell', () => {
    const strip = parseGuess('15??', '4630');
    if (strip?.kind !== 'area') throw new Error('expected an area');
    const [maxLng, minLat] = fromRD(160000, 462950);
    expect(strip.ring[16][0]).toBeCloseTo(maxLng, 6); // second corner: (maxX, minY)
    expect(strip.ring[16][1]).toBeCloseTo(minLat, 6);
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
    const card = (status: ReturnType<typeof guessStatus>) => status.text + (status.action ?? '');
    expect(guessStatus(parseGuess('15?000', '463000'))).toEqual({ tone: 'guess', text: '10 mogelijk', action: ' · tik er een op de kaart' });
    expect(card(guessStatus(parseGuess('15?000', '463000')))).toBe('10 mogelijk · tik er een op de kaart');
    expect(guessStatus(parseGuess('15500?', '463000'))).toEqual({ tone: 'guess', text: 'Onbekend cijfer maakt niet uit', action: ' · tik de stip' });
    expect(card(guessStatus(parseGuess('15500?', '463000')))).toBe('Onbekend cijfer maakt niet uit · tik de stip');
    expect(guessStatus(parseGuess('15??00', '463000'))).toEqual({ tone: 'guess', text: 'Gebied op kaart · vul meer cijfers in' });
    expect(guessStatus(parseGuess('1??000', '463000'))).toEqual({ tone: 'warn', text: 'Te breed — vul meer cijfers in' });
    expect(guessStatus({ kind: 'points', points: [], collapsed: false })).toEqual({ tone: 'warn', text: 'Geen mogelijkheden in Nederland' });
    expect(guessStatus(null).text).toBe('Vul alle vakjes in · ? = onbekend');
  });
});
