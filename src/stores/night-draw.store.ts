import { create } from 'zustand';

/** Drawing an own night area on the big map (Beheer → Routes → "Gebied tekenen"), and whether the saved areas show. */
export interface NightDrawState {
  /** Draw mode is on (Beheer is closed meanwhile) */
  active: boolean;
  kind: 'closed' | 'open';
  /** The tapped corners, [lng, lat] */
  points: [number, number][];
  /** The ring is closed (double tap): the name input shows and Opslaan is enabled */
  closed: boolean;
  /** The Routes card is open: show the saved areas on the map */
  showAreas: boolean;
  start(kind?: 'closed' | 'open'): void;
  setKind(kind: 'closed' | 'open'): void;
  addPoint(p: [number, number]): void;
  /** Reopens a closed ring, else drops the last corner */
  undo(): void;
  /** Closes the ring (needs 3 corners) */
  close(): void;
  cancel(): void;
  setShowAreas(show: boolean): void;
}

export const useNightDraw = create<NightDrawState>()((set) => ({
  active: false,
  kind: 'closed',
  points: [],
  closed: false,
  showAreas: false,
  start: (kind = 'closed') => set({ active: true, kind, points: [], closed: false }),
  setKind: (kind) => set({ kind }),
  addPoint: (p) => set((s) => (s.closed ? s : { points: [...s.points, p] })),
  undo: () => set((s) => (s.closed ? { closed: false } : { points: s.points.slice(0, -1) })),
  close: () => set((s) => (s.points.length >= 3 ? { closed: true } : s)),
  cancel: () => set({ active: false, points: [], closed: false }),
  setShowAreas: (showAreas) => set({ showAreas }),
}));

/** The polygon ring through `points` (first corner repeated at the end); null with fewer than 3 corners. */
export function ringFromPoints(points: [number, number][]): [number, number][] | null {
  return points.length >= 3 ? [...points, points[0]] : null;
}
