import { describe, expect, test } from 'bun:test';
import { paddedCentre, pointHiddenByDock } from './dock-camera';
import { DOCK_GAP } from './sheet-snaps';

const SIZE = { width: 400, height: 800 };

describe('paddedCentre', () => {
  test('the middle of the map without padding', () => {
    expect(paddedCentre(SIZE, { top: 0, bottom: 0, left: 0, right: 0 })).toEqual([200, 400]);
  });

  test('the middle of what the padding leaves', () => {
    expect(paddedCentre(SIZE, { top: 0, bottom: 300, left: 0, right: 0 })).toEqual([200, 250]);
    expect(paddedCentre(SIZE, { top: 20, bottom: 0, left: 100, right: 0 })).toEqual([250, 410]);
  });
});

describe('pointHiddenByDock', () => {
  const bottom = 300;
  const padding = { top: 0, right: 0, left: 0, bottom };
  test('a point above the card and below the safe top stays put', () => {
    expect(pointHiddenByDock({ x: 200, y: 300 }, SIZE, padding, 40)).toBe(false);
    expect(pointHiddenByDock({ x: 200, y: SIZE.height - bottom - DOCK_GAP }, SIZE, padding, 40)).toBe(false);
  });

  test('a point under the card or sheet is hidden', () => {
    expect(pointHiddenByDock({ x: 200, y: SIZE.height - bottom - DOCK_GAP + 1 }, SIZE, padding, 40)).toBe(true);
    expect(pointHiddenByDock({ x: 200, y: 700 }, SIZE, padding, 40)).toBe(true);
  });

  test('a point above the safe top or off the sides is hidden', () => {
    expect(pointHiddenByDock({ x: 200, y: 20 }, SIZE, padding, 40)).toBe(true);
    expect(pointHiddenByDock({ x: -5, y: 300 }, SIZE, padding, 40)).toBe(true);
    expect(pointHiddenByDock({ x: 405, y: 300 }, SIZE, padding, 40)).toBe(true);
  });

  test('a point behind a padded side (the landscape sheet column) is hidden', () => {
    const side = { top: 0, right: 0, left: 150, bottom: 0 };
    expect(pointHiddenByDock({ x: 100, y: 300 }, SIZE, side, 0)).toBe(true);
    expect(pointHiddenByDock({ x: 200, y: 300 }, SIZE, side, 0)).toBe(false);
  });
});
