import { create } from 'zustand';
import type { IntelTab } from '@/types/Intel';

interface IntelState {
  /** The intel window shows while true */
  open: boolean;
  /** The article shown full width (detail view), or null for the timeline */
  articleId: number | null;
  /** For a hint: the area to unfold first (from the mini grid), or null for the first open area */
  area: string | null;
  tab: IntelTab;
  /** Open the window, optionally on an article (and area of a hint) */
  openIntel: (articleId?: number | null, area?: string | null) => void;
  /** Show an article, or null to go back to the timeline */
  select: (articleId: number | null) => void;
  /** Switch tab; this also leaves an open article (back to that tab's timeline) */
  setTab: (tab: IntelTab) => void;
  close: () => void;
}

const useIntelStore = create<IntelState>()((set) => ({
  open: false,
  articleId: null,
  area: null,
  tab: 'all',
  // Opening on an article shows every kind: a tab that hides it would close it right away
  openIntel: (articleId = null, area = null) => set(articleId === null ? { open: true, articleId, area } : { open: true, articleId, area, tab: 'all' }),
  select: (articleId) => set({ articleId, area: null }),
  setTab: (tab) => set({ tab, articleId: null, area: null }),
  close: () => set({ open: false }),
}));

export default useIntelStore;
