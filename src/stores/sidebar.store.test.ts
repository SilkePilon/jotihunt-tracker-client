import { afterEach, describe, expect, test } from 'bun:test';
import useSidebarStore from './sidebar.store';

const TWO_STOPS = { peek: 157, half: 348, full: 348 };
const THREE_STOPS = { peek: 170, half: 380, full: 700 };

describe('sheet snap on a two-stop sheet', () => {
  afterEach(() => {
    useSidebarStore.getState().setSheetSnapHeights(null);
    useSidebarStore.getState().setSheetSnap('peek');
  });

  test('asking for half gives full when half is folded into full', () => {
    useSidebarStore.getState().setSheetSnapHeights(TWO_STOPS);
    useSidebarStore.getState().setSheetSnap('half');
    expect(useSidebarStore.getState().sheetSnap).toBe('full');
  });

  test('half stays half on a three-stop sheet', () => {
    useSidebarStore.getState().setSheetSnapHeights(THREE_STOPS);
    useSidebarStore.getState().setSheetSnap('half');
    expect(useSidebarStore.getState().sheetSnap).toBe('half');
  });

  test('a sheet at half becomes full when the screen turns short', () => {
    useSidebarStore.getState().setSheetSnapHeights(THREE_STOPS);
    useSidebarStore.getState().setSheetSnap('half');
    useSidebarStore.getState().setSheetSnapHeights(TWO_STOPS);
    expect(useSidebarStore.getState().sheetSnap).toBe('full');
  });
});
