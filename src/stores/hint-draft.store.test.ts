import { describe, expect, test } from 'bun:test';
import useHintDraftStore, { EMPTY_HINT_DRAFT } from './hint-draft.store';
import { hintPrimaryAction, holdsUnconfirmedHint, type UnconfirmedHint } from '@/lib/hint-submit';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

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

describe('unconfirmed hint', () => {
  const sent: Marker = {
    area: 'alpha',
    time: new Date('2026-10-18T10:00:00.000Z'),
    location: { type: 'Point', coordinates: [5.1, 52.1] },
    type: MarkerType.Hint,
  };
  const values = { area: 'alpha', time: '2026-10-18T10:00:00.000Z', x: '155000', y: '463000' };

  test('is kept until cleared, next to the draft', () => {
    useHintDraftStore.getState().setPending({ sent, values, outcome: 'unknown' });
    expect(useHintDraftStore.getState().pending?.outcome).toBe('unknown');
    // Registering the next hint clears the typed form but the lost one is settled separately
    useHintDraftStore.getState().clear();
    expect(useHintDraftStore.getState().pending?.values).toEqual(values);
    useHintDraftStore.getState().setPending(null);
    expect(useHintDraftStore.getState().pending).toBeNull();
  });

  test('a stored copy (time as string) still recognises our own hint and keeps Opnieuw controleren leading', () => {
    const stored = JSON.parse(JSON.stringify({ sent, values, outcome: 'unknown' })) as UnconfirmedHint;
    expect(typeof stored.sent.time).toBe('string');
    expect(holdsUnconfirmedHint([{ ...sent, _id: 'm1' } as Marker], stored)).toBe(true);
    expect(hintPrimaryAction(stored, values)).toBe('recheck');
  });
});
