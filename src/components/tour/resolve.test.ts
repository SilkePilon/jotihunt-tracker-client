import { describe, expect, test } from 'bun:test';
import { stepsForPlatform, targetFor } from './resolve';
import type { TourStep } from './types';

const base = { title: 't', body: 'b' };
const steps: TourStep[] = [
  { ...base, id: 'all', target: null },
  { ...base, id: 'phone', target: 'sidebar.hunts', only: 'mobile' },
  { ...base, id: 'desk', target: 'cards.topRight', only: 'desktop' },
  { ...base, id: 'split', target: { mobile: 'sidebar.root', desktop: 'map' } },
];

describe('stepsForPlatform', () => {
  test('keeps shared steps and the platform-only ones', () => {
    expect(stepsForPlatform(steps, 'mobile').map((s) => s.id)).toEqual(['all', 'phone', 'split']);
    expect(stepsForPlatform(steps, 'desktop').map((s) => s.id)).toEqual(['all', 'desk', 'split']);
  });
});

describe('section order per platform', () => {
  const section = (id: string, target: TourStep['target']): TourStep => ({ ...base, id, target });
  const tour: TourStep[] = [
    section('welcome', null),
    section('foxes', 'sidebar.foxes'),
    section('hunts', 'sidebar.hunts'),
    section('hints', 'sidebar.hints'),
    section('hintEntry', 'sidebar.hintEntry'),
    section('predictions', 'sidebar.predictions'),
    section('tracker', 'sidebar.tracking'),
    section('settings', 'settings.replayItem'),
  ];

  test('laptop: the sidebar order', () => {
    expect(stepsForPlatform(tour, 'desktop').map((s) => s.id)).toEqual(['welcome', 'foxes', 'hints', 'hunts', 'predictions', 'hintEntry', 'tracker', 'settings']);
  });

  test('phone: the menu order', () => {
    expect(stepsForPlatform(tour, 'mobile').map((s) => s.id)).toEqual(['welcome', 'foxes', 'hintEntry', 'hunts', 'predictions', 'hints', 'tracker', 'settings']);
  });

  test('phone menu rows sort with the section pages', () => {
    const mixed = [section('hints', { desktop: 'sidebar.hints', mobile: 'menu.hints' }), section('hunts', 'sidebar.hunts'), section('foxes', { desktop: 'sidebar.foxes', mobile: 'menu.foxes' })];
    expect(stepsForPlatform(mixed, 'mobile').map((s) => s.id)).toEqual(['foxes', 'hunts', 'hints']);
  });

  test('non-section steps keep their place', () => {
    const mixed = [section('a', 'sidebar.hints'), section('mid', 'map'), section('b', 'sidebar.foxes')];
    expect(stepsForPlatform(mixed, 'desktop').map((s) => s.id)).toEqual(['b', 'mid', 'a']);
  });
});

describe('targetFor', () => {
  test('plain target', () => {
    expect(targetFor(steps[1], 'mobile')).toBe('sidebar.hunts');
  });

  test('null target', () => {
    expect(targetFor(steps[0], 'desktop')).toBeNull();
  });

  test('per-platform target', () => {
    expect(targetFor(steps[3], 'mobile')).toBe('sidebar.root');
    expect(targetFor(steps[3], 'desktop')).toBe('map');
  });

  test('per-platform target missing for a platform is null', () => {
    expect(targetFor({ ...base, id: 'x', target: { mobile: 'map' } }, 'desktop')).toBeNull();
  });
});
