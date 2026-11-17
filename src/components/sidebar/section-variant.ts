import { createContext } from 'react';

/**
 * How a SidebarSection renders: `card` is the collapsible desktop sidebar card; `page` is a phone page (MobilePage),
 * where the section is the whole page: a static menu-style card that is always open (no trigger, no chevron, and it
 * doesn't touch the persisted collapsed state).
 */
export type SidebarSectionVariant = 'card' | 'page';

export const SidebarSectionVariantContext = createContext<SidebarSectionVariant>('card');
