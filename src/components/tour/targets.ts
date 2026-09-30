import type { SidebarSectionId } from '@/stores/sidebar.store';

const SIDEBAR_SECTIONS = ['foxes', 'hints', 'hunts', 'predictions', 'hintEntry', 'counterHunt', 'tracking', 'hunters'] as const satisfies readonly SidebarSectionId[];

/**
 * Every element the tour can point at. Components mark themselves with {...tourTarget(id)};
 * steps refer to the same ids, so a moved component keeps working and a typo does not compile.
 */
export const TOUR_TARGET_IDS = [
  'map',
  'sidebar.root',
  ...SIDEBAR_SECTIONS.map((id) => `sidebar.${id}` as const),
  'hintBoard.dialog',
  'huntCapture.button',
  'cards.topRight',
  'settings.replayItem',
] as const;

export type TourTargetId = (typeof TOUR_TARGET_IDS)[number];

export function tourTarget(id: TourTargetId) {
  return { 'data-tour': id } as const;
}

export function tourSelector(id: TourTargetId) {
  return `[data-tour="${id}"]`;
}
