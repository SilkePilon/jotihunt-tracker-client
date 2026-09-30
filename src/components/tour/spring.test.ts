import { describe, expect, test } from 'bun:test';
import { settled, stepSpring, type SpringState } from './spring';

function simulate(from: number, target: number, ms: number, dt = 16) {
  let state: SpringState = { value: from, velocity: 0 };
  let max = from;
  for (let t = 0; t < ms; t += dt) {
    state = stepSpring(state, target, dt);
    max = Math.max(max, state.value);
  }
  return { state, max };
}

describe('stepSpring', () => {
  test('converges to the target within ~1s', () => {
    const { state } = simulate(0, 100, 1000);
    expect(Math.abs(state.value - 100)).toBeLessThan(0.5);
    expect(settled(state, 100)).toBe(true);
  });

  test('does not overshoot by more than 1% with the defaults', () => {
    const { max } = simulate(0, 100, 2000);
    expect(max).toBeLessThanOrEqual(101);
  });

  test('moves toward the target', () => {
    const state = stepSpring({ value: 0, velocity: 0 }, 100, 16);
    expect(state.value).toBeGreaterThan(0);
    expect(state.value).toBeLessThan(100);
  });

  test('clamps a huge dt (background tab) to stay finite', () => {
    const state = stepSpring({ value: 0, velocity: 0 }, 100, 1_000_000);
    expect(Number.isFinite(state.value)).toBe(true);
    expect(Number.isFinite(state.velocity)).toBe(true);
    expect(state).toEqual(stepSpring({ value: 0, velocity: 0 }, 100, 64));
  });
});

describe('settled', () => {
  test('true when close and slow', () => {
    expect(settled({ value: 99.8, velocity: 0.1 }, 100)).toBe(true);
  });

  test('false when far away', () => {
    expect(settled({ value: 90, velocity: 0 }, 100)).toBe(false);
  });

  test('false when still moving fast', () => {
    expect(settled({ value: 100, velocity: 50 }, 100)).toBe(false);
  });
});
