import { describe, expect, test } from 'bun:test';
import type { Hunt } from '@/types/Hunt';
import type { HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';
import { huntListItems, huntsSummary, huntSourceLabel, huntStatusLabel, huntTimeLabel, isConcealed, isReading, nearestArea, normalizeHuntCode, ocrConfidence, pendingReports, readFailed, resolveHuntTime } from './hunt-reports';

function report(overrides: Partial<HuntReport> = {}): HuntReport {
  return {
    _id: 'r1',
    area: 'alpha',
    huntCode: 'AB12CD',
    huntTime: '2026-10-17T12:00:00.000Z',
    huntTimeKnown: true,
    huntCodeSource: 'ocr',
    huntTimeSource: 'ocr',
    reportedBy: 'u1',
    reportedByName: 'Merida',
    submittedAt: null,
    submittedByName: null,
    site: null,
    createdAt: '2026-10-17T12:05:00.000Z',
    status: 'to_submit',
    deadline: '2026-10-17T12:30:00.000Z',
    photoUrl: '/hunt-reports/r1/photo',
    ocrStatus: 'done',
    ocrError: null,
    codeConfidence: 0.95,
    timeConfidence: 0.92,
    needsReview: false,
    duplicateOf: null,
    ...overrides,
  };
}

function prediction(area: string, lng: number, lat: number): Prediction {
  return {
    area,
    status: 'green',
    paused: false,
    updatedAt: '2026-10-17T12:00:00Z',
    round: 1,
    estimate: false,
    stale: false,
    lastObservation: { time: '2026-10-17T11:00:00Z', lng, lat, kind: 'hint' },
    pin: null,
    confidence: null,
    candidates: [],
    visitedTeamApiIds: [],
    why: '',
  };
}

describe('normalizeHuntCode', () => {
  test('removes whitespace and keeps the case', () => expect(normalizeHuntCode(' GN cr ZRZ ')).toBe('GNcrZRZ'));
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
      { _id: 'h1', area: 'Alpha', huntCode: 'AB12CD ', status: 'Goedgekeurd', points: 5, huntTime: new Date(), updatedAt: new Date() },
      { _id: 'h2', area: 'Bravo', huntCode: 'ZZ99', status: 'Afgekeurd', points: 0, huntTime: new Date(), updatedAt: new Date() },
    ] as Hunt[];
    const items = huntListItems([report()], hunts);
    expect(items.map((item) => item.source)).toEqual(['app', 'website']);
    expect(items[1].source === 'website' && items[1].hunt.huntCode).toBe('ZZ99');
  });
  test('reports without a code (still being read) match no scraped hunt', () => {
    const hunts = [{ _id: 'h1', area: 'Alpha', huntCode: 'AB12CD', status: 'Goedgekeurd', points: 5, huntTime: new Date(), updatedAt: new Date() }] as Hunt[];
    const items = huntListItems([report({ huntCode: null, ocrStatus: 'pending' })], hunts);
    expect(items.map((item) => item.source)).toEqual(['app', 'website']);
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
  test('not while the code is unknown (HQ needs the photo to read it)', () => {
    expect(isConcealed(report({ huntCode: null, ocrStatus: 'failed' }), deadline - 1)).toBe(false);
  });
});

describe('isReading', () => {
  test('pending and reading, not done or failed', () => {
    expect(isReading(report({ ocrStatus: 'pending' }))).toBe(true);
    expect(isReading(report({ ocrStatus: 'reading' }))).toBe(true);
    expect(isReading(report({ ocrStatus: 'done' }))).toBe(false);
    expect(isReading(report({ ocrStatus: 'failed' }))).toBe(false);
  });
});

describe('huntTimeLabel', () => {
  test('plain time when known, ± before the upload time when not', () => {
    const time = new Date(2026, 9, 17, 11, 17).toISOString();
    expect(huntTimeLabel(report({ huntTime: time }))).toBe('11:17');
    expect(huntTimeLabel(report({ huntTime: time, huntTimeKnown: false }))).toBe('±11:17');
  });
});

describe('ocrConfidence', () => {
  test('lowest confidence of the OCR-read fields only', () => {
    expect(ocrConfidence(report())).toBe(0.92);
    expect(ocrConfidence(report({ huntTimeSource: 'manual' }))).toBe(0.95);
    expect(ocrConfidence(report({ huntCodeSource: 'manual', huntTimeSource: 'manual' }))).toBeNull();
    expect(ocrConfidence(report({ codeConfidence: null }))).toBe(0);
  });
});

describe('huntSourceLabel', () => {
  test('reading, read by Gemini, manual, failed', () => {
    expect(huntSourceLabel(report({ ocrStatus: 'reading', huntCode: null, huntCodeSource: null, huntTimeSource: null }))).toBe('Wordt gelezen…');
    expect(huntSourceLabel(report())).toBe('Gelezen door Gemini (zekerheid 92%)');
    expect(huntSourceLabel(report({ huntTimeSource: 'manual' }))).toBe('Gelezen door Gemini (zekerheid 95%) · tijd handmatig');
    expect(huntSourceLabel(report({ huntCodeSource: 'manual', huntTimeSource: 'manual' }))).toBe('Handmatig ingevuld');
    const failed = report({ ocrStatus: 'failed', ocrError: 'Geen GEMINI_API_KEY ingesteld', huntCode: null, huntCodeSource: null, huntTimeSource: null });
    expect(huntSourceLabel(failed, true)).toBe('Lezen mislukt: Geen GEMINI_API_KEY ingesteld');
    expect(huntSourceLabel(failed)).toBe('Lezen mislukt');
    expect(huntSourceLabel(report({ ocrStatus: 'failed', huntCodeSource: 'manual', huntTimeSource: 'manual' }))).toBe('Handmatig ingevuld');
    expect(huntSourceLabel(report({ huntCode: null, huntCodeSource: null, huntTimeSource: null, huntTimeKnown: false }))).toBe('Niets gelezen van de foto');
  });
});

describe('readFailed', () => {
  test('failed until both fields are entered by hand', () => {
    expect(readFailed(report({ ocrStatus: 'failed', huntCodeSource: null, huntTimeSource: null }))).toBe(true);
    expect(readFailed(report({ ocrStatus: 'failed', huntCodeSource: 'manual', huntTimeSource: null }))).toBe(true);
    expect(readFailed(report({ ocrStatus: 'failed', huntCodeSource: 'manual', huntTimeSource: 'manual' }))).toBe(false);
    expect(readFailed(report())).toBe(false);
  });
});
