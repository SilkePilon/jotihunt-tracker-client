import { describe, expect, test } from 'bun:test';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import { filterMarkers, formatMarkerTime, groupMarkersByArea, markerIcon, markerSplitTime } from './markers';

function marker(id: string, area: string, time: string, type = MarkerType.Hint): Marker {
  return { _id: id, area, time: time as unknown as Date, type, location: { type: 'Point', coordinates: [5.9, 52] } };
}

const split = markerSplitTime(new Date(2026, 9, 17, 9, 0));
const markers = [marker('a', 'Alpha', new Date(2026, 9, 17, 22, 0).toISOString()), marker('b', 'Bravo', new Date(2026, 9, 17, 23, 30).toISOString()), marker('c', 'Alpha', new Date(2026, 9, 16, 12, 0).toISOString())];
const all = () => true;

describe('markerSplitTime', () => {
  test('23:00 local time on the hunt start day', () => {
    expect(split.getFullYear()).toBe(2026);
    expect(split.getDate()).toBe(17);
    expect(split.getHours()).toBe(23);
    expect(split.getMinutes()).toBe(0);
  });
});

describe('filterMarkers', () => {
  test('part 1 is before the split (including pre-hunt), part 2 from the split', () => {
    expect(filterMarkers(markers, { part1: true, part2: false, split, isVisible: all }).map((m) => m._id)).toEqual(['a', 'c']);
    expect(filterMarkers(markers, { part1: false, part2: true, split, isVisible: all }).map((m) => m._id)).toEqual(['b']);
    expect(filterMarkers(markers, { part1: true, part2: true, split, isVisible: all })).toHaveLength(3);
    expect(filterMarkers(markers, { part1: false, part2: false, split, isVisible: all })).toEqual([]);
  });

  test('a marker exactly on the split belongs to part 2', () => {
    const onSplit = [marker('s', 'Alpha', split.toISOString())];
    expect(filterMarkers(onSplit, { part1: true, part2: false, split, isVisible: all })).toEqual([]);
    expect(filterMarkers(onSplit, { part1: false, part2: true, split, isVisible: all })).toHaveLength(1);
  });

  test('hidden areas are dropped', () => {
    const isVisible = (area: string) => area.toLowerCase() !== 'alpha';
    expect(filterMarkers(markers, { part1: true, part2: true, split, isVisible }).map((m) => m._id)).toEqual(['b']);
  });
});

describe('groupMarkersByArea', () => {
  test('groups per area, oldest first, without mutating the input', () => {
    const input = [...markers];
    const groups = groupMarkersByArea(input);
    expect(Object.keys(groups).sort()).toEqual(['Alpha', 'Bravo']);
    expect(groups.Alpha.map((m) => m._id)).toEqual(['c', 'a']);
    expect(input).toEqual(markers);
  });

  test('empty input gives no groups', () => {
    expect(groupMarkersByArea([])).toEqual({});
  });
});

describe('markerIcon', () => {
  test('one icon per type, plain fox otherwise', () => {
    expect(markerIcon(MarkerType.Hint)).toContain('fox-hint');
    expect(markerIcon(MarkerType.Hunt)).toContain('fox-hunt');
    expect(markerIcon(MarkerType.Spot)).toContain('fox-spot');
    expect(markerIcon('other' as MarkerType)).toMatch(/fox\.svg$/);
  });
});

describe('formatMarkerTime', () => {
  test('two-digit hours and minutes', () => {
    expect(formatMarkerTime(new Date(2026, 9, 17, 9, 5))).toBe('09:05');
  });
});
