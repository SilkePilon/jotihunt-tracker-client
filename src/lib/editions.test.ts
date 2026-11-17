import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { EDITION_RELOAD_DELAY_MS, editionMeta, editionReloadWait, isArchiveError } from './editions';

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

describe('editionReloadWait', () => {
  test('reloads 2 s after the change, not before', () => {
    expect(editionReloadWait(1_000, 1_000, false)).toBe(EDITION_RELOAD_DELAY_MS);
    expect(editionReloadWait(1_000, 2_500, false)).toBe(500);
    expect(editionReloadWait(1_000, 3_000, false)).toBe(0);
    expect(editionReloadWait(1_000, 60_000, false)).toBe(0);
  });

  test('waits while the user is busy (a form or a dialog), then reloads straight away', () => {
    expect(editionReloadWait(1_000, 5_000, true)).toBeNull();
    expect(editionReloadWait(1_000, 5_000, false)).toBe(0);
  });
});
