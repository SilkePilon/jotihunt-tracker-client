import { describe, expect, test } from 'bun:test';
import type { Hunt } from '@/types/Hunt';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';
import { huntAreaTotals, huntFilterCounts, huntItemKey, huntRowFlag, huntRowStatus, matchesHuntFilter, websiteHuntStatus } from './hunt-list';

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

function hunt(overrides: Partial<Hunt> = {}): Hunt {
  return {
    _id: 'h1',
    area: 'Bravo',
    huntCode: 'XY99',
    status: 'Goedgekeurd',
    points: 10,
    huntTime: new Date('2026-10-17T11:00:00.000Z'),
    updatedAt: new Date('2026-10-17T11:30:00.000Z'),
    ...overrides,
  };
}

const app = (overrides: Partial<HuntReport> = {}): HuntListItem => ({ source: 'app', report: report(overrides) });
const site = (overrides: Partial<Hunt> = {}): HuntListItem => ({ source: 'website', hunt: hunt(overrides) });
const judged = { status: 'judged' as const, submittedAt: '2026-10-17T12:10:00.000Z', site: { status: 'Goedgekeurd', points: 10, seenAt: '2026-10-17T12:40:00.000Z' } };
// 8 min 42 s before the deadline of report()
const BEFORE = Date.parse('2026-10-17T12:21:18.000Z');

describe('matchesHuntFilter', () => {
  test('Te versturen holds to_submit and overdue reports', () => {
    expect(matchesHuntFilter(app(), 'pending')).toBe(true);
    expect(matchesHuntFilter(app({ status: 'overdue' }), 'pending')).toBe(true);
    expect(matchesHuntFilter(app({ status: 'submitted' }), 'pending')).toBe(false);
  });

  test('website-only hunts only count as judged', () => {
    expect(matchesHuntFilter(site(), 'judged')).toBe(true);
    expect(matchesHuntFilter(site(), 'pending')).toBe(false);
    expect(matchesHuntFilter(site(), 'all')).toBe(true);
  });
});

test('huntItemKey: report id, or site- plus the hunt id', () => {
  expect(huntItemKey(app())).toBe('r1');
  expect(huntItemKey(site())).toBe('site-h1');
});

test('huntFilterCounts counts every filter', () => {
  const items = [app(), app({ _id: 'r2', status: 'overdue' }), app({ _id: 'r3', status: 'submitted' }), app({ _id: 'r4', ...judged }), site()];
  expect(huntFilterCounts(items)).toEqual({ all: 5, pending: 2, submitted: 1, judged: 2 });
});

test('huntAreaTotals: areas with hunts in area order, with their points', () => {
  const items = [site(), app({ ...judged }), app({ _id: 'r2' })];
  expect(huntAreaTotals(items)).toEqual([
    { area: 'alpha', label: 'Alpha', count: 2, points: 10 },
    { area: 'bravo', label: 'Bravo', count: 1, points: 10 },
  ]);
});

describe('huntRowStatus', () => {
  test('nothing while the photo is being read (the title shows the spinner)', () => {
    expect(huntRowStatus(report({ ocrStatus: 'reading' }), BEFORE)).toBeNull();
  });

  test('to submit: countdown, urgent in the last 5 minutes', () => {
    expect(huntRowStatus(report(), BEFORE)).toEqual({ tone: 'to_submit', text: 'Te versturen · 8:42', urgent: false });
    expect(huntRowStatus(report(), Date.parse('2026-10-17T12:26:00.000Z'))).toEqual({ tone: 'to_submit', text: 'Te versturen · 4:00', urgent: true });
  });

  test('turns overdue locally once the deadline passed', () => {
    expect(huntRowStatus(report(), Date.parse('2026-10-17T12:31:00.000Z'))).toEqual({ tone: 'overdue', text: 'Te laat!', urgent: false });
  });

  test('submitted and judged', () => {
    expect(huntRowStatus(report({ status: 'submitted' }), BEFORE)).toEqual({ tone: 'submitted', text: 'Ingestuurd', urgent: false });
    expect(huntRowStatus(report(judged), BEFORE)).toEqual({ tone: 'judged', text: 'Goedgekeurd', urgent: false });
    expect(huntRowStatus(report({ ...judged, site: { status: 'Afgekeurd', points: 0, seenAt: '' } }), BEFORE)).toEqual({ tone: 'rejected', text: 'Afgekeurd', urgent: false });
    expect(huntRowStatus(report({ ...judged, site: { status: '', points: 5, seenAt: '' } }), BEFORE)?.text).toBe('Beoordeeld');
  });
});

test('websiteHuntStatus: the site status, red without points', () => {
  expect(websiteHuntStatus(hunt())).toEqual({ tone: 'judged', text: 'Goedgekeurd', urgent: false });
  expect(websiteHuntStatus(hunt({ status: 'Afgekeurd', points: 0 }))).toEqual({ tone: 'rejected', text: 'Afgekeurd', urgent: false });
});

test('huntRowFlag: review first, then duplicate, nothing while reading', () => {
  expect(huntRowFlag(report())).toBeNull();
  expect(huntRowFlag(report({ needsReview: true }))).toBe('controleren');
  expect(huntRowFlag(report({ duplicateOf: { id: 'r0', reportedByName: 'Jesse' } }))).toBe('dubbel?');
  expect(huntRowFlag(report({ needsReview: true, ocrStatus: 'reading' }))).toBeNull();
});
