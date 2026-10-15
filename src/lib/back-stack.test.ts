import { describe, expect, test } from 'bun:test';
import { createBackStack, type HistoryLike } from './back-stack';

function fakeHistory() {
  const calls: string[] = [];
  const history: HistoryLike = { pushState: () => calls.push('push'), go: (delta) => calls.push(`go:${delta}`) };
  return { history, calls };
}

describe('back stack', () => {
  test('popstate closes the most recently opened entry first', () => {
    const { history } = fakeHistory();
    const stack = createBackStack(history);
    const closed: string[] = [];
    stack.open('sheet', () => closed.push('sheet'));
    stack.open('page:1', () => closed.push('page:1'));
    stack.open('popup', () => closed.push('popup'));
    stack.onPopState();
    stack.onPopState();
    stack.onPopState();
    expect(closed).toEqual(['popup', 'page:1', 'sheet']);
    expect(stack.keys()).toEqual([]);
  });

  test('each open pushes one history entry; opening the same key twice does not', () => {
    const { history, calls } = fakeHistory();
    const stack = createBackStack(history);
    stack.open('sheet', () => {});
    stack.open('sheet', () => {});
    expect(calls).toEqual(['push']);
  });

  test('closing from the UI consumes the history entry without calling close again', () => {
    const { history, calls } = fakeHistory();
    const stack = createBackStack(history);
    let closes = 0;
    stack.open('popup', () => closes++);
    stack.closedByUi('popup');
    expect(calls).toEqual(['push', 'go:-1']);
    stack.onPopState(); // the popstate caused by our own go(-1)
    expect(closes).toBe(0);
    expect(stack.keys()).toEqual([]);
  });

  test('closedByUi for an unknown key does nothing', () => {
    const { history, calls } = fakeHistory();
    createBackStack(history).closedByUi('nope');
    expect(calls).toEqual([]);
  });

  test('popstate with an empty stack does nothing', () => {
    const { history } = fakeHistory();
    expect(() => createBackStack(history).onPopState()).not.toThrow();
  });

  test('a layer that remounts before the deferred close keeps its one entry and the newest close', () => {
    const { history, calls } = fakeHistory();
    const pending: (() => void)[] = [];
    const stack = createBackStack(history, (fn) => pending.push(fn));
    const closed: string[] = [];
    stack.open('popup', () => closed.push('a'));
    stack.closedByUi('popup'); // popup A unmounts...
    stack.open('popup', () => closed.push('b')); // ...popup B mounts in the same commit
    pending.forEach((fn) => fn());
    expect(calls).toEqual(['push']);
    stack.onPopState();
    expect(closed).toEqual(['b']);
  });

  test('a deferred close without a remount still consumes the entry', () => {
    const { history, calls } = fakeHistory();
    const pending: (() => void)[] = [];
    const stack = createBackStack(history, (fn) => pending.push(fn));
    stack.open('popup', () => {});
    stack.closedByUi('popup');
    expect(calls).toEqual(['push']);
    pending.forEach((fn) => fn());
    expect(calls).toEqual(['push', 'go:-1']);
    expect(stack.keys()).toEqual([]);
  });

  test('layers closed in the same tick go back once and swallow only that one popstate', () => {
    const { history, calls } = fakeHistory();
    const pending: (() => void)[] = [];
    const stack = createBackStack(history, (fn) => pending.push(fn));
    const closed: string[] = [];
    stack.open('sheet', () => closed.push('sheet'));
    stack.open('page:1', () => closed.push('page:1'));
    stack.open('popup', () => closed.push('popup'));
    stack.closedByUi('popup');
    stack.closedByUi('page:1');
    expect(pending).toHaveLength(1);
    pending.forEach((fn) => fn());
    expect(calls).toEqual(['push', 'push', 'push', 'go:-2']);
    expect(stack.keys()).toEqual(['sheet']);
    stack.onPopState(); // our own go(-2)
    expect(closed).toEqual([]);
    stack.onPopState(); // a real Back
    expect(closed).toEqual(['sheet']);
  });

  test('a later tick schedules a new batch', () => {
    const { history, calls } = fakeHistory();
    const pending: (() => void)[] = [];
    const stack = createBackStack(history, (fn) => pending.push(fn));
    stack.open('a', () => {});
    stack.open('b', () => {});
    stack.closedByUi('b');
    pending.shift()!();
    stack.closedByUi('a');
    pending.shift()!();
    expect(calls).toEqual(['push', 'push', 'go:-1', 'go:-1']);
    expect(stack.keys()).toEqual([]);
  });
});
