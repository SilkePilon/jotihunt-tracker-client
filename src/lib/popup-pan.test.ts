import { describe, expect, test } from 'bun:test';
import { popupPan } from './popup-pan';

const container = { width: 1400, height: 900 };

describe('popupPan', () => {
  test('a popup inside the safe box stays put', () => {
    expect(popupPan({ left: 600, top: 300, width: 248, height: 200 }, container)).toEqual([0, 0]);
  });
  test('behind the sidebar: pans left so it clears the sidebar', () => {
    expect(popupPan({ left: 200, top: 300, width: 248, height: 200 }, container)).toEqual([-136, 0]);
  });
  test('under the top bar: pans up', () => {
    expect(popupPan({ left: 600, top: 10, width: 248, height: 200 }, container)).toEqual([0, -50]);
  });
  test('past the right controls and the bottom edge: pans right and down', () => {
    expect(popupPan({ left: 1250, top: 800, width: 248, height: 200 }, container)).toEqual([158, 116]);
  });
  test('larger than the box: keeps the left/top edge in view', () => {
    expect(popupPan({ left: 400, top: 100, width: 248, height: 900 }, container)).toEqual([0, 40]);
  });
});
