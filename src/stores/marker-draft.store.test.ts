import { afterEach, describe, expect, test } from 'bun:test';
import { MarkerType } from '@/types/MarkerType';
import useMarkerDraftStore, { DRAFT_MAX_AGE_MS, draftCounts, freshDrafts, draftElsewhere, draftKey, keyOfDraft, latestDraft, pendingDraftLine, reopenDraft, reviveDraftDates, sameMarkerValues, settleDrafts, type MarkerDraft } from './marker-draft.store';

const day = new Date('2026-10-17T00:00:00Z');
const time = new Date('2026-10-17T12:30:00Z');
const draft: MarkerDraft = {
  type: MarkerType.Hunt,
  area: 'Alpha',
  day,
  time,
  sent: { type: MarkerType.Hunt, area: 'Alpha', time, location: { type: 'Point', coordinates: [5.9, 52.1] } },
  outcome: 'unknown',
  savedAt: 1,
};
const key = draftKey(MarkerType.Hunt, 52.1, 5.9);
const store = () => useMarkerDraftStore.getState();

describe('marker draft store', () => {
  afterEach(() => useMarkerDraftStore.setState({ drafts: {}, lastArea: '' }));

  test('keeps an unconfirmed save under its type and pin until cleared', () => {
    store().keep(draft);
    expect(store().drafts[key]).toEqual(draft);
    store().clear(key);
    expect(store().drafts).toEqual({});
  });

  test('update changes the kept values, and does nothing without a draft', () => {
    store().update(key, { area: 'Bravo' });
    expect(store().drafts).toEqual({});
    store().keep(draft);
    store().update(key, { area: 'Bravo', outcome: 'absent' });
    expect(store().drafts[key]).toEqual({ ...draft, area: 'Bravo', outcome: 'absent' });
  });

  test('a draft only restores at the same pin and marker type', () => {
    expect(keyOfDraft(draft)).toBe(key);
    // ~1 m apart (float round-trips) still matches; another pin or type doesn't
    expect(draftKey(MarkerType.Hunt, 52.100001, 5.900004)).toBe(key);
    expect(draftKey(MarkerType.Hunt, 52.1001, 5.9)).not.toBe(key);
    expect(draftKey(MarkerType.Spot, 52.1, 5.9)).not.toBe(key);
  });

  test('drafts at different pins are kept side by side', () => {
    const other = { ...draft, sent: { ...draft.sent, location: { type: 'Point', coordinates: [6.0, 52.2] } } };
    store().keep(draft);
    store().keep(other);
    expect(Object.keys(store().drafts)).toHaveLength(2);
    store().clear(key);
    expect(Object.values(store().drafts)).toEqual([other]);
  });

  test('draftElsewhere finds a draft of the same type at another pin', () => {
    const here = draftKey(MarkerType.Hunt, 52.2, 6.0);
    expect(draftElsewhere({}, MarkerType.Hunt, here)).toBeNull();
    expect(draftElsewhere({ [key]: draft }, MarkerType.Hunt, here)).toBe(draft);
    expect(draftElsewhere({ [key]: draft }, MarkerType.Hunt, key)).toBeNull();
    expect(draftElsewhere({ [key]: draft }, MarkerType.Spot, here)).toBeNull();
  });

  test('sameMarkerValues compares area, day and time to the minute', () => {
    const values = { area: 'Alpha', day, time };
    expect(sameMarkerValues(values, { ...values })).toBe(true);
    // Seconds don't count: the form's time is HH:MM
    expect(sameMarkerValues(values, { ...values, time: new Date(time.getTime() + 20_000) })).toBe(true);
    expect(sameMarkerValues(values, { ...values, area: 'Bravo' })).toBe(false);
    expect(sameMarkerValues(values, { ...values, time: new Date(time.getTime() + 60_000) })).toBe(false);
    expect(sameMarkerValues(values, { ...values, day: new Date(day.getTime() + 86_400_000) })).toBe(false);
  });

  test('remembers the last area sent this session (empty before any)', () => {
    expect(store().lastArea).toBe('');
    store().rememberArea('bravo');
    store().rememberArea('delta');
    expect(store().lastArea).toBe('delta');
  });
});

describe('kept drafts outside the dialog', () => {
  afterEach(() => useMarkerDraftStore.setState({ drafts: {}, lastArea: '', request: null }));
  const spot: MarkerDraft = { ...draft, type: MarkerType.Spot, sent: { ...draft.sent, type: MarkerType.Spot, location: { type: 'Point', coordinates: [6.0, 52.2] } } };
  const hunt2: MarkerDraft = { ...draft, sent: { ...draft.sent, location: { type: 'Point', coordinates: [6.1, 52.3] } } };

  test('pendingDraftLine counts hunts and spots with plurals', () => {
    expect(pendingDraftLine({})).toBeNull();
    expect(pendingDraftLine({ a: draft })).toBe('1 hunt niet bevestigd — tik om te controleren');
    expect(pendingDraftLine({ a: draft, b: hunt2 })).toBe('2 hunts niet bevestigd — tik om te controleren');
    expect(pendingDraftLine({ b: spot })).toBe('1 spot niet bevestigd — tik om te controleren');
    expect(pendingDraftLine({ a: draft, b: hunt2, c: spot })).toBe('2 hunts en 1 spot niet bevestigd — tik om te controleren');
    expect(draftCounts({ a: draft, c: spot })).toEqual({ hunt: 1, spot: 1 });
  });

  test('latestDraft is the last one kept; reopenDraft asks for the dialog at its pin', () => {
    expect(latestDraft({})).toBeNull();
    store().keep(draft);
    store().keep(spot);
    expect(latestDraft(store().drafts)).toBe(spot);
    reopenDraft(spot);
    expect(store().request).toEqual({ type: MarkerType.Spot, lat: 52.2, lng: 6.0, id: 1 });
    // The same pin again still opens it again
    reopenDraft(spot);
    expect(store().request?.id).toBe(2);
  });

  test('settleDrafts clears what did save, marks the rest absent, and never guesses without a list', () => {
    store().keep(draft);
    store().keep(spot);
    expect(settleDrafts(undefined)).toEqual([]);
    expect(Object.keys(store().drafts)).toHaveLength(2);
    // The hunt is in the fresh list (time as a string, like JSON), the spot isn't
    const fresh = [{ ...draft.sent, time: draft.sent.time.toISOString() as unknown as Date }];
    expect(settleDrafts(fresh)).toEqual([draft]);
    expect(Object.values(store().drafts)).toEqual([{ ...spot, outcome: 'absent' }]);
  });

  test('reviveDraftDates turns the stored date strings back into dates', () => {
    const json = JSON.stringify({ drafts: { [key]: draft } });
    const revived = JSON.parse(json, reviveDraftDates) as { drafts: Record<string, MarkerDraft> };
    expect(revived.drafts[key]).toEqual(draft);
    expect(revived.drafts[key].sent.time).toBeInstanceOf(Date);
    // Other strings stay strings
    expect(reviveDraftDates('area', 'Alpha')).toBe('Alpha');
    expect(reviveDraftDates('time', 'not a date')).toBe('not a date');
  });
});

describe('draft age', () => {
  afterEach(() => useMarkerDraftStore.setState({ drafts: {} }));
  const now = Date.parse('2026-10-18T12:00:00Z');

  test('keep stamps savedAt when the draft has none', () => {
    const unstamped = { ...draft, savedAt: undefined };
    const before = Date.now();
    store().keep(unstamped);
    expect(store().drafts[key].savedAt).toBeGreaterThanOrEqual(before);
  });

  test('freshDrafts drops drafts older than 48 h', () => {
    const recent = { ...draft, savedAt: now - DRAFT_MAX_AGE_MS };
    const old = { ...draft, savedAt: now - DRAFT_MAX_AGE_MS - 1 };
    expect(freshDrafts({ a: recent, b: old }, now)).toEqual({ a: recent });
    expect(freshDrafts(undefined, now)).toEqual({});
  });

  test('a draft from before stamps ages by its sent time; an unreadable one is dropped', () => {
    const legacy = { ...draft, savedAt: undefined };
    // Sent 2026-10-17 12:30Z: 23.5 h before `now`
    expect(Object.keys(freshDrafts({ a: legacy }, now))).toEqual(['a']);
    expect(freshDrafts({ a: legacy }, now + DRAFT_MAX_AGE_MS)).toEqual({});
    const broken = { ...legacy, sent: { ...legacy.sent, time: 'nonsense' as unknown as Date } };
    expect(freshDrafts({ a: broken }, now)).toEqual({});
  });

  test('clearAll drops every draft', () => {
    store().keep(draft);
    store().clearAll();
    expect(store().drafts).toEqual({});
  });
});
