import { AGE_CLOCK_TICK_MS, useNow } from '@/hooks/now.hook';
import { formatLastUpdate, isTrackerLive } from '@/lib/tracker';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { cn } from '@/lib/utils';
import type { TrackerMe, Vehicle } from '@/types/Tracker';
import Reveal from '@/components/motion/Reveal';
import CookieBadge from './CookieBadge';
import { inlineLinkClass } from './styles';
import VehicleMenu from './VehicleMenu';


interface TrackerLiveProps {
  status: Extract<TrackerMe, { configured: true }>;
  savingVehicle: boolean;
  onVehicleChange: (vehicle: Vehicle) => void;
  /** Pair again (e.g. a new phone) */
  onRepair: () => void;
}

/** Paired: green cookie check while live (connected and reported in the last 5 min), amber when the phone stopped
 * reporting; plus the vehicle pill. */
export default function TrackerLive({ status, savingVehicle, onVehicleChange, onRepair }: TrackerLiveProps) {
  const now = useNow(true, AGE_CLOCK_TICK_MS);
  const live = isTrackerLive(status, now);
  const ago = formatLastUpdate(status.stats.lastUpdate, now);

  return (
    // isolate: the link's 44px touch area (COARSE_HIT_AREA) stays above the card's background
    <div className="isolate flex flex-col items-center gap-0.5 pt-1 pb-0.5 text-center" data-tracker-state={live ? 'connected' : 'no-signal'}>
      <CookieBadge tone={live ? 'ok' : 'warn'} size={72} />
      <p className="mt-2 text-base font-bold">{live ? 'Verbonden' : 'Geen signaal'}</p>
      {/* Always mounted: a screen reader hears the tracker drop out or come back (the heading above changes silently) */}
      <span role="status" className="sr-only">{live ? 'Tracker verbonden' : 'Tracker: geen signaal'}</span>
      <p className="text-xs text-muted-foreground tabular-nums">
        {live ? `Live · ${ago}` : `Laatste locatie ${ago}`} ·{' '}
        <button type="button" className={cn(inlineLinkClass, COARSE_HIT_AREA)} onClick={onRepair}>
          opnieuw koppelen
        </button>
      </p>
      <Reveal>{!live && <p className="text-xs text-muted-foreground">Staat de app nog aan?</p>}</Reveal>
      <div className="mt-2.5">
        <VehicleMenu value={status.vehicle} saving={savingVehicle} onChange={onVehicleChange} />
      </div>
    </div>
  );
}
