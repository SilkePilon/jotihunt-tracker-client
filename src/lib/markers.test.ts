import { describe, expect, test } from 'bun:test';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';
import { filterMarkers, groupMarkersByArea, markerDeleteDescription, markerSplitTime, markerTimeLabel } from './markers';

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

  test('without a split every marker is in part 1', () => {
    expect(filterMarkers(markers, { part1: true, part2: false, isVisible: all })).toHaveLength(3);
    expect(filterMarkers(markers, { part1: false, part2: true, isVisible: all })).toEqual([]);
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

describe('markerDeleteDescription', () => {
  test('names the type, area and time', () => {
    expect(markerDeleteDescription(marker('1', 'alpha', '2026-10-17T20:00:00Z', MarkerType.Hunt), '22:00')).toBe(
      'De hunt van Alpha (22:00) verdwijnt voor iedereen van de kaart. Dit kan niet ongedaan worden gemaakt.',
    );
  });
});

describe('markerTimeLabel', () => {
  // Saturday 17 October 2026, 14:00 in Amsterdam (CEST, UTC+2)
  const now = Date.parse('2026-10-17T12:00:00Z');

  test('under 2 hours old: clock time and age to the minute', () => {
    expect(markerTimeLabel('2026-10-17T11:15:00Z', now)).toBe('13:15 · 45 min geleden');
    expect(markerTimeLabel(new Date('2026-10-17T10:48:00Z'), now)).toBe('12:48 · 1 u 12 min geleden');
    expect(markerTimeLabel('2026-10-17T11:00:00Z', now)).toBe('13:00 · 1 u geleden');
    expect(markerTimeLabel('2026-10-17T11:59:30Z', now)).toBe('13:59 · zojuist');
    expect(markerTimeLabel('2026-10-17T10:00:01Z', now)).toBe('12:00 · 1 u 59 min geleden');
  });

  test('2 hours or older today: only the clock time', () => {
    expect(markerTimeLabel('2026-10-17T10:00:00Z', now)).toBe('12:00');
  });

  test('older today: the clock time', () => {
    expect(markerTimeLabel('2026-10-17T08:12:00Z', now)).toBe('10:12');
  });

  test('another day: weekday and clock time', () => {
    expect(markerTimeLabel('2026-10-16T21:30:00Z', now)).toBe('vr 23:30');
  });

  test('in the future: the clock time', () => {
    expect(markerTimeLabel('2026-10-17T12:30:00Z', now)).toBe('14:30');
  });
});
