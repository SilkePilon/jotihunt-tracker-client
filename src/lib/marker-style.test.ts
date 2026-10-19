import { describe, expect, test } from 'bun:test';
import type { HintBoard, HintCell } from '@/types/HintCell';
import {
  areaKey,
  areaLetter,
  contrastRatio,
  foxStatus,
  groupColors,
  HINT_LABEL_MS,
  hintIconKey,
  hintNumbering,
  MARKER_PALETTES,
  markerIconId,
  type MarkerIconKey,
  parseMarkerImageId,
  statusColors,
  themedImageId,
  vehicleGlyph,
} from './marker-style';
import { getColorFromArea } from './utils';

const AREAS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'oscar'];

describe('foxStatus', () => {
  test('green, orange and red; anything else counts as red (inactive)', () => {
    expect(foxStatus('green')).toBe('green');
    expect(foxStatus('orange')).toBe('orange');
    expect(foxStatus('red')).toBe('red');
    expect(foxStatus('purple')).toBe('red');
    expect(foxStatus(undefined)).toBe('red');
  });
});

describe('statusColors', () => {
  test('the Android ok / warn / error container roles, per theme', () => {
    expect(statusColors('green', MARKER_PALETTES.light)).toEqual({ container: '#b7f2ae', on: '#0b3a0e' });
    expect(statusColors('orange', MARKER_PALETTES.light)).toEqual({ container: '#ffddb8', on: '#2c1600' });
    expect(statusColors('red', MARKER_PALETTES.light)).toEqual({ container: '#ffdad6', on: '#93000a' });
    expect(statusColors('green', MARKER_PALETTES.dark)).toEqual({ container: '#1e5120', on: '#b7f2ae' });
    expect(statusColors('orange', MARKER_PALETTES.dark)).toEqual({ container: '#693c00', on: '#ffddb8' });
    expect(statusColors('red', MARKER_PALETTES.dark)).toEqual({ container: '#93000a', on: '#ffdad6' });
  });
});

describe('areas', () => {
  test('areaKey normalises names from /areas, /teams and /markers', () => {
    expect(areaKey('Alpha')).toBe('alpha');
    expect(areaKey(' oscar ')).toBe('oscar');
    expect(areaKey('Zulu')).toBeUndefined();
    expect(areaKey(undefined)).toBeUndefined();
  });

  test('areaLetter is the first letter, none for unknown areas', () => {
    expect(AREAS.map(areaLetter).join('')).toBe('ABCDEFGHO');
    expect(areaLetter('none')).toBe('');
  });
});

describe('groupColors', () => {
  test('filled with the area colour (the website palette), glyph in the readable of white / near-black', () => {
    for (const area of AREAS) {
      const { fill, on } = groupColors(area);
      expect(fill).toBe(getColorFromArea(area));
      expect(contrastRatio(fill, on)).toBeGreaterThanOrEqual(3);
    }
    expect(groupColors('hotel').on).toBe('#ffffff');
    expect(groupColors('delta').on).toBe('#191d17');
  });

  test('a team without a known area has no fill', () => {
    expect(groupColors('none')).toBeUndefined();
  });

  test('contrastRatio is the WCAG ratio', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('palette', () => {
  test('the website orange in the primary roles, readable, and clearly apart from the status green', () => {
    for (const palette of Object.values(MARKER_PALETTES)) {
      expect(palette.primary).toBe('#ea580c');
      expect(contrastRatio(palette.primary, palette.onPrimary)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(palette.primaryContainer, palette.onPrimaryContainer)).toBeGreaterThanOrEqual(4.5);
      expect(palette.primary).not.toBe(palette.ok);
    }
  });
});

describe('vehicleGlyph', () => {
  test('Material Symbols per vehicle, person when the device has no vehicle', () => {
    expect(vehicleGlyph('walking')).toBe('directions_walk');
    expect(vehicleGlyph('bike')).toBe('directions_bike');
    expect(vehicleGlyph('car')).toBe('directions_car');
    expect(vehicleGlyph('motorcycle')).toBe('two_wheeler');
    expect(vehicleGlyph('phone')).toBe('person');
  });
});

describe('marker image ids', () => {
  const keys: MarkerIconKey[] = [
    { kind: 'hunter', icon: 'car', stale: false },
    { kind: 'hunter', icon: 'phone', stale: true },
    { kind: 'fox', type: 'spot', status: 'green', area: 'alpha', locked: false },
    { kind: 'fox', type: 'hunt', status: 'red', area: 'oscar', locked: false },
    { kind: 'fox', type: 'other', status: 'orange', area: 'none', locked: false },
    { kind: 'fox', type: 'spot', status: 'green', area: 'alpha', locked: true },
    { kind: 'fox', type: 'hunt', status: 'orange', area: 'bravo', locked: true },
    { kind: 'hint', area: 'bravo', label: 'H3' },
    { kind: 'hint', area: 'bravo', label: '14:00' },
    { kind: 'hint', area: 'bravo', label: '' },
    { kind: 'hintdot' },
    { kind: 'group', area: 'delta', visited: false },
    { kind: 'group', area: 'none', visited: true },
    { kind: 'prediction', area: 'echo', stale: false, locked: false },
    { kind: 'prediction', area: 'echo', stale: true, locked: false },
    { kind: 'prediction', area: 'golf', stale: false, locked: true },
    { kind: 'prediction', area: 'golf', stale: true, locked: true },
    { kind: 'arrow' },
  ];

  test('round-trip every key in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const key of keys) {
        expect(parseMarkerImageId(themedImageId(theme, markerIconId(key)))).toEqual({ theme, key });
      }
    }
  });

  test('ids are readable; locked adds a suffix and leaves the other ids as they were', () => {
    expect(markerIconId({ kind: 'fox', type: 'spot', status: 'green', area: 'alpha', locked: false })).toBe('fox|spot|green|alpha');
    expect(markerIconId({ kind: 'fox', type: 'spot', status: 'green', area: 'alpha', locked: true })).toBe('fox|spot|green|alpha|locked');
    expect(markerIconId({ kind: 'prediction', area: 'echo', stale: false, locked: false })).toBe('predict|echo|live');
    expect(markerIconId({ kind: 'prediction', area: 'echo', stale: true, locked: true })).toBe('predict|echo|stale|locked');
    expect(themedImageId('dark', 'hintdot')).toBe('jh|dark|hintdot');
  });

  test('ids from before the locked flag still parse as unlocked', () => {
    expect(parseMarkerImageId('jh|light|fox|hunt|red|oscar')).toEqual({ theme: 'light', key: { kind: 'fox', type: 'hunt', status: 'red', area: 'oscar', locked: false } });
    expect(parseMarkerImageId('jh|dark|predict|echo|live')).toEqual({ theme: 'dark', key: { kind: 'prediction', area: 'echo', stale: false, locked: false } });
  });

  test('other or malformed ids are not ours', () => {
    for (const id of ['fox-hint', 'hunter|car|live', 'jh|sepia|hintdot', 'jh|light|fox|spot|blue|alpha', 'jh|light|hunter|boat|live', 'jh|light|group|delta', 'jh|light|nope', 'jh|light|fox|spot|green|alpha|nope', 'jh|light|fox|spot|green|alpha|locked|locked', 'jh|light|predict|echo|live|x', 'jh|light|group|delta|open|locked', 'jh|light|hint|alpha|H3|locked']) {
      expect(parseMarkerImageId(id)).toBeUndefined();
    }
  });

  test('a hint label may contain the separator-free clock and a dot', () => {
    expect(parseMarkerImageId('jh|light|hint|alpha|09:05')).toEqual({ theme: 'light', key: { kind: 'hint', area: 'alpha', label: '09:05' } });
  });
});

describe('hintIconKey', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');

  test('recent hints get "H<n>" when the board knows the number, else the clock', () => {
    expect(hintIconKey('alpha', now - 60_000, 3, now, '11:59')).toEqual({ kind: 'hint', area: 'alpha', label: 'H3' });
    expect(hintIconKey('alpha', now - 60_000, undefined, now, '11:59')).toEqual({ kind: 'hint', area: 'alpha', label: '11:59' });
  });

  test('hints older than six hours are only a dot (exactly six hours still has its label)', () => {
    expect(hintIconKey('alpha', now - HINT_LABEL_MS, 3, now, 'x')).toEqual({ kind: 'hint', area: 'alpha', label: 'H3' });
    expect(hintIconKey('alpha', now - HINT_LABEL_MS - 1, 3, now, 'x')).toEqual({ kind: 'hintdot' });
  });
});

describe('hintNumbering', () => {
  const HUNT = { startMs: Date.parse('2026-10-17T08:00:00Z'), endMs: Date.parse('2026-10-18T10:00:00Z') };
  const cell = (articleId: number, area: string, slotTime: string, extra: Partial<HintCell> = {}): HintCell =>
    ({ _id: `${articleId}-${area}`, articleId, area, publishAt: slotTime, slotTime, status: 'open', check: 'unchecked', notes: [], articleChanged: false, ...extra }) as HintCell;
  const article = (id: number, publishAt: string) => ({ id, title: `Hint ${id}`, publishAt, content: '' });

  test('game hints numbered oldest first; seeded test hints and pre-hunt hints are skipped once the hunt has hints', () => {
    const board: HintBoard = {
      articles: [article(12, '2026-10-17T10:00:00Z'), article(11, '2026-10-17T09:00:00Z'), article(900_001, '2026-10-17T09:30:00Z'), article(5, '2026-10-10T09:00:00Z')],
      cells: [cell(11, 'alpha', '2026-10-17T09:00:00Z', { markerId: 'm1' }), cell(12, 'alpha', '2026-10-17T10:00:00Z'), cell(12, 'bravo', '2026-10-17T10:00:00Z', { status: 'none' })],
    };
    const numbering = hintNumbering(board, HUNT);
    expect(numbering.numberOf('m1', 'alpha', 0)).toBe(1);
    expect(numbering.numberOf('other', 'alpha', Date.parse('2026-10-17T10:00:00Z'))).toBe(2);
    // "geen hint" cells don't claim their slot
    expect(numbering.numberOf('other', 'bravo', Date.parse('2026-10-17T10:00:00Z'))).toBeUndefined();
  });

  test('before the hunt (development) every non-seeded hint is numbered', () => {
    const board: HintBoard = { articles: [article(5, '2026-10-10T09:00:00Z'), article(6, '2026-10-10T10:00:00Z')], cells: [cell(6, 'alpha', '2026-10-10T10:00:00Z')] };
    expect(hintNumbering(board, HUNT).numberOf('x', 'alpha', Date.parse('2026-10-10T10:00:00Z'))).toBe(2);
  });

  test('no board: no numbers', () => {
    expect(hintNumbering(undefined, HUNT).numberOf('m1', 'alpha', 0)).toBeUndefined();
  });
});

describe('fastfood icon ids', () => {
  test('id format', () => {
    expect(markerIconId({ kind: 'fastfood', brand: 'kfc', closed: false })).toBe('fastfood|kfc|open');
    expect(markerIconId({ kind: 'fastfood', brand: 'burgerking', closed: true })).toBe('fastfood|burgerking|closed');
  });
  test('round trip', () => {
    for (const brand of ['mcdonalds', 'kfc', 'burgerking'] as const) {
      for (const closed of [false, true]) {
        const key = { kind: 'fastfood' as const, brand, closed };
        expect(parseMarkerImageId(themedImageId('dark', markerIconId(key)))).toEqual({ theme: 'dark', key });
      }
    }
  });
  test('unknown brand or state is not ours', () => {
    expect(parseMarkerImageId('jh|light|fastfood|subway|open')).toBeUndefined();
    expect(parseMarkerImageId('jh|light|fastfood|kfc|maybe')).toBeUndefined();
  });
});
