/**
 * The phone bottom sheet's heights, in px measured from the bottom of the layout viewport. `bottom: 0` sits above
 * every mobile browser's own bottom toolbar, so these never need to know about the toolbar itself.
 */
export type SheetSnap = 'peek' | 'half' | 'full';
export const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full'];
export type SnapHeights = Record<SheetSnap, number>;

export const PEEK_MIN = 120;
export const PEEK_MAX_FRACTION = 0.22;
export const FULL_TOP_GAP = 12;
/** px/ms; a faster release moves one snap in the drag direction */
export const FLICK_VELOCITY = 0.45;

export function computeSnapHeights({ visibleH, safeTop, safeBottom, peekContent }: { visibleH: number; safeTop: number; safeBottom: number; peekContent: number }): SnapHeights {
  const full = Math.max(0, Math.round(visibleH - safeTop - FULL_TOP_GAP));
  const peekMax = Math.max(PEEK_MIN, PEEK_MAX_FRACTION * visibleH);
  const peek = Math.min(full, Math.round(Math.min(Math.max(peekContent, PEEK_MIN), peekMax) + safeBottom));
  const half = Math.min(full, Math.max(peek, Math.round(visibleH * 0.5)));
  return { peek, half, full };
}

export function rubberBand(h: number, min: number, max: number): number {
  if (h > max) return max + (h - max) * 0.25;
  if (h < min) return min - (min - h) * 0.4;
  return h;
}

export function settleSnap(height: number, velocity: number, heights: SnapHeights): SheetSnap {
  if (Math.abs(velocity) > FLICK_VELOCITY) {
    const target = velocity > 0 ? SNAP_ORDER.find((s) => heights[s] > height + 2) : [...SNAP_ORDER].reverse().find((s) => heights[s] < height - 2);
    return target ?? (velocity > 0 ? 'full' : 'peek');
  }
  return SNAP_ORDER.reduce((best, s) => (Math.abs(heights[s] - height) < Math.abs(heights[best] - height) ? s : best), 'peek' as SheetSnap);
}

export function nextSnap(snap: SheetSnap): SheetSnap {
  return SNAP_ORDER[(SNAP_ORDER.indexOf(snap) + 1) % SNAP_ORDER.length];
}
