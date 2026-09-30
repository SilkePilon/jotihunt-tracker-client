import type { Placement } from './types';

export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }

export const CARD_MARGIN = 12;
export const CARD_GAP = 12;

type Side = Exclude<Placement, 'auto'>;
const AUTO_ORDER: Side[] = ['right', 'bottom', 'left', 'top'];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function space(target: Rect, viewport: Size): Record<Side, number> {
  return {
    right: viewport.width - (target.x + target.width),
    left: target.x,
    bottom: viewport.height - (target.y + target.height),
    top: target.y,
  };
}

function fits(side: Side, room: Record<Side, number>, card: Size) {
  const needed = side === 'left' || side === 'right' ? card.width : card.height;
  return room[side] >= needed + CARD_GAP + CARD_MARGIN;
}

/** Top-left corner for the tour card, kept inside the viewport. */
export function placeCard({ target, card, viewport, placement = 'auto', isMobile }: {
  target: Rect | null;
  card: Size;
  viewport: Size;
  placement?: Placement;
  isMobile: boolean;
}): { x: number; y: number } {
  const maxX = viewport.width - card.width - CARD_MARGIN;
  const maxY = viewport.height - card.height - CARD_MARGIN;
  const centered = { x: Math.round((viewport.width - card.width) / 2), y: Math.round((viewport.height - card.height) / 2) };
  if (!target) return centered;

  // Phones: card centered horizontally, docked at the edge away from the target
  if (isMobile) {
    const targetCenter = target.y + target.height / 2;
    return { x: Math.max(CARD_MARGIN, centered.x), y: targetCenter > viewport.height / 2 ? CARD_MARGIN : maxY };
  }

  const room = space(target, viewport);
  const side: Side | undefined =
    placement !== 'auto' && fits(placement, room, card) ? placement : AUTO_ORDER.find((s) => fits(s, room, card));
  // Nothing fits beside the target (e.g. the whole map): float in the middle of the screen
  if (!side) return centered;

  const midX = target.x + target.width / 2 - card.width / 2;
  const midY = target.y + target.height / 2 - card.height / 2;
  const raw = {
    right: { x: target.x + target.width + CARD_GAP, y: midY },
    left: { x: target.x - card.width - CARD_GAP, y: midY },
    bottom: { x: midX, y: target.y + target.height + CARD_GAP },
    top: { x: midX, y: target.y - card.height - CARD_GAP },
  }[side];

  return { x: Math.round(clamp(raw.x, CARD_MARGIN, maxX)), y: Math.round(clamp(raw.y, CARD_MARGIN, maxY)) };
}
