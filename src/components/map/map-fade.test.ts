import { describe, expect, test } from 'bun:test';
import { fadeKeyframes } from './map-fade';

describe('fadeKeyframes', () => {
  test('fade and zoom from 95% around the bottom centre', () => {
    expect(fadeKeyframes('in', true, false)).toEqual([
      { opacity: 0, scale: '0.95', transformOrigin: '50% 100%' },
      { opacity: 1, scale: '1', transformOrigin: '50% 100%' },
    ]);
  });

  test('out is the reverse', () => {
    expect(fadeKeyframes('out', true, false)).toEqual([...fadeKeyframes('in', true, false)].reverse());
  });

  test('reduced motion or no zoom: only the opacity', () => {
    expect(fadeKeyframes('in', true, true)).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(fadeKeyframes('out', false, false)).toEqual([{ opacity: 1 }, { opacity: 0 }]);
  });
});
