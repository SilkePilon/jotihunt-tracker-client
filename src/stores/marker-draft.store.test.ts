import { afterEach, describe, expect, test } from 'bun:test';
import { MarkerType } from '@/types/MarkerType';
import useMarkerDraftStore, { draftForType, type MarkerDraft } from './marker-draft.store';

const day = new Date('2026-10-17T00:00:00Z');
const time = new Date('2026-10-17T12:30:00Z');
const draft: MarkerDraft = {
  type: MarkerType.Hunt,
  area: 'Alpha',
  day,
  time,
  sent: { type: MarkerType.Hunt, area: 'Alpha', time, location: { type: 'Point', coordinates: [5.9, 52.1] } },
  outcome: 'unknown',
};
const store = () => useMarkerDraftStore.getState();

describe('marker draft store', () => {
  afterEach(() => store().clear());

  test('keeps an unconfirmed save until cleared', () => {
    store().keep(draft);
    expect(store().draft).toEqual(draft);
    store().clear();
    expect(store().draft).toBeNull();
  });

  test('update changes the kept values, and does nothing without a draft', () => {
    store().update({ area: 'Bravo' });
    expect(store().draft).toBeNull();
    store().keep(draft);
    store().update({ area: 'Bravo', outcome: 'absent' });
    expect(store().draft).toEqual({ ...draft, area: 'Bravo', outcome: 'absent' });
  });

  test('a draft only restores into a dialog of the same marker type', () => {
    expect(draftForType(draft, MarkerType.Hunt)).toBe(draft);
    expect(draftForType(draft, MarkerType.Spot)).toBeNull();
    expect(draftForType(null, MarkerType.Hunt)).toBeNull();
  });
});
