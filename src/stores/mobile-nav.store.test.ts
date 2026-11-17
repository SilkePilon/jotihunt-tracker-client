import { afterEach, describe, expect, test } from 'bun:test';
import useMobileNavStore from './mobile-nav.store';
import useSidebarStore from './sidebar.store';

describe('mobile nav push', () => {
  afterEach(() => {
    useMobileNavStore.getState().reset();
    useSidebarStore.getState().setSheetSnap('peek');
  });

  test('a page gets the whole sheet by default', () => {
    useMobileNavStore.getState().push({ id: 'hintEntry' });
    expect(useMobileNavStore.getState().stack.at(-1)?.id).toBe('hintEntry');
    expect(useSidebarStore.getState().sheetSnap).toBe('full');
  });

  test('a page can open at half height (a map point stays in view)', () => {
    useMobileNavStore.getState().push({ id: 'hintEntry' }, 'half');
    expect(useSidebarStore.getState().sheetSnap).toBe('half');
    expect(useSidebarStore.getState().openSections.hintEntry).toBe(true);
  });
});
