/**
 * Tap targets for map dots that can sit close together (hint-guess candidates): each dot's round hit area grows up to
 * `max` px across, but never past half the distance to its nearest neighbour, so two hit areas never overlap and a tap
 * always goes to the nearest dot.
 * @param points screen positions in px (map.project)
 * @returns the hit diameter per point, in px
 */
export function spacedHitDiameters(points: readonly { x: number; y: number }[], max: number): number[] {
  return points.map((point, index) => {
    let nearest = Infinity;
    points.forEach((other, otherIndex) => {
      if (otherIndex !== index) nearest = Math.min(nearest, Math.hypot(point.x - other.x, point.y - other.y));
    });
    return Math.min(max, nearest);
  });
}
