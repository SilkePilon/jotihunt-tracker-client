import { beforeEach, describe, expect, test } from 'bun:test';
import { ringFromPoints, useNightDraw } from './night-draw.store';

beforeEach(() => useNightDraw.getState().cancel());

describe('night draw store', () => {
  test('start, add, undo, close', () => {
    const s = useNightDraw.getState();
    s.start('open');
    s.addPoint([1, 1]);
    s.addPoint([2, 1]);
    s.addPoint([2, 2]);
    s.addPoint([9, 9]);
    useNightDraw.getState().undo();
    useNightDraw.getState().close();
    const state = useNightDraw.getState();
    expect([state.active, state.kind, state.closed, state.points.length]).toEqual([true, 'open', true, 3]);
  });
  test('close needs 3 points', () => {
    useNightDraw.getState().start();
    useNightDraw.getState().addPoint([1, 1]);
    useNightDraw.getState().close();
    expect(useNightDraw.getState().closed).toBe(false);
  });
  test('no points added once closed; undo reopens first', () => {
    const s = useNightDraw.getState();
    s.start();
    s.addPoint([1, 1]);
    s.addPoint([2, 1]);
    s.addPoint([2, 2]);
    s.close();
    useNightDraw.getState().addPoint([5, 5]);
    expect(useNightDraw.getState().points.length).toBe(3);
    useNightDraw.getState().undo();
    expect([useNightDraw.getState().closed, useNightDraw.getState().points.length]).toEqual([false, 3]);
  });
  test('ringFromPoints', () => {
    expect(ringFromPoints([[1, 1], [2, 1]])).toBeNull();
    expect(ringFromPoints([[1, 1], [2, 1], [2, 2]])).toEqual([[1, 1], [2, 1], [2, 2], [1, 1]]);
  });
});
