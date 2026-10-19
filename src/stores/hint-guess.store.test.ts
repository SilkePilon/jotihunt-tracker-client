import { beforeEach, describe, expect, test } from 'bun:test';
import useHintGuessStore, { type GuessInput } from './hint-guess.store';
import { useHintFormBridge } from '@/hooks/hint-bridge.hook';
import useIntelStore from './intel.store';

const card: GuessInput = { source: 'card', x: '15?000', y: '463000', area: 'alpha', at: null, articleId: null, format: 'split' };
const intel: GuessInput = { source: 'intel', x: '15?2', y: '4631', area: 'alpha', at: 1, articleId: 7, format: 'split' };

beforeEach(() => {
  useHintGuessStore.setState({ input: null, pendingAnswer: null });
  useHintFormBridge.getState().clear();
  useIntelStore.setState({ open: false, articleId: null, area: null });
});

describe('hint guess store', () => {
  test('show keeps the same object for an equal input', () => {
    useHintGuessStore.getState().show(card);
    const first = useHintGuessStore.getState().input;
    useHintGuessStore.getState().show({ ...card });
    expect(useHintGuessStore.getState().input).toBe(first);
  });
  test('clear(source) only clears that source', () => {
    useHintGuessStore.getState().show(intel);
    useHintGuessStore.getState().clear('card');
    expect(useHintGuessStore.getState().input).not.toBeNull();
    useHintGuessStore.getState().clear();
    expect(useHintGuessStore.getState().input).toBeNull();
  });
  test('a card pick fills the hint form through the bridge', () => {
    useHintGuessStore.getState().show(card);
    useHintGuessStore.getState().pick(4);
    expect(useHintFormBridge.getState().coords).toEqual({ x: '154000', y: '463000' });
    expect(useHintGuessStore.getState().input).toBeNull();
  });
  test('an intel pick leaves a pending answer and reopens Intel on the hint', () => {
    useHintGuessStore.getState().show(intel);
    useHintGuessStore.getState().pick(3);
    expect(useHintGuessStore.getState().pendingAnswer).toMatchObject({ articleId: 7, area: 'alpha', text: '1532 4631' });
    expect(useIntelStore.getState()).toMatchObject({ open: true, articleId: 7, area: 'alpha' });
    const { id } = useHintGuessStore.getState().pendingAnswer!;
    useHintGuessStore.getState().clearPending(id);
    expect(useHintGuessStore.getState().pendingAnswer).toBeNull();
  });
});
