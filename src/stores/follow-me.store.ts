import { create } from 'zustand';
import type { LatLng } from '@/lib/own-position';

/** The own position "Mijn locatie" last found, and when */
export interface LocatedFix extends LatLng {
  at: number;
}

interface FollowMeState {
  /** Phones: "Mijn locatie" keeps the map centred on the own position (FollowMe) until the user moves the map */
  following: boolean;
  /** When following last started (null while off): the idle stop counts from here or the last interaction after it */
  startedAt: number | null;
  start: (now?: number) => void;
  stop: () => void;
  /** The last successful "Mijn locatie": the phone's "Hunt hier" tile stays a little while after following ends */
  located: LocatedFix | null;
  setLocated: (fix: LocatedFix) => void;
}

const useFollowMeStore = create<FollowMeState>()((set) => ({
  following: false,
  startedAt: null,
  start: (now = Date.now()) => set({ following: true, startedAt: now }),
  stop: () => set((state) => (state.following ? { following: false, startedAt: null } : state)),
  located: null,
  setLocated: (located) => set({ located }),
}));

/** Following (and the screen kept on) ends after this long without a touch, key or wheel on the map or the sheet */
export const FOLLOW_IDLE_MS = 10 * 60_000;

/**
 * Pure: whether following has run idle at `now`: no interaction (prompt-queue `interactedAt`: pointer, key, wheel or
 * focus on the map or the sheet, or coming back to the app) for FOLLOW_IDLE_MS since it started or since the last one.
 */
export function followIdle(startedAt: number | null, interactedAt: number | null, now: number): boolean {
  if (startedAt === null) return false;
  const last = Math.max(startedAt, interactedAt ?? -Infinity);
  return now - last >= FOLLOW_IDLE_MS;
}

export default useFollowMeStore;
