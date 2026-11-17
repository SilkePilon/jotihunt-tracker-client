import { describe, expect, test } from 'bun:test';
import { computeSnapHeights, dockCardMax, dockedPadding, grabLabel, landscapeSheetBox, nextSnap, normalizeSnap, rowDock, phoneMapPadding, rubberBand, settleSnap } from './sheet-snaps';

describe('computeSnapHeights', () => {
  test('iPhone-like viewport', () => {
    expect(computeSnapHeights({ visibleH: 760, safeTop: 47, safeBottom: 34, peekContent: 136 })).toEqual({ peek: 170, half: 380, full: 701 });
  });
  test('peek content is clamped to 120 … 22% of the visible height', () => {
    expect(computeSnapHeights({ visibleH: 800, safeTop: 0, safeBottom: 0, peekContent: 60 }).peek).toBe(120);
    expect(computeSnapHeights({ visibleH: 800, safeTop: 0, safeBottom: 0, peekContent: 400 }).peek).toBe(176);
  });
  test('half closer than 140px to peek folds into full (two stops)', () => {
    // 360 tall landscape phone: half would be 180, peek 141
    expect(computeSnapHeights({ visibleH: 360, safeTop: 0, safeBottom: 21, peekContent: 136 })).toEqual({ peek: 141, half: 348, full: 348 });
    // Exactly 140 apart keeps the middle stop
    expect(computeSnapHeights({ visibleH: 520, safeTop: 0, safeBottom: 0, peekContent: 120 })).toEqual({ peek: 120, half: 260, full: 508 });
  });
  test('landscape: half never below peek, nothing above full', () => {
    const h = computeSnapHeights({ visibleH: 360, safeTop: 0, safeBottom: 21, peekContent: 136 });
    expect(h.half).toBeGreaterThanOrEqual(h.peek);
    expect(h.peek).toBeLessThanOrEqual(h.full);
    expect(h.half).toBeLessThanOrEqual(h.full);
  });
});

describe('rubberBand', () => {
  test('inside the range is unchanged', () => expect(rubberBand(300, 100, 700)).toBe(300));
  test('above max moves at a quarter', () => expect(rubberBand(800, 100, 700)).toBe(725));
  test('below min moves at 40%', () => expect(rubberBand(50, 100, 700)).toBe(80));
});

describe('settleSnap', () => {
  const heights = { peek: 170, half: 380, full: 700 };
  test('slow release picks the nearest snap', () => {
    expect(settleSnap(300, 0, heights)).toBe('half');
    expect(settleSnap(600, 0.1, heights)).toBe('full');
    expect(settleSnap(200, -0.1, heights)).toBe('peek');
  });
  test('an upward flick goes to the next snap above', () => {
    expect(settleSnap(200, 0.8, heights)).toBe('half');
    expect(settleSnap(390, 0.8, heights)).toBe('full');
  });
  test('a downward flick goes to the next snap below', () => {
    expect(settleSnap(650, -0.8, heights)).toBe('half');
    expect(settleSnap(370, -0.8, heights)).toBe('peek');
  });
  test('a flick past the ends stays at the end', () => {
    expect(settleSnap(720, 0.9, heights)).toBe('full');
    expect(settleSnap(150, -0.9, heights)).toBe('peek');
  });
});

test('nextSnap cycles peek → half → full → peek', () => {
  expect(nextSnap('peek')).toBe('half');
  expect(nextSnap('half')).toBe('full');
  expect(nextSnap('full')).toBe('peek');
});

test('nextSnap skips a stop at the current height (two-stop sheet)', () => {
  const twoStops = { peek: 157, half: 348, full: 348 };
  // The folded half is reported as full, so the map tiles hide and the grab label says "helemaal open"
  expect(nextSnap('peek', twoStops)).toBe('full');
  expect(nextSnap('half', twoStops)).toBe('peek');
  expect(nextSnap('full', twoStops)).toBe('peek');
  expect(nextSnap('half', { peek: 170, half: 380, full: 700 })).toBe('full');
});

describe('two-stop sheet (half folded into full)', () => {
  const twoStops = { peek: 157, half: 348, full: 348 };
  test('normalizeSnap reports half as full only when they are the same height', () => {
    expect(normalizeSnap('half', twoStops)).toBe('full');
    expect(normalizeSnap('peek', twoStops)).toBe('peek');
    expect(normalizeSnap('full', twoStops)).toBe('full');
    expect(normalizeSnap('half', { peek: 170, half: 380, full: 700 })).toBe('half');
    expect(normalizeSnap('half', null)).toBe('half');
  });
  test('settleSnap never lands on the folded half', () => {
    expect(settleSnap(340, 0, twoStops)).toBe('full');
    expect(settleSnap(200, 0.8, twoStops)).toBe('full');
    expect(settleSnap(330, -0.8, twoStops)).toBe('peek');
    expect(settleSnap(170, 0, twoStops)).toBe('peek');
  });
});

test('grabLabel names the current snap', () => {
  expect(grabLabel('peek')).toBe('Paneel groter of kleiner maken, nu ingeklapt');
  expect(grabLabel('half')).toContain('half open');
  expect(grabLabel('full')).toContain('helemaal open');
});

describe('phoneMapPadding', () => {
  test('pads the bottom for the sheet and a docked card', () => {
    expect(phoneMapPadding({ sheet: 380, card: 0, mapHeight: 800 })).toEqual({ top: 0, right: 0, bottom: 380, left: 0 });
    expect(phoneMapPadding({ sheet: 380, card: 100, mapHeight: 800 })).toEqual({ top: 0, right: 0, bottom: dockedPadding(380, 100, 800), left: 0 });
  });

  test('landscape: the left pads for the sheet column, the bottom only for a docked card', () => {
    expect(phoneMapPadding({ sheet: 300, card: 0, mapHeight: 390, sheetSide: 408, safeBottom: 20 })).toEqual({ top: 0, right: 0, bottom: 0, left: 408 });
    expect(phoneMapPadding({ sheet: 300, card: 120, mapHeight: 390, sheetSide: 408, safeBottom: 20 })).toEqual({ top: 0, right: 0, bottom: 20 + 10 + 120 + 10, left: 408 });
  });
});

describe('landscapeSheetBox', () => {
  test('at most 400px wide and never more than half the screen', () => {
    expect(landscapeSheetBox(932, 0)).toEqual({ left: 8, width: 400 });
    expect(landscapeSheetBox(700, 0)).toEqual({ left: 8, width: 350 });
  });

  test('clear of the notch', () => {
    expect(landscapeSheetBox(932, 47)).toEqual({ left: 47, width: 400 });
  });
});

describe('dockedPadding', () => {
  test('only the sheet without a docked card', () => expect(dockedPadding(380, 0, 800)).toBe(380));
  test('sheet + gap + card + gap while a card is docked', () => expect(dockedPadding(170, 200, 800)).toBe(390));
  test('leaves at least 60px of map', () => expect(dockedPadding(141, 200, 360)).toBe(300));
  test('never below the sheet itself', () => expect(dockedPadding(340, 200, 360)).toBe(340));
});

describe('dockCardMax', () => {
  test('what is left above the sheet, the gap, the safe area and the margin', () => {
    expect(dockCardMax({ visibleH: 360, sheet: 141, safeTop: 0, tiles: 0 })).toBe(201);
  });
  test('minus the tile stack (and its gap) when the tiles sit above the card', () => {
    expect(dockCardMax({ visibleH: 760, sheet: 380, safeTop: 47, tiles: 146 })).toBe(161);
  });
  test('never negative', () => expect(dockCardMax({ visibleH: 400, sheet: 388, safeTop: 0, tiles: 0 })).toBe(0));
});

describe('rowDock', () => {
  test('portrait at peek keeps the card under the tiles', () => {
    expect(rowDock({ visibleH: 760, safeTop: 47, base: 170 })).toBe(false);
  });
  test('portrait at half has too little room above the sheet: card beside the tiles', () => {
    expect(rowDock({ visibleH: 760, safeTop: 47, base: 380 })).toBe(true);
  });
  test('a short phone is a row even at peek', () => {
    expect(rowDock({ visibleH: 560, safeTop: 20, base: 140 })).toBe(true);
  });
  test('landscape (dock on the bottom safe area) is a row', () => {
    expect(rowDock({ visibleH: 390, safeTop: 0, base: 21 })).toBe(true);
  });
  test('exactly the minimum room keeps the column', () => {
    expect(rowDock({ visibleH: 520, safeTop: 0, base: 100 })).toBe(false);
  });
});
