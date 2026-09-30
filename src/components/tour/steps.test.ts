import { describe, expect, test } from 'bun:test';
import { TOUR_STEPS, TOUR_VERSION } from './steps';
import { TOUR_TARGET_IDS } from './targets';
import { stepsForPlatform, targetFor } from './resolve';

describe('TOUR_STEPS', () => {
  test('TOUR_VERSION is at least 1', () => {
    expect(TOUR_VERSION).toBeGreaterThanOrEqual(1);
  });

  test('step ids are unique', () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every step has a title and body', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim()).not.toBe('');
      expect(step.body.trim()).not.toBe('');
    }
  });

  test('every target is a known target id', () => {
    const known = new Set<string>(TOUR_TARGET_IDS);
    for (const platform of ['mobile', 'desktop'] as const) {
      for (const step of TOUR_STEPS) {
        const target = targetFor(step, platform);
        if (target !== null) expect(known.has(target)).toBe(true);
      }
    }
  });

  test('every action has a name', () => {
    for (const step of TOUR_STEPS) {
      for (const action of step.actions ?? []) expect(action.name).toBeTruthy();
    }
  });

  test('each platform gets a real tour that starts and ends with a centered card', () => {
    for (const platform of ['mobile', 'desktop'] as const) {
      const steps = stepsForPlatform(TOUR_STEPS, platform);
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(targetFor(steps[0], platform)).toBeNull();
      expect(targetFor(steps[steps.length - 1], platform)).toBeNull();
    }
  });

  test('first and last steps are not optional', () => {
    expect(TOUR_STEPS[0].optional).toBeFalsy();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].optional).toBeFalsy();
  });
});
