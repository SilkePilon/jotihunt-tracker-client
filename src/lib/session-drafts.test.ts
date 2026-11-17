import { describe, expect, test } from 'bun:test';
import { MarkerType } from '@/types/MarkerType';
import useHintDraftStore, { EMPTY_HINT_DRAFT } from '@/stores/hint-draft.store';
import useMarkerDraftStore from '@/stores/marker-draft.store';
import { clearSessionDrafts } from './session-drafts';

describe('clearSessionDrafts', () => {
  test('drops marker drafts and the hint draft with its pending send', () => {
    const time = new Date('2026-10-17T12:30:00Z');
    useMarkerDraftStore.getState().keep({
      type: MarkerType.Hunt,
      area: 'Alpha',
      day: time,
      time,
      sent: { type: MarkerType.Hunt, area: 'Alpha', time, location: { type: 'Point', coordinates: [5.9, 52.1] } },
      outcome: 'unknown',
    });
    useHintDraftStore.getState().save({ area: 'Alpha', time: '12:00', x: '1', y: '2' });
    useHintDraftStore.setState({ pending: { outcome: 'unknown' } as never });

    clearSessionDrafts();

    expect(useMarkerDraftStore.getState().drafts).toEqual({});
    expect(useHintDraftStore.getState().draft).toEqual(EMPTY_HINT_DRAFT);
    expect(useHintDraftStore.getState().pending).toBeNull();
  });
});
