import type { SidebarSectionId } from '@/stores/sidebar.store';

/** The laptop sidebar's sections, in the order SidebarSections renders them */
export const SIDEBAR_SECTIONS = ['foxes', 'hints', 'points', 'hunts', 'predictions', 'hintEntry', 'counterHunt', 'telegram', 'tracking', 'life360', 'jotiboard'] as const satisfies readonly SidebarSectionId[];

/** The same sections in the phone menu's order (MobileMenu: "Spel", then "Jij") */
export const PHONE_MENU_SECTIONS = ['foxes', 'hintEntry', 'hunts', 'telegram', 'predictions', 'hints', 'points', 'counterHunt', 'tracking', 'life360', 'jotiboard'] as const satisfies readonly SidebarSectionId[];

/**
 * Every element the tour can point at. Components mark themselves with {...tourTarget(id)};
 * steps refer to the same ids, so a moved component keeps working and a typo does not compile.
 */
export const TOUR_TARGET_IDS = [
  'map',
  'sidebar.root',
  ...SIDEBAR_SECTIONS.map((id) => `sidebar.${id}` as const),
  'cards.topRight',
  'map.layersButton',
  'settings.replayItem',
  'tour.panel',
] as const;

export type TourTargetId = (typeof TOUR_TARGET_IDS)[number];

export function tourTarget(id: TourTargetId) {
  return { 'data-tour': id } as const;
}

export function tourSelector(id: TourTargetId) {
  return `[data-tour="${id}"]`;
}
