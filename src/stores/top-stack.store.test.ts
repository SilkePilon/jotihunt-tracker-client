import { afterEach, describe, expect, test } from 'bun:test';
import useTopStackStore from './top-stack.store';

describe('top stack store', () => {
  afterEach(() => useTopStackStore.setState({ heights: { badge: 0, pill: 0, toolbar: 0 } }));

  test('sets one height without touching the others', () => {
    useTopStackStore.getState().setHeight('pill', 32);
    useTopStackStore.getState().setHeight('badge', 24);
    expect(useTopStackStore.getState().heights).toEqual({ badge: 24, pill: 32, toolbar: 0 });
  });

  test('the same height keeps the state (no re-render)', () => {
    useTopStackStore.getState().setHeight('toolbar', 44);
    const before = useTopStackStore.getState().heights;
    useTopStackStore.getState().setHeight('toolbar', 44);
    expect(useTopStackStore.getState().heights).toBe(before);
  });
});
