import { describe, expect, mock, test } from 'bun:test';
import { captureLaunchShortcut, parseLaunchShortcut, takeLaunchShortcut, withoutLaunchParam } from './launch-shortcut';

describe('parseLaunchShortcut', () => {
  test('the manifest shortcuts', () => {
    expect(parseLaunchShortcut('?open=hintEntry')).toBe('hintEntry');
    expect(parseLaunchShortcut('?open=foxes')).toBe('foxes');
    expect(parseLaunchShortcut('?x=1&open=foxes')).toBe('foxes');
  });

  test('nothing, or anything else, opens nothing', () => {
    expect(parseLaunchShortcut('')).toBeNull();
    expect(parseLaunchShortcut('?open=')).toBeNull();
    expect(parseLaunchShortcut('?open=life360')).toBeNull();
    expect(parseLaunchShortcut('?open=constructor')).toBeNull();
    expect(parseLaunchShortcut('?Open=foxes')).toBeNull();
  });
});

describe('withoutLaunchParam', () => {
  test('drops only the open parameter', () => {
    expect(withoutLaunchParam('https://x.nl/?open=foxes')).toBe('/');
    expect(withoutLaunchParam('https://x.nl/?viewport-debug&open=foxes#a')).toBe('/?viewport-debug=#a');
    expect(withoutLaunchParam('https://x.nl/hq?open=hintEntry&b=2')).toBe('/hq?b=2');
  });

  test('null when there is nothing to remove', () => {
    expect(withoutLaunchParam('https://x.nl/?b=2')).toBeNull();
  });
});

describe('captureLaunchShortcut', () => {
  test('keeps the section once and cleans the address bar', () => {
    const replaceState = mock(() => {});
    captureLaunchShortcut({ href: 'https://x.nl/?open=hintEntry', search: '?open=hintEntry' }, { state: { idx: 0 }, replaceState });
    expect(replaceState).toHaveBeenCalledWith({ idx: 0 }, '', '/');
    expect(takeLaunchShortcut()).toBe('hintEntry');
    expect(takeLaunchShortcut()).toBeNull();
  });

  test('an unknown value is still removed from the URL but opens nothing', () => {
    const replaceState = mock(() => {});
    captureLaunchShortcut({ href: 'https://x.nl/?open=nope', search: '?open=nope' }, { state: null, replaceState });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(takeLaunchShortcut()).toBeNull();
  });

  test('a plain launch leaves the URL alone', () => {
    const replaceState = mock(() => {});
    captureLaunchShortcut({ href: 'https://x.nl/', search: '' }, { state: null, replaceState });
    expect(replaceState).not.toHaveBeenCalled();
    expect(takeLaunchShortcut()).toBeNull();
  });
});
