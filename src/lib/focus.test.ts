import { describe, expect, test } from 'bun:test';
import { focusRestoreTarget, ownsKey } from './focus';

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
