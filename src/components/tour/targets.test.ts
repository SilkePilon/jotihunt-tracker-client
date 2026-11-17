import { describe, expect, test } from 'bun:test';
import { menuRowTourTarget, sectionOfTarget, TOUR_TARGET_IDS } from './targets';

describe('sectionOfTarget', () => {
  test('sidebar card and phone menu row point at their section', () => {
    expect(sectionOfTarget('sidebar.foxes')).toBe('foxes');
    expect(sectionOfTarget('menu.hintEntry')).toBe('hintEntry');
  });

  test('other targets are not sections', () => {
    expect(sectionOfTarget('sidebar.root')).toBeNull();
    expect(sectionOfTarget('mobile.peek')).toBeNull();
    expect(sectionOfTarget('map')).toBeNull();
  });
});

describe('menuRowTourTarget', () => {
  test('section rows get a known menu target', () => {
    const attrs = menuRowTourTarget('tracking') as { 'data-tour'?: string };
    expect(attrs['data-tour']).toBe('menu.tracking');
    expect((TOUR_TARGET_IDS as readonly string[]).includes(attrs['data-tour']!)).toBe(true);
  });

  test('other rows (Meldingen, Account, Beheer) get none', () => {
    expect(menuRowTourTarget('meldingen')).toEqual({});
    expect(menuRowTourTarget('users')).toEqual({});
  });
});
