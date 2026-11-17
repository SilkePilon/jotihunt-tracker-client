import { beforeEach, describe, expect, test } from 'bun:test';
import useMobileNavStore from '@/stores/mobile-nav.store';
import useSidebarStore from '@/stores/sidebar.store';
import { pointAtSection, resetToMenu, showSection } from './actions';
import type { TourContext } from './types';

const desktop = { mapRef: { current: null }, isMobile: false } as TourContext;
const phone = { mapRef: { current: null }, isMobile: true } as TourContext;

beforeEach(() => {
  useMobileNavStore.setState({ stack: [], direction: 1 });
  useSidebarStore.getState().setSectionOpen('foxes', false);
});

describe('showSection', () => {
  test('desktop expands the section and the undo collapses it, leaving the nav stack alone', () => {
    const undo = showSection('foxes').run(desktop);
    expect(useSidebarStore.getState().openSections.foxes).toBe(true);
    expect(useMobileNavStore.getState().stack).toEqual([]);
    if (typeof undo === 'function') undo();
    expect(useSidebarStore.getState().openSections.foxes).toBe(false);
  });

  test('phone pushes the page and the undo pops it', () => {
    const undo = showSection('foxes').run(phone);
    expect(useMobileNavStore.getState().stack).toEqual([{ id: 'foxes' }]);
    expect(typeof undo).toBe('function');
    if (typeof undo === 'function') undo();
    expect(useMobileNavStore.getState().stack).toEqual([]);
  });
});

describe('resetToMenu', () => {
  test('phone empties the stack', () => {
    useMobileNavStore.setState({ stack: [{ id: 'hunts' }] });
    resetToMenu().run(phone);
    expect(useMobileNavStore.getState().stack).toEqual([]);
  });

  test('desktop leaves the stack alone', () => {
    useMobileNavStore.setState({ stack: [{ id: 'hunts' }] });
    resetToMenu().run(desktop);
    expect(useMobileNavStore.getState().stack).toEqual([{ id: 'hunts' }]);
  });
});

describe('pointAtSection', () => {
  test('desktop expands the section like showSection', () => {
    const undo = pointAtSection('foxes').run(desktop);
    expect(useSidebarStore.getState().openSections.foxes).toBe(true);
    if (typeof undo === 'function') undo();
    expect(useSidebarStore.getState().openSections.foxes).toBe(false);
  });

  test('phone goes back to the menu without pushing the page', () => {
    useMobileNavStore.setState({ stack: [{ id: 'hunts' }] });
    const undo = pointAtSection('foxes').run(phone);
    expect(useMobileNavStore.getState().stack).toEqual([]);
    expect(undo).toBeUndefined();
  });
});
