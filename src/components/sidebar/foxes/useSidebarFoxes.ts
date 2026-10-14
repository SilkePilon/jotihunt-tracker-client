import { useMemo } from 'react';
import { useAreas } from '@/hooks/areas.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useNow } from '@/hooks/now.hook';
import { sidebarFoxes, type SidebarFox } from '@/lib/fox-status';

/** The sidebar's foxes, re-sorted every second (cooldowns tick); undefined while the areas load. */
export function useSidebarFoxes(): SidebarFox[] | undefined {
  const { areas } = useAreas();
  const { hunts } = useHunts();
  const { reports } = useHuntReports();
  const now = useNow(true);
  return useMemo(() => (areas ? sidebarFoxes({ areas, hunts, reports, now }) : undefined), [areas, hunts, reports, now]);
}
