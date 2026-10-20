import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { editionMeta, isArchiveError } from './editions';

const base = { year: 2026, live: false, shown: false, huntStart: '2026-10-17T08:00:00Z', huntEnd: '2026-10-18T10:00:00Z', hunts: 38, points: 1204 };

describe('editionMeta', () => {
  test('live: dates and hunts', () => {
    expect(editionMeta({ ...base, live: true })).toBe('Live · za 17 – zo 18 okt · 38 hunts');
  });
  test('archive: hunts and points', () => {
    expect(editionMeta(base)).toBe('Archief · 38 hunts · 1.204 punten');
  });
  test('live without hunt times, archive without score', () => {
    expect(editionMeta({ ...base, live: true, huntStart: null, huntEnd: null, hunts: 0 })).toBe('Live · 0 hunts');
    expect(editionMeta({ ...base, points: null, hunts: 1 })).toBe('Archief · 1 hunt');
  });
});

test('isArchiveError: 423 only', () => {
  const err = (status: number) => new AxiosError('x', 'E', undefined, undefined, { status, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } });
  expect(isArchiveError(err(423))).toBe(true);
  expect(isArchiveError(err(409))).toBe(false);
});
