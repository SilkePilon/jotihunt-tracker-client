import { describe, expect, test } from 'bun:test';
import { stepsForPlatform, targetFor } from './resolve';
import type { TourStep } from './types';

const base = { title: 't', body: 'b' };
const steps: TourStep[] = [
  { ...base, id: 'all', target: null },
  { ...base, id: 'phone', target: 'huntCapture.button', only: 'mobile' },
  { ...base, id: 'desk', target: 'cards.topRight', only: 'desktop' },
  { ...base, id: 'split', target: { mobile: 'sidebar.root', desktop: 'map' } },
];

describe('stepsForPlatform', () => {
  test('keeps shared steps and the platform-only ones', () => {
    expect(stepsForPlatform(steps, 'mobile').map((s) => s.id)).toEqual(['all', 'phone', 'split']);
    expect(stepsForPlatform(steps, 'desktop').map((s) => s.id)).toEqual(['all', 'desk', 'split']);
  });
});

describe('targetFor', () => {
  test('plain target', () => {
    expect(targetFor(steps[1], 'mobile')).toBe('huntCapture.button');
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
