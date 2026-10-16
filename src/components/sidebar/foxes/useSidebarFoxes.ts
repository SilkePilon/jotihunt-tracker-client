import { useMemo } from 'react';
import { useAreas } from '@/hooks/areas.hook';
import { useSyncedHunts } from '@/hooks/hunt-sync.hook';
import { useNow } from '@/hooks/now.hook';
import { sidebarFoxes, type SidebarFox } from '@/lib/fox-status';

/** The sidebar's foxes, re-sorted every second (cooldowns tick); undefined while the areas load. */
export function useSidebarFoxes(): SidebarFox[] | undefined {
  const { areas } = useAreas();
  const { hunts } = useSyncedHunts();
  const now = useNow(true);
  return useMemo(() => (areas ? sidebarFoxes({ areas, hunts, now }) : undefined), [areas, hunts, now]);
}
