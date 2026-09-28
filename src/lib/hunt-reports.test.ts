import { describe, expect, test } from 'bun:test';
import type { Hunt } from '@/types/Hunt';
import type { HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';
import { extractHuntCode, isConcealed, huntListItems, huntsSummary, huntStatusLabel, nearestArea, normalizeHuntCode, pendingReports, resolveHuntTime } from './hunt-reports';

function report(overrides: Partial<HuntReport> = {}): HuntReport {
  return {
    _id: 'r1',
    area: 'alpha',
    huntCode: 'AB12CD',
    huntTime: '2026-10-17T12:00:00.000Z',
    kind: 'hunt',
    reportedBy: 'u1',
    reportedByName: 'Merida',
    submittedAt: null,
    submittedByName: null,
    site: null,
    createdAt: '2026-10-17T12:05:00.000Z',
    status: 'to_submit',
    deadline: '2026-10-17T12:30:00.000Z',
    photoUrl: '/hunt-reports/r1/photo',
    ...overrides,
  };
}

function prediction(area: string, lng: number, lat: number): Prediction {
  return { area, lastObservation: { time: '2026-10-17T11:00:00Z', lng, lat, kind: 'hint' } } as Prediction;
}

describe('normalizeHuntCode', () => {
  test('removes whitespace and uppercases', () => expect(normalizeHuntCode(' ab 12 ')).toBe('AB12'));
});

describe('extractHuntCode', () => {
  test('prefers labelled code when present', () => {
    expect(extractHuntCode('JOTIHUNT 2026\nCode: K7X9QP2\nAlpha')).toBe('K7X9QP2');
  });
  test('uppercases and ignores punctuation around the code', () => {
    expect(extractHuntCode('code:\n  "k7x9qp"')).toBe('K7X9QP');
  });
  test('empty when there is no token of 4+ characters', () => {
    expect(extractHuntCode('ab 12 x')).toBe('');
    expect(extractHuntCode('')).toBe('');
  });
  test('labelled all-digit code', () => {
    expect(extractHuntCode('ALPHA 2026\nCode: 7392\nFox')).toBe('7392');
  });
  test('labelled all-letter code', () => {
    expect(extractHuntCode('JOTIHUNT 2026\nCode: FOXY\nAlpha')).toBe('FOXY');
  });
  test('unlabelled all-digit code (skips year and stop words)', () => {
    expect(extractHuntCode('JOTIHUNT 2026\n483920\nBravo')).toBe('483920');
  });
  test('unlabelled all-letter code', () => {
    expect(extractHuntCode('JOTIHUNT\nQWERTZ\nDelta')).toBe('QWERTZ');
  });
  test('skips sticker words that OCR glued to the year', () => {
    expect(extractHuntCode('JOTIHUNT2026\nK7X9QP2')).toBe('K7X9QP2');
  });
  test('empty when only stop words or year present', () => {
    expect(extractHuntCode('JOTIHUNT 2026 ALPHA')).toBe('');
  });
});

describe('resolveHuntTime', () => {
  const now = new Date(2026, 9, 17, 14, 10); // local time
  test('today when the time is not in the future', () => {
    expect(resolveHuntTime(13, 55, now)).toEqual(new Date(2026, 9, 17, 13, 55));
  });
  test('allows up to 5 minutes in the future (clock differences)', () => {
    expect(resolveHuntTime(14, 15, now)).toEqual(new Date(2026, 9, 17, 14, 15));
  });
  test('yesterday when more than 5 minutes in the future (hunt runs through the night)', () => {
    expect(resolveHuntTime(23, 55, new Date(2026, 9, 18, 0, 10))).toEqual(new Date(2026, 9, 17, 23, 55));
  });
  test('tomorrow when the written time is a few minutes ahead of the phone clock just before midnight', () => {
    expect(resolveHuntTime(0, 2, new Date(2026, 9, 17, 23, 59))).toEqual(new Date(2026, 9, 18, 0, 2));
  });
  test('keeps today just inside the past tolerance', () => {
    expect(resolveHuntTime(0, 10, new Date(2026, 9, 17, 23, 59))).toEqual(new Date(2026, 9, 17, 0, 10));
  });
});

describe('nearestArea', () => {
  const predictions = [prediction('alpha', 5.9, 52.2), prediction('bravo', 6.1, 52.0)];
  test('area of the nearest last observation', () => {
    expect(nearestArea({ lng: 6.09, lat: 52.01 }, predictions)).toBe('bravo');
  });
  test('null without position or observations', () => {
    expect(nearestArea(null, predictions)).toBeNull();
    expect(nearestArea({ lng: 6, lat: 52 }, [{ area: 'alpha', lastObservation: null } as Prediction])).toBeNull();
  });
});

describe('huntStatusLabel', () => {
  test('Dutch labels, raw site status when judged', () => {
    expect(huntStatusLabel(report())).toBe('Te versturen');
    expect(huntStatusLabel(report({ status: 'overdue' }))).toBe('Te laat!');
    expect(huntStatusLabel(report({ status: 'submitted' }))).toBe('Ingestuurd');
    expect(huntStatusLabel(report({ status: 'judged', site: { status: 'Goedgekeurd', points: 5, seenAt: '' } }))).toBe('Goedgekeurd');
  });
});

describe('pendingReports / huntsSummary', () => {
  test('pending = to_submit + overdue', () => {
    const reports = [report(), report({ _id: 'r2', status: 'overdue' }), report({ _id: 'r3', status: 'submitted' })];
    expect(pendingReports(reports).map((r) => r._id)).toEqual(['r1', 'r2']);
    expect(huntsSummary(reports)).toBe('2 te versturen');
  });
  test('count and points when nothing is pending', () => {
    const reports = [report({ status: 'judged', site: { status: 'Goedgekeurd', points: 5, seenAt: '' } }), report({ _id: 'r2', status: 'submitted' })];
    expect(huntsSummary(reports)).toBe('2 hunts · 5 pt');
  });
  test('undefined while loading', () => expect(huntsSummary(undefined)).toBeUndefined());
});

describe('huntListItems', () => {
  test('adds scraped hunts whose code matches no report', () => {
    const hunts = [
      { _id: 'h1', area: 'Alpha', huntCode: 'ab12cd', status: 'Goedgekeurd', points: 5, huntTime: new Date(), updatedAt: new Date() },
      { _id: 'h2', area: 'Bravo', huntCode: 'ZZ99', status: 'Afgekeurd', points: 0, huntTime: new Date(), updatedAt: new Date() },
    ] as Hunt[];
    const items = huntListItems([report()], hunts);
    expect(items.map((item) => item.source)).toEqual(['app', 'website']);
    expect(items[1].source === 'website' && items[1].hunt.huntCode).toBe('ZZ99');
  });
});

describe('isConcealed', () => {
  const deadline = new Date(report().deadline).getTime();
  test('only while still to submit and before the deadline', () => {
    expect(isConcealed(report(), deadline - 1)).toBe(true);
    expect(isConcealed(report(), deadline + 1)).toBe(false);
    expect(isConcealed(report({ status: 'overdue' }), deadline - 1)).toBe(false);
    expect(isConcealed(report({ status: 'submitted' }), deadline - 1)).toBe(false);
    expect(isConcealed(report({ status: 'judged' }), deadline - 1)).toBe(false);
  });
});
