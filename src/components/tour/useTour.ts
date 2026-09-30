import { useEffect } from 'react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { useAuth } from '@/hooks/auth.hook';
import { useFetcher } from '@/hooks/utils/api.hook';
import { useIsMobile } from '@/hooks/media.hook';
import useHintBoardStore from '@/stores/hint-board.store';
import useAdminStore from '@/stores/admin.store';
import type { User } from '@/types/User';
import { stepsForPlatform } from './resolve';
import { TOUR_STEPS, TOUR_VERSION } from './steps';
import useTourStore, { type TourMode } from './tour.store';

/** Give the map and sidebar a moment to render before the first step. */
const AUTO_START_DELAY_MS = 1000;

/** Start the tour. 'auto' reports completion (finish or skip) to the server; 'replay' does not. */
export function useStartTour() {
  const isMobile = useIsMobile();
  const authUser = useAuthUser<User>();
  const { updateUserState } = useAuth();
  const { fetch } = useFetcher();

  async function markSeen() {
    // Local state first, so the auto start does not fire again while the request is in flight
    if (authUser) updateUserState({ ...authUser, tutorialVersion: TOUR_VERSION });
    try {
      await fetch('/auth/tutorial', 'POST', { version: TOUR_VERSION });
    } catch (error) {
      // Worst case the tour shows once more on the next login
      console.warn('[tour] could not save tour version', error);
    }
  }

  return (mode: TourMode) => {
    const stepCount = stepsForPlatform(TOUR_STEPS, isMobile ? 'mobile' : 'desktop').length;
    useTourStore.getState().start({ mode, stepCount, onEnd: mode === 'auto' ? () => void markSeen() : undefined });
  };
}

/** Start the tour automatically for users who have not seen this TOUR_VERSION yet, after the forced password change. */
export function useTourAutoStart() {
  const authUser = useAuthUser<User>();
  const active = useTourStore((state) => state.active);
  const hintBoardOpen = useHintBoardStore((state) => state.view !== null);
  const adminDialogOpen = useAdminStore((state) => state.dialog !== null);
  const startTour = useStartTour();

  const due = !!authUser && (authUser.tutorialVersion ?? 0) < TOUR_VERSION;
  const canStart = !!authUser && due && !authUser.requiresPasswordChange && !active && !hintBoardOpen && !adminDialogOpen;

  useEffect(() => {
    if (!canStart) return;
    const timeout = setTimeout(() => startTour('auto'), AUTO_START_DELAY_MS);
    return () => clearTimeout(timeout);
    // startTour is a new function every render; the conditions above are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canStart]);

  return { pending: due || active };
}
