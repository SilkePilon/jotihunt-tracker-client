import { beforeEach, describe, expect, mock, test } from 'bun:test';
import useTourStore from './tour.store';

const store = () => useTourStore.getState();

beforeEach(() => store().stop());

describe('tour store', () => {
  test('start activates at step 0', () => {
    store().start({ mode: 'auto', stepCount: 3 });
    expect(store()).toMatchObject({ active: true, mode: 'auto', stepIndex: 0, stepCount: 3, paused: false });
  });

  test('prev stops at the first step', () => {
    store().start({ mode: 'replay', stepCount: 3 });
    store().prev();
    expect(store().stepIndex).toBe(0);
  });

  test('next and prev move and record the direction', () => {
    store().start({ mode: 'replay', stepCount: 3 });
    store().next();
    expect(store()).toMatchObject({ stepIndex: 1, direction: 1 });
    store().prev();
    expect(store()).toMatchObject({ stepIndex: 0, direction: -1 });
  });

  test('next on the last step finishes and calls onEnd once', () => {
    const onEnd = mock(() => {});
    store().start({ mode: 'auto', stepCount: 2, onEnd });
    store().next();
    store().next();
    expect(store().active).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('skip calls onEnd', () => {
    const onEnd = mock(() => {});
    store().start({ mode: 'auto', stepCount: 5, onEnd });
    store().skip();
    expect(store().active).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('stop ends without onEnd', () => {
    const onEnd = mock(() => {});
    store().start({ mode: 'auto', stepCount: 5, onEnd });
    store().stop();
    expect(store().active).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('restart resets index and pause', () => {
    store().start({ mode: 'replay', stepCount: 5 });
    store().next();
    store().togglePause();
    store().start({ mode: 'replay', stepCount: 5 });
    expect(store()).toMatchObject({ stepIndex: 0, paused: false });
  });
});
