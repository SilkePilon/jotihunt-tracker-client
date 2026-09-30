export interface SpringState { value: number; velocity: number }

const MAX_DT_MS = 64;
const SUB_STEP_MS = 16;

/**
 * Advance a damped spring toward `target` by `dtMs` (semi-implicit Euler, sub-stepped at ≤16ms).
 * Velocity is in units per second. The defaults are close to critically damped: no visible overshoot.
 */
export function stepSpring(
  state: SpringState,
  target: number,
  dtMs: number,
  { stiffness = 170, damping = 26 }: { stiffness?: number; damping?: number } = {},
): SpringState {
  // A background tab can report a huge dt; clamp so the integration stays stable
  let remaining = Math.min(Math.max(dtMs, 0), MAX_DT_MS);
  let { value, velocity } = state;
  while (remaining > 0) {
    const dt = Math.min(remaining, SUB_STEP_MS) / 1000;
    const acceleration = -stiffness * (value - target) - damping * velocity;
    velocity += acceleration * dt;
    value += velocity * dt;
    remaining -= SUB_STEP_MS;
  }
  return { value, velocity };
}

/** True when the spring is close enough to `target` and slow enough to snap and stop animating. */
export function settled(state: SpringState, target: number, epsilon = 0.5): boolean {
  return Math.abs(state.value - target) < epsilon && Math.abs(state.velocity) < epsilon;
}
