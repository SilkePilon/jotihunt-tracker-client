import { create } from 'zustand';

interface ViewportState {
  /** Height of the visual viewport in px (excludes an open keyboard) */
  visibleH: number;
  /** Keyboard height in px, 0 when closed */
  keyboard: number;
  /** env(safe-area-inset-top / -bottom) in px */
  safeTop: number;
  safeBottom: number;
  /** env(safe-area-inset-left) in px (the notch of a phone held sideways) */
  safeLeft: number;
  /** Width of the layout viewport in px */
  width: number;
  set: (patch: Partial<Omit<ViewportState, 'set'>>) => void;
}

/** Phone viewport measurements, filled by useViewportInsets (mounted once by the mobile shell). */
const useViewportStore = create<ViewportState>()((set) => ({
  visibleH: typeof window === 'undefined' ? 800 : window.innerHeight,
  keyboard: 0,
  safeTop: 0,
  safeBottom: 0,
  safeLeft: 0,
  width: typeof window === 'undefined' ? 400 : window.innerWidth,
  set: (patch) => set(patch),
}));

export default useViewportStore;
