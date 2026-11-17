import { describe, expect, test } from 'bun:test';
import useHintDraftStore, { EMPTY_HINT_DRAFT } from './hint-draft.store';

describe('hint draft store', () => {
  test('keeps the typed form and clears it after registering', () => {
    useHintDraftStore.getState().save({ area: 'alpha', time: '2026-10-18T10:00:00.000Z', x: '123', y: '' });
    expect(useHintDraftStore.getState().draft).toEqual({ area: 'alpha', time: '2026-10-18T10:00:00.000Z', x: '123', y: '' });
    useHintDraftStore.getState().clear();
    expect(useHintDraftStore.getState().draft).toEqual(EMPTY_HINT_DRAFT);
  });

  test('missing fields become empty strings', () => {
    useHintDraftStore.getState().save({ area: 'bravo' } as never);
    expect(useHintDraftStore.getState().draft).toEqual({ area: 'bravo', time: '', x: '', y: '' });
  });
});
