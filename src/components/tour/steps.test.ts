import { describe, expect, test } from 'bun:test';
import { TOUR_STEPS, TOUR_VERSION } from './steps';
import { PHONE_MENU_SECTIONS, SIDEBAR_SECTIONS, TOUR_TARGET_IDS, sectionOfTarget } from './targets';
import { stepsForPlatform, targetFor } from './resolve';
import { autoAdvances } from './duration';

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

  test('a step has a panel exactly when it targets the tour panel', () => {
    for (const step of TOUR_STEPS) {
      expect(!!step.panel).toBe(step.target === 'tour.panel');
    }
  });

  test('only the welcome and the sounds panel wait for the user; every other step advances by itself', () => {
    const waiting = TOUR_STEPS.filter((step) => !autoAdvances(step)).map((step) => step.id);
    expect(waiting).toEqual(['welcome', 'notification-sounds']);
  });

  test('first and last steps are not optional', () => {
    expect(TOUR_STEPS[0].optional).toBeFalsy();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].optional).toBeFalsy();
  });

  test('section steps follow the visible order: laptop sidebar, phone menu', () => {
    const orders = { desktop: SIDEBAR_SECTIONS, mobile: PHONE_MENU_SECTIONS } as const;
    for (const platform of ['mobile', 'desktop'] as const) {
      const order: readonly string[] = orders[platform];
      const positions = stepsForPlatform(TOUR_STEPS, platform)
        .map((step) => targetFor(step, platform))
        .map((target) => (target ? sectionOfTarget(target) : null))
        .filter((section) => section !== null)
        .map((section) => order.indexOf(section));
      expect(positions.length).toBeGreaterThan(0);
      expect(positions).not.toContain(-1);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  test('phones: peek strip and menu come first, before any section', () => {
    const ids = stepsForPlatform(TOUR_STEPS, 'mobile').map((step) => step.id);
    const firstSection = stepsForPlatform(TOUR_STEPS, 'mobile').findIndex((step) => sectionOfTarget(targetFor(step, 'mobile') ?? 'map') !== null);
    expect(ids.indexOf('peek')).toBeLessThan(ids.indexOf('menu'));
    expect(ids.indexOf('menu')).toBeLessThan(firstSection);
  });

  test('phones: only Hint registreren and Hunts push their page; other sections point at their menu row', () => {
    const pushed: string[] = [];
    for (const step of stepsForPlatform(TOUR_STEPS, 'mobile')) {
      const target = targetFor(step, 'mobile');
      if (target === null || sectionOfTarget(target) === null) continue;
      const names = (step.actions ?? []).map((action) => action.name);
      if (names.some((name) => name.startsWith('showSection('))) {
        pushed.push(sectionOfTarget(target)!);
        expect(target.startsWith('sidebar.')).toBe(true);
      } else {
        expect(target).toBe(`menu.${sectionOfTarget(target)}`);
        expect(names).toContain(`pointAtSection(${sectionOfTarget(target)})`);
      }
    }
    expect(pushed.sort()).toEqual(['hintEntry', 'hunts']);
  });
});
