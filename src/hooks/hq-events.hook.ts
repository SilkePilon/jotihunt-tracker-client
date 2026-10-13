import { useEffect, useRef } from 'react';
import { cooldownEvent, endedCooldowns, huntEvent, newReports, type HqFox } from '@/lib/hq-director';
import useHqDirectorStore from '@/stores/hq-director.store';
import type { HuntReport } from '@/types/HuntReport';

/** Events the notification feed doesn't send: a newly registered hunt and a fox whose cooldown ran out. */
export function useHqEventSources(foxes: HqFox[], reports: HuntReport[] | undefined) {
  const push = useHqDirectorStore((state) => state.push);

  const seenReports = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!reports) return;
    const fresh = newReports(seenReports.current, reports);
    seenReports.current = new Set(reports.map((report) => report._id));
    push(fresh.map(huntEvent));
  }, [reports, push]);

  const cooldowns = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    if (foxes.length === 0) return;
    const ended = endedCooldowns(cooldowns.current, foxes);
    cooldowns.current = new Map(foxes.map((fox) => [fox.key, fox.cooldownMs]));
    push(ended.map(cooldownEvent));
  }, [foxes, push]);
}
