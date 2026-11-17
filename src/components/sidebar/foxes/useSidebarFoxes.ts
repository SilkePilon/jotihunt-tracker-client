import { useMemo } from 'react';
import { useAreas } from '@/hooks/areas.hook';
import { useSyncedHunts } from '@/hooks/hunt-sync.hook';
import { useNow } from '@/hooks/now.hook';
import { lastCooldownEnd, sidebarFoxes, type SidebarFox } from '@/lib/fox-status';

/**
 * The sidebar's foxes; undefined while the areas load. Re-sorted every second only while a hunt cooldown runs (the
 * countdowns tick, and the render that reaches the end moves the fox out of cooldown); otherwise only when the areas or
 * hunts change.
 */
export function useSidebarFoxes(): SidebarFox[] | undefined {
  const { areas } = useAreas();
  const { hunts } = useSyncedHunts();
  const cooldownEnd = useMemo(() => (areas ? lastCooldownEnd(areas, hunts) : undefined), [areas, hunts]);
  // Both read the same shared clock, so within a render they agree
  const stillNow = useNow(false);
  const now = useNow(cooldownEnd !== undefined && cooldownEnd > stillNow);
  return useMemo(() => (areas ? sidebarFoxes({ areas, hunts, now }) : undefined), [areas, hunts, now]);
}
