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
/** A half stop closer than this to peek is no real middle step (landscape phones): the sheet keeps two stops */
export const HALF_MIN_STEP = 140;
/** px/ms; a faster release moves one snap in the drag direction */
export const FLICK_VELOCITY = 0.45;

export function computeSnapHeights({ visibleH, safeTop, safeBottom, peekContent }: { visibleH: number; safeTop: number; safeBottom: number; peekContent: number }): SnapHeights {
  const full = Math.max(0, Math.round(visibleH - safeTop - FULL_TOP_GAP));
  const peekMax = Math.max(PEEK_MIN, PEEK_MAX_FRACTION * visibleH);
  const peek = Math.min(full, Math.round(Math.min(Math.max(peekContent, PEEK_MIN), peekMax) + safeBottom));
  const half = Math.min(full, Math.max(peek, Math.round(visibleH * 0.5)));
  return { peek, half: half - peek < HALF_MIN_STEP ? full : half, full };
}

/** Space between the sheet and the docked card, and between the card and the point the camera keeps above it */
export const DOCK_GAP = 10;
/** The map always keeps at least this much height above the bottom padding */
export const MIN_MAP_ROOM = 60;

/**
 * Phones: the map's bottom padding, so a camera centre lands above the sheet and, while a card is docked, above that
 * card too (sheet + gap + card + gap). Never so much that less than {@link MIN_MAP_ROOM} of the map is left.
 */
export function dockedPadding(sheet: number, card: number, mapHeight: number): number {
  const padding = card > 0 ? sheet + DOCK_GAP + card + DOCK_GAP : sheet;
  return Math.max(0, Math.min(padding, Math.max(sheet, mapHeight - MIN_MAP_ROOM)));
}

export interface CameraPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Phones: the map's camera padding for the sheet and a docked card (see {@link dockedPadding}). */
export function phoneMapPadding({ sheet, card, mapHeight }: { sheet: number; card: number; mapHeight: number }): CameraPadding {
  return { top: 0, right: 0, left: 0, bottom: dockedPadding(sheet, card, mapHeight) };
}

/**
 * Phones: the most height the docked card may take: what is left above the sheet, the dock gap, the safe area, an 8px
 * margin and (when the map tiles stack above the card) the tiles. Never negative.
 */
export function dockCardMax({ visibleH, sheet, safeTop, tiles }: { visibleH: number; sheet: number; safeTop: number; tiles: number }): number {
  return Math.max(0, Math.round(visibleH - sheet - DOCK_GAP - safeTop - 8 - (tiles > 0 ? tiles + 8 : 0)));
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

/** The snap a grab tap moves to; with `heights`, a stop at the same height as the current one is skipped (two-stop sheet). */
export function nextSnap(snap: SheetSnap, heights?: SnapHeights): SheetSnap {
  let next = snap;
  for (let i = 0; i < SNAP_ORDER.length - 1; i++) {
    next = SNAP_ORDER[(SNAP_ORDER.indexOf(next) + 1) % SNAP_ORDER.length];
    if (!heights || heights[next] !== heights[snap]) return next;
  }
  return next;
}

const SNAP_STATE: Record<SheetSnap, string> = { peek: 'ingeklapt', half: 'half open', full: 'helemaal open' };

/** Accessible name of the sheet's grab handle: what a tap does, plus the current snap (screen readers can't see it). */
export function grabLabel(snap: SheetSnap): string {
  return `Paneel groter of kleiner maken, nu ${SNAP_STATE[snap]}`;
}
