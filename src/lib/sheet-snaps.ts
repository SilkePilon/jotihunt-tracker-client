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

/**
 * Phones: the map's camera padding for the sheet and a docked card (see {@link dockedPadding}). Held sideways
 * (`sheetSide` > 0) the sheet is a left column: the left pads for it, the bottom only for a card docked at the
 * bottom edge (above the safe area) right of it.
 */
export function phoneMapPadding({ sheet, card, mapHeight, sheetSide = 0, safeBottom = 0 }: { sheet: number; card: number; mapHeight: number; sheetSide?: number; safeBottom?: number }): CameraPadding {
  if (sheetSide > 0) return { top: 0, right: 0, left: sheetSide, bottom: card > 0 ? dockedPadding(safeBottom, card, mapHeight) : 0 };
  return { top: 0, right: 0, left: 0, bottom: dockedPadding(sheet, card, mapHeight) };
}

/** Landscape phones: the widest the sheet column gets (and never more than half the screen) */
export const LANDSCAPE_SHEET_MAX_W = 400;

/** CSS custom property on <html>: the sideways sheet column's right edge in px (left gap + width), 0px upright */
export const SHEET_SIDE_VAR = '--sheet-side';

/** Landscape phones: the sheet column's left edge (8px, or clear of the notch) and width, in px. */
export function landscapeSheetBox(viewportWidth: number, safeLeft: number): { left: number; width: number } {
  return { left: Math.max(8, Math.round(safeLeft)), width: Math.round(Math.min(LANDSCAPE_SHEET_MAX_W, viewportWidth / 2)) };
}

/**
 * Below this much room above the sheet (its settled height, or the bottom safe area when the sheet is a left column)
 * the dock is a row: the card beside the tile stack instead of under it, which would leave it only ~100px.
 */
export const ROW_DOCK_MIN_ROOM = 420;

/** Phones: whether the popup dock is a row (see {@link ROW_DOCK_MIN_ROOM}); `base` is what the dock stands on. */
export function rowDock({ visibleH, safeTop, base }: { visibleH: number; safeTop: number; base: number }): boolean {
  return visibleH - safeTop - base < ROW_DOCK_MIN_ROOM;
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

/**
 * A two-stop sheet (short screens: half folded into full) has no real half: 'half' there means 'full', so the map
 * tiles hide and the grab label says "helemaal open". Every snap the sheet settles on goes through this.
 */
export function normalizeSnap(snap: SheetSnap, heights: SnapHeights | null | undefined): SheetSnap {
  return snap === 'half' && heights && heights.half === heights.full ? 'full' : snap;
}

export function settleSnap(height: number, velocity: number, heights: SnapHeights): SheetSnap {
  if (Math.abs(velocity) > FLICK_VELOCITY) {
    const target = velocity > 0 ? SNAP_ORDER.find((s) => heights[s] > height + 2) : [...SNAP_ORDER].reverse().find((s) => heights[s] < height - 2);
    return normalizeSnap(target ?? (velocity > 0 ? 'full' : 'peek'), heights);
  }
  return normalizeSnap(SNAP_ORDER.reduce((best, s) => (Math.abs(heights[s] - height) < Math.abs(heights[best] - height) ? s : best), 'peek' as SheetSnap), heights);
}

/** The snap a grab tap moves to; with `heights`, a stop at the same height as the current one is skipped (two-stop sheet). */
export function nextSnap(snap: SheetSnap, heights?: SnapHeights): SheetSnap {
  let next = snap;
  for (let i = 0; i < SNAP_ORDER.length - 1; i++) {
    next = SNAP_ORDER[(SNAP_ORDER.indexOf(next) + 1) % SNAP_ORDER.length];
    if (!heights || heights[next] !== heights[snap]) return normalizeSnap(next, heights);
  }
  return normalizeSnap(next, heights);
}

const SNAP_STATE: Record<SheetSnap, string> = { peek: 'ingeklapt', half: 'half open', full: 'helemaal open' };

/** Accessible name of the sheet's grab handle: what a tap does, plus the current snap (screen readers can't see it). */
export function grabLabel(snap: SheetSnap): string {
  return `Paneel groter of kleiner maken, nu ${SNAP_STATE[snap]}`;
}
