import { useEffect, useRef } from 'react';
import { cooldownEvent, endedCooldowns, huntEvent, newSyncEvents, type HqFox } from '@/lib/hq-director';
import useHqDirectorStore from '@/stores/hq-director.store';
import type { HuntSyncEvent } from '@/types/HuntSync';

/** Events the notification feed doesn't bring to the HQ: new sync log lines (hunts) and a fox whose cooldown ran out. */
export function useHqEventSources(foxes: HqFox[], events: HuntSyncEvent[] | undefined) {
  const push = useHqDirectorStore((state) => state.push);

  const seenEvents = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!events) return;
    const fresh = newSyncEvents(seenEvents.current, events);
    // Grows with older pages too, so a page loaded later doesn't replay as new
    seenEvents.current = new Set([...(seenEvents.current ?? []), ...events.map((event) => event._id)]);
    // Oldest first, so the newest ends up last in the queue
    push(fresh.reverse().map(huntEvent));
  }, [events, push]);

  const cooldowns = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    if (foxes.length === 0) return;
    const ended = endedCooldowns(cooldowns.current, foxes);
    cooldowns.current = new Map(foxes.map((fox) => [fox.key, fox.cooldownMs]));
    push(ended.map(cooldownEvent));
  }, [foxes, push]);
}
