/** Mouse orbit (rotate/tilt) tuning: calmer than MapLibre's 0.8 degrees per pixel. */
export const ORBIT_ROTATE_DEG_PER_PX = 0.3;
export const ORBIT_PITCH_DEG_PER_PX = 0.25;
/** Movement before the drag commits to rotating or tilting */
export const ORBIT_LOCK_PX = 6;
export const ORBIT_MAX_PITCH = 60;
/** Rotation keeps going this long after a fast release */
export const ORBIT_COAST_MS = 300;
/** A flick never coasts further than this */
export const ORBIT_COAST_MAX_DEG = 30;
/** Degrees per ms; slower releases stop at once */
export const ORBIT_COAST_MIN_SPEED = 0.05;
/** A bearing this close to north snaps back to north on release */
export const ORBIT_SNAP_DEG = 7;
const SPEED_WINDOW_MS = 80;

export type OrbitAxis = 'rotate' | 'pitch';
export type SpeedSample = { t: number; bearing: number };

/** Right or middle button, or Ctrl + left button. */
export function isOrbitStart(button: number, ctrlKey: boolean): boolean {
  return button === 2 || button === 1 || (button === 0 && ctrlKey);
}

/** The axis a drag locks to once it moved far enough; null while undecided. */
export function lockAxis(dx: number, dy: number): OrbitAxis | null {
  if (Math.hypot(dx, dy) < ORBIT_LOCK_PX) return null;
  return Math.abs(dx) >= Math.abs(dy) ? 'rotate' : 'pitch';
}

/** The camera after dragging dx/dy pixels on the locked axis. Dragging up tilts more. */
export function orbitStep(axis: OrbitAxis, dx: number, dy: number, bearing: number, pitch: number) {
  if (axis === 'rotate') return { bearing: bearing + dx * ORBIT_ROTATE_DEG_PER_PX, pitch };
  const next = pitch - dy * ORBIT_PITCH_DEG_PER_PX;
  return { bearing, pitch: Math.min(ORBIT_MAX_PITCH, Math.max(0, next)) };
}

/** Extra degrees an ease-out coast adds after release at `speed` degrees per ms. */
export function coastDistance(speed: number): number {
  if (Math.abs(speed) <= ORBIT_COAST_MIN_SPEED) return 0;
  const distance = (speed * ORBIT_COAST_MS) / 2;
  return Math.max(-ORBIT_COAST_MAX_DEG, Math.min(ORBIT_COAST_MAX_DEG, distance));
}

/** The bearing in -180..180, or 0 when within the snap distance of north. */
export function snapBearing(bearing: number): number {
  const normal = ((((bearing + 180) % 360) + 360) % 360) - 180;
  return Math.abs(normal) <= ORBIT_SNAP_DEG ? 0 : normal;
}

/** Rotation speed in degrees per ms over the samples of the last 80 ms. */
export function recentSpeed(samples: SpeedSample[], now: number): number {
  const recent = samples.filter((sample) => now - sample.t <= SPEED_WINDOW_MS);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  return last.t === first.t ? 0 : (last.bearing - first.bearing) / (last.t - first.t);
}
