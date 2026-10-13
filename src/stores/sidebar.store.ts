import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SidebarSectionId = 'foxes' | 'hints' | 'hunts' | 'predictions' | 'hintEntry' | 'counterHunt' | 'telegram' | 'tracking' | 'hunters';
export type SheetSnap = 'peek' | 'half' | 'full';

const DEFAULT_OPEN_SECTIONS: Record<SidebarSectionId, boolean> = {
  foxes: true,
  hints: true,
  hunts: true,
  predictions: false,
  hintEntry: false,
  counterHunt: false,
  telegram: false,
  // Closed by default: the section forces itself open while the user's phone is not connected
  tracking: false,
  hunters: false,
};

interface SidebarState {
  openSections: Record<SidebarSectionId, boolean>;
  toggleSection: (id: SidebarSectionId) => void;
  /** Force a section open, e.g. when another part of the UI needs it visible. */
  openSection: (id: SidebarSectionId) => void;
  setSectionOpen: (id: SidebarSectionId, open: boolean) => void;
  /** Per section, the last event that forced it open (e.g. a tegenhunt's start time), so each event opens it once */
  forcedOpenFor: Partial<Record<SidebarSectionId, string>>;
  /** Open the section for `event` unless it was already opened for it (also across reloads) */
  openOnceFor: (id: SidebarSectionId, event: string) => void;
  sheetSnap: SheetSnap;
  setSheetSnap: (snap: SheetSnap) => void;
}

const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      openSections: DEFAULT_OPEN_SECTIONS,
      toggleSection: (id) => set((state) => ({ openSections: { ...state.openSections, [id]: !state.openSections[id] } })),
      openSection: (id) => set((state) => ({ openSections: { ...state.openSections, [id]: true } })),
      setSectionOpen: (id, open) => set((state) => ({ openSections: { ...state.openSections, [id]: open } })),
      forcedOpenFor: {},
      openOnceFor: (id, event) =>
        set((state) =>
          state.forcedOpenFor[id] === event
            ? state
            : { openSections: { ...state.openSections, [id]: true }, forcedOpenFor: { ...state.forcedOpenFor, [id]: event } },
        ),
      sheetSnap: 'peek',
      setSheetSnap: (sheetSnap) => set({ sheetSnap }),
    }),
    {
      name: 'sidebar-storage',
      storage: createJSONStorage(() => localStorage),
      // Only remember which sections are open (and what forced them open); the sheet always starts at peek
      partialize: (state) => ({ openSections: state.openSections, forcedOpenFor: state.forcedOpenFor }),
      version: 1,
      // Spread defaults under the persisted value so newly added section ids
      // (not present in older persisted state) still get their default.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SidebarState> | undefined;
        return {
          ...currentState,
          ...persisted,
          openSections: { ...DEFAULT_OPEN_SECTIONS, ...persisted?.openSections },
        };
      },
    },
  ),
);

export default useSidebarStore;
