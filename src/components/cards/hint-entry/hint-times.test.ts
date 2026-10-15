import { describe, expect, test } from 'bun:test';
import { buildHintHours, dayKey, defaultDay, groupByDay, isFreeHour, shortLabel } from './hint-times';
import { MarkerType } from '@/types/MarkerType';
import type { Marker } from '@/types/Marker';

const START = new Date(2026, 9, 17, 10);
const END = new Date(2026, 9, 18, 12);

function hint(area: string, time: Date, type = MarkerType.Hint): Marker {
  return { area, time, type, location: { type: 'Point', coordinates: [5, 52] } };
}

describe('buildHintHours', () => {
  test('lists every started hour from the start up to now', () => {
    const hours = buildHintHours(START, END, new Date(2026, 9, 17, 13, 30), [], 'alpha');
    expect(hours.map((h) => h.label)).toEqual(['10:00', '11:00', '12:00', '13:00']);
    expect(hours[0]).toEqual({ value: new Date(2026, 9, 17, 10).toISOString(), label: '10:00', day: '2026-10-17', taken: false });
  });

  test('stops at the hunt end once the hunt is over', () => {
    const hours = buildHintHours(START, END, new Date(2026, 9, 20), [], 'alpha');
    expect(hours).toHaveLength(26);
    expect(hours.at(-1)?.label).toBe('11:00');
    expect(hours.at(-1)?.day).toBe('2026-10-18');
  });

  test('is empty before the hunt starts', () => {
    expect(buildHintHours(START, END, new Date(2026, 9, 16), [], 'alpha')).toEqual([]);
  });

  test('marks hours that already have a hint for this area as taken', () => {
    const markers = [
      hint('alpha', new Date(2026, 9, 17, 11, 20)),
      hint('bravo', new Date(2026, 9, 17, 12, 5)),
      hint('alpha', new Date(2026, 9, 17, 12, 0), MarkerType.Hunt),
    ];
    const hours = buildHintHours(START, END, new Date(2026, 9, 17, 13, 30), markers, 'alpha');
    expect(hours.map((h) => h.taken)).toEqual([false, true, false, false]);
  });

  test('a hint on the same hour of another day does not count', () => {
    const markers = [hint('alpha', new Date(2026, 9, 18, 10, 0))];
    const hours = buildHintHours(START, END, new Date(2026, 9, 17, 11, 30), markers, 'alpha');
    expect(hours[0].taken).toBe(false);
  });

  test('accepts missing markers', () => {
    expect(buildHintHours(START, END, new Date(2026, 9, 17, 10, 30), undefined, 'alpha')).toHaveLength(1);
  });
});

describe('groupByDay', () => {
  test('splits the hours per calendar day with the Dutch weekday', () => {
    const days = groupByDay(buildHintHours(START, END, new Date(2026, 9, 18, 1, 30), [], 'alpha'));
    expect(days.map((d) => [d.key, d.label, d.hours.length])).toEqual([
      ['2026-10-17', 'Zaterdag', 14],
      ['2026-10-18', 'Zondag', 2],
    ]);
  });

  test('is empty without hours', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('defaultDay', () => {
  test('picks the day of the latest free hour', () => {
    const days = groupByDay(buildHintHours(START, END, new Date(2026, 9, 18, 1, 30), [], 'alpha'));
    expect(defaultDay(days)).toBe('2026-10-18');
  });

  test('skips a day whose hours are all taken', () => {
    const markers = [hint('alpha', new Date(2026, 9, 18, 0, 10)), hint('alpha', new Date(2026, 9, 18, 1, 10))];
    const days = groupByDay(buildHintHours(START, END, new Date(2026, 9, 18, 1, 30), markers, 'alpha'));
    expect(defaultDay(days)).toBe('2026-10-17');
  });

  test('falls back to the last day when every hour is taken', () => {
    const markers = [hint('alpha', new Date(2026, 9, 17, 10, 10))];
    const days = groupByDay(buildHintHours(START, END, new Date(2026, 9, 17, 10, 30), markers, 'alpha'));
    expect(defaultDay(days)).toBe('2026-10-17');
  });

  test('is undefined without days', () => {
    expect(defaultDay([])).toBeUndefined();
  });
});

describe('labels', () => {
  test('dayKey uses the local date', () => {
    expect(dayKey(new Date(2026, 9, 18, 0, 5))).toBe('2026-10-18');
  });

  test('shortLabel shows the short weekday and hour', () => {
    expect(shortLabel(new Date(2026, 9, 17, 14).toISOString())).toBe('za 14:00');
    expect(shortLabel(new Date(2026, 9, 18, 9).toISOString())).toBe('zo 09:00');
  });
});

describe('isFreeHour', () => {
  const hours = buildHintHours(START, END, new Date(2026, 9, 17, 12, 30), [hint('alpha', new Date(2026, 9, 17, 11))], 'alpha');

  test('true for a listed hour that is not taken', () => {
    expect(isFreeHour(hours, hours[0].value)).toBe(true);
  });

  test('false for a taken hour, an unknown hour or empty', () => {
    expect(isFreeHour(hours, hours[1].value)).toBe(false);
    expect(isFreeHour(hours, new Date(2026, 9, 19, 10).toISOString())).toBe(false);
    expect(isFreeHour(hours, '')).toBe(false);
  });
});
