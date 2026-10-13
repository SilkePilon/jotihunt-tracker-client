import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MapRef } from '@/components/Map';
import { AREA_ZOOM, eventHoldMs, eventTarget, FLY_MS, teamsBounds, tourStops, TOUR_DWELL_MS, type HqFox } from '@/lib/hq-director';
import useHqDirectorStore from '@/stores/hq-director.store';
import type { Team } from '@/types/Team';

const FLIGHT = { duration: FLY_MS, curve: 1.25 };
const OVERVIEW_PADDING = 40;

/**
 * Drives the HQ map: on every director step it flies to the event or the tour stop, and advances after the hold/dwell
 * time. Returns what the overlays need.
 */
export function useHqDirector({ mapRef, foxes, teams, homeTeam }: { mapRef: RefObject<MapRef | null>; foxes: HqFox[]; teams: Team[] | undefined; homeTeam: Team | undefined }) {
  const { current, queue, tourIndex, step } = useHqDirectorStore(useShallow((state) => ({ current: state.current, queue: state.queue, tourIndex: state.tourIndex, step: state.step })));
  const advance = useHqDirectorStore((state) => state.advance);
  const reset = useHqDirectorStore((state) => state.reset);
  const stops = useMemo(() => tourStops(foxes), [foxes]);
  const stopIndex = tourIndex % stops.length;
  const stop = stops[stopIndex];

  // The event's flight target, fixed when its step starts: a centre that turns up halfway doesn't move the camera,
  // so the highlight and the hold time follow what the camera actually did
  const [shot, setShot] = useState(() => ({ step, target: current ? eventTarget(current, foxes, homeTeam) : null }));
  if (shot.step !== step) setShot({ step, target: current ? eventTarget(current, foxes, homeTeam) : null });
  const target = shot.step === step ? shot.target : null;

  // Read by the step effect: the data changes every second, the camera only per step
  const latest = useRef({ stop, teams, current, target });
  useEffect(() => {
    latest.current = { stop, teams, current, target };
  });

  // The step the overview was last fitted for; the teams usually load after the first (overview) step started
  const overviewFitStep = useRef<number | null>(null);

  useEffect(() => {
    const { stop, teams, current, target } = latest.current;
    const map = mapRef.current;
    if (current) {
      if (target) map?.flyTo({ ...target, ...FLIGHT });
    } else if (stop.kind === 'area') {
      map?.flyTo({ center: stop.center, zoom: AREA_ZOOM, ...FLIGHT });
    } else {
      const bounds = teamsBounds(teams);
      if (bounds && map?.fitBounds(bounds, { padding: OVERVIEW_PADDING, duration: FLY_MS })) overviewFitStep.current = step;
    }
    const timer = setTimeout(advance, current ? eventHoldMs(target !== null) : FLY_MS + TOUR_DWELL_MS);
    return () => clearTimeout(timer);
  }, [step, mapRef, advance]);

  // The overview stop wasn't fitted yet (teams or the map arrived later): fit it now, without restarting the step's
  // timer. Runs after every render (the clock re-renders every second), as the map ref filling in doesn't re-render.
  const overviewPending = !current && stop.kind === 'overview';
  useEffect(() => {
    if (!overviewPending || overviewFitStep.current === step) return;
    const bounds = teamsBounds(latest.current.teams);
    if (bounds && mapRef.current?.fitBounds(bounds, { padding: OVERVIEW_PADDING, duration: FLY_MS })) overviewFitStep.current = step;
  });

  useEffect(() => reset, [reset]);

  const focusArea = current ? (target && current.camera?.kind === 'area' ? current.camera.area : null) : stop.kind === 'area' ? stop.area : null;
  const holdMs = current ? eventHoldMs(target !== null) : 0;
  return { current, queued: queue.length, stop, stopIndex, stopCount: stops.length, step, focusArea, holdMs };
}
