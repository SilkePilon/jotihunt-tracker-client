import { describe, expect, test } from 'bun:test';
import { focusDropped, focusRestoreTarget, neighbourIndex, ownsKey, trapTabIndex } from './focus';

const node = (isConnected = true) => ({ isConnected });
const box = (...children: unknown[]) => ({ contains: (other: unknown) => children.includes(other) });

describe('focusRestoreTarget', () => {
  const body = node();

  test('focus lost to <body>: back to the opener', () => {
    const opener = node();
    expect(focusRestoreTarget(body, body, opener, node())).toBe(opener);
  });

  test('focused node was removed with the popup: back to the opener', () => {
    const opener = node();
    expect(focusRestoreTarget(node(false), body, opener, null)).toBe(opener);
  });

  test('opener is gone: the fallback (map canvas)', () => {
    const canvas = node();
    expect(focusRestoreTarget(body, body, node(false), canvas)).toBe(canvas);
    expect(focusRestoreTarget(null, body, null, canvas)).toBe(canvas);
  });

  test('focus moved somewhere else on purpose: leave it there', () => {
    expect(focusRestoreTarget(node(), body, node(), node())).toBeNull();
  });

  test('no opener and no fallback: nothing', () => {
    expect(focusRestoreTarget(body, body, null, undefined)).toBeNull();
  });
});

describe('ownsKey', () => {
  const body = {};
  const inside = {};
  const elsewhere = {};

  test('focus on <body>', () => {
    expect(ownsKey({ defaultPrevented: false, target: body }, body, [])).toBe(true);
  });

  test('focus inside the surface or the map', () => {
    expect(ownsKey({ defaultPrevented: false, target: inside }, body, [null, box(inside)])).toBe(true);
  });

  test('focus in another widget (a menu, a toggle group) is left alone', () => {
    expect(ownsKey({ defaultPrevented: false, target: elsewhere }, body, [box(inside), undefined])).toBe(false);
  });

  test('a key someone already handled is left alone', () => {
    expect(ownsKey({ defaultPrevented: true, target: body }, body, [])).toBe(false);
  });
});

describe('focusDropped', () => {
  const body = { isConnected: true, closest: () => null };
  const el = (isConnected: boolean, inert: boolean) => ({ isConnected, closest: (selector: string) => (inert && selector === '[inert]' ? {} : null) });

  test('nothing or <body> focused: dropped', () => {
    expect(focusDropped(null, body)).toBe(true);
    expect(focusDropped(body, body)).toBe(true);
  });

  test('a removed node: dropped', () => {
    expect(focusDropped(el(false, false), body)).toBe(true);
  });

  test('inside a leaving (inert) view: dropped', () => {
    expect(focusDropped(el(true, true), body)).toBe(true);
  });

  test('a live, interactive node: kept', () => {
    expect(focusDropped(el(true, false), body)).toBe(false);
  });
});

describe('trapTabIndex', () => {
  test('nothing focusable: null', () => {
    expect(trapTabIndex(0, -1, false)).toBeNull();
  });

  test('from outside: first, or last with Shift', () => {
    expect(trapTabIndex(3, -1, false)).toBe(0);
    expect(trapTabIndex(3, -1, true)).toBe(2);
  });

  test('steps and wraps both ways', () => {
    expect(trapTabIndex(3, 0, false)).toBe(1);
    expect(trapTabIndex(3, 2, false)).toBe(0);
    expect(trapTabIndex(3, 0, true)).toBe(2);
    expect(trapTabIndex(3, 2, true)).toBe(1);
  });
});

describe('neighbourIndex', () => {
  test('prefers the next usable item', () => {
    expect(neighbourIndex([true, true, true], 1)).toBe(2);
    expect(neighbourIndex([true, true, false, true], 1)).toBe(3);
  });

  test('falls back to the previous usable item', () => {
    expect(neighbourIndex([true, true, true], 2)).toBe(1);
    expect(neighbourIndex([true, false, true, false], 2)).toBe(0);
  });

  test('-1 when nothing else is usable', () => {
    expect(neighbourIndex([true], 0)).toBe(-1);
    expect(neighbourIndex([false, true, false], 1)).toBe(-1);
  });
});
