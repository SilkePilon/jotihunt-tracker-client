/**
 * The Android Material `cookie` shape (9 lobes): r(θ) = R · (1 − depth · (1 + cos 9θ) / 2). Shared by the map's
 * canvas markers and the SVG badges, so the site and the app draw the same shape.
 */
export const COOKIE_LOBES = 9;
/** Hunt marker on the map (subtle lobes on a big shape). */
export const MARKER_COOKIE_DEPTH = 0.07;
/** Check badges (deeper lobes so small badges still read as a cookie). */
export const BADGE_COOKIE_DEPTH = 0.15;

/** Radius at `angle` (radians, 0 = up) of a cookie with outer radius `radius`. */
export function cookieRadius(radius: number, angle: number, depth: number): number {
  return radius * (1 - (depth * (1 + Math.cos(COOKIE_LOBES * angle))) / 2);
}

/** Outline points clockwise from the top, without repeating the first point. */
export function cookiePoints(cx: number, cy: number, radius: number, depth: number, steps = 180): [number, number][] {
  return Array.from({ length: steps }, (_, i) => {
    const angle = (2 * Math.PI * i) / steps;
    const r = cookieRadius(radius, angle, depth);
    return [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
  });
}

/** SVG path of a cookie filling a `size` × `size` box. */
export function cookiePath(size: number, depth: number): string {
  const c = size / 2;
  return `M${cookiePoints(c, c, c, depth)
    .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`)
    .join('L')}Z`;
}
