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
  // Phones: the peek strip (own tracker line + fox bar) and the menu's row per section
  'mobile.peek',
  ...PHONE_MENU_SECTIONS.map((id) => `menu.${id}` as const),
  'cards.topRight',
  'map.layersButton',
  'settings.replayItem',
  'tour.panel',
] as const;

export type TourTargetId = (typeof TOUR_TARGET_IDS)[number];

export function tourTarget(id: TourTargetId) {
  return { 'data-tour': id } as const;
}

/** The phone menu row's target for a section row (none for the other rows, e.g. Meldingen) */
export function menuRowTourTarget(key: string) {
  return (PHONE_MENU_SECTIONS as readonly string[]).includes(key) ? { 'data-tour': `menu.${key}` } : {};
}

/** The section a sidebar card or phone menu row target points at ('sidebar.foxes', 'menu.foxes' -> 'foxes'); null otherwise */
export function sectionOfTarget(id: TourTargetId): SidebarSectionId | null {
  const match = /^(?:sidebar|menu)\.(.+)$/.exec(id);
  return match && match[1] !== 'root' ? (match[1] as SidebarSectionId) : null;
}

export function tourSelector(id: TourTargetId) {
  return `[data-tour="${id}"]`;
}
