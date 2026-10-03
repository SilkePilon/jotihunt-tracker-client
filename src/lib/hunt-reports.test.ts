import { describe, expect, test } from 'bun:test';
import type { Hunt } from '@/types/Hunt';
import type { HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';
import { huntListItems, huntStatusSentence, huntsSummary, huntSourceLabel, huntStatusLabel, huntTimeLabel, huntTimelineStatus, isReading, nearestArea, normalizeHuntCode, ocrConfidence, pendingReports, readFailed, resolveHuntTime, totalPoints } from './hunt-reports';

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
    stickerBox: null,
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
    const time = '2026-10-17T09:17:00Z'; // 11:17 Dutch time
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

test('totalPoints sums site points of reports and website hunts', () => {
  const items = [
    { source: 'app', report: { site: { points: 5 } } },
    { source: 'app', report: { site: null } },
    { source: 'website', hunt: { points: 3 } },
  ] as unknown as Parameters<typeof totalPoints>[0];
  expect(totalPoints(items)).toBe(8);
});

describe('timeline status', () => {
  const deadline = Date.parse('2026-10-17T12:30:00.000Z');
  const before = deadline - (8 * 60 + 42) * 1000;
  const after = deadline + 60_000;
  const judged = report({ status: 'judged', site: { status: 'Goedgekeurd', points: 250, seenAt: '2026-10-17T13:00:00.000Z' } });

  test('huntStatusSentence per status', () => {
    expect(huntStatusSentence(report(), before)).toBe('te versturen');
    expect(huntStatusSentence(report(), after)).toBe('deadline verstreken');
    expect(huntStatusSentence(report({ status: 'submitted' }), after)).toBe('ingestuurd');
    expect(huntStatusSentence(judged, after)).toBe('goedgekeurd');
    expect(huntStatusSentence(report({ status: 'judged', site: null }), after)).toBe('beoordeeld');
    expect(huntStatusSentence(report({ ocrStatus: 'reading' }), before)).toBe('wordt gelezen');
  });

  test('huntTimelineStatus per status', () => {
    expect(huntTimelineStatus(report(), before)).toBe('nog 8:42');
    expect(huntTimelineStatus(report(), after)).toBe('Te laat!');
    expect(huntTimelineStatus(report({ status: 'submitted' }), after)).toBe('Ingestuurd');
    expect(huntTimelineStatus(judged, after)).toBe('+250 pt');
    expect(huntTimelineStatus(report({ status: 'judged', site: null }), after)).toBe('Beoordeeld');
  });
});
