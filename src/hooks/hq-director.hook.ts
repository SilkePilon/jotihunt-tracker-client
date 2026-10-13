import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MapRef } from '@/components/Map';
import { AREA_ZOOM, eventHoldMs, FLY_MS, HOME_ZOOM, homeTarget, teamsBounds, tourStops, TOUR_DWELL_MS, type HqFox, type LngLat } from '@/lib/hq-director';
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

  // Read by the step effect: the data changes every second, the camera only per step
  const latest = useRef({ stop, foxes, teams, homeTeam, current });
  useEffect(() => {
    latest.current = { stop, foxes, teams, homeTeam, current };
  });

  // The step the overview was last fitted for; the teams usually load after the first (overview) step started
  const overviewFitStep = useRef<number | null>(null);

  useEffect(() => {
    const { stop, foxes, teams, homeTeam, current } = latest.current;
    const map = mapRef.current;
    const fly = (center: LngLat, zoom: number) => map?.flyTo({ center, zoom, ...FLIGHT });
    if (current) {
      const camera = current.camera;
      if (camera?.kind === 'area') {
        const center = foxes.find((fox) => fox.key === camera.area)?.center;
        if (center) fly(center, camera.zoom);
      } else if (camera?.kind === 'home' && homeTeam) {
        fly(homeTarget(homeTeam.location.coordinates as LngLat, camera.direction), HOME_ZOOM);
      }
    } else if (stop.kind === 'area') {
      fly(stop.center, AREA_ZOOM);
    } else {
      const bounds = teamsBounds(teams);
      if (bounds) {
        map?.fitBounds(bounds, { padding: OVERVIEW_PADDING, duration: FLY_MS });
        overviewFitStep.current = step;
      }
    }
    const timer = setTimeout(advance, current ? eventHoldMs(current) : FLY_MS + TOUR_DWELL_MS);
    return () => clearTimeout(timer);
  }, [step, mapRef, advance]);

  // Teams arrived during the overview stop: fit it now, without restarting the step's timer
  const overviewReady = !current && stop.kind === 'overview' && teamsBounds(teams) !== null;
  useEffect(() => {
    const bounds = teamsBounds(latest.current.teams);
    if (!overviewReady || !bounds || overviewFitStep.current === step) return;
    mapRef.current?.fitBounds(bounds, { padding: OVERVIEW_PADDING, duration: FLY_MS });
    overviewFitStep.current = step;
  }, [overviewReady, step, mapRef]);

  useEffect(() => reset, [reset]);

  const focusArea = current ? (current.camera?.kind === 'area' ? current.camera.area : null) : stop.kind === 'area' ? stop.area : null;
  return { current, queued: queue.length, stop, stopIndex, stopCount: stops.length, step, focusArea };
}
