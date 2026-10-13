import { useState } from 'react';
import useInterval from '@/hooks/utils/interval.hook';
import { formatLastUpdate } from '@/lib/tracker';
import type { TrackerMe, Vehicle } from '@/types/Tracker';
import CookieBadge from './CookieBadge';
import { inlineLinkClass } from './styles';
import VehicleMenu from './VehicleMenu';

const CLOCK_TICK_MS = 30_000;

interface TrackerLiveProps {
  status: Extract<TrackerMe, { configured: true }>;
  savingVehicle: boolean;
  onVehicleChange: (vehicle: Vehicle) => void;
  /** Pair again (e.g. a new phone) */
  onRepair: () => void;
}

/** Paired: green cookie check while live, amber when the phone stopped reporting; plus the vehicle pill. */
export default function TrackerLive({ status, savingVehicle, onVehicleChange, onRepair }: TrackerLiveProps) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
  const live = status.connected;
  const ago = formatLastUpdate(status.stats.lastUpdate, now);

  return (
    <div className="flex flex-col items-center gap-0.5 pt-1 pb-0.5 text-center" data-tracker-state={live ? 'connected' : 'no-signal'}>
      <CookieBadge tone={live ? 'ok' : 'warn'} size={72} />
      <p className="mt-2 text-base font-bold">{live ? 'Verbonden' : 'Geen signaal'}</p>
      <p className="text-xs text-muted-foreground">
        {live ? `Live · ${ago}` : `Laatste locatie ${ago}`} ·{' '}
        <button type="button" className={inlineLinkClass} onClick={onRepair}>
          wijzig
        </button>
      </p>
      {!live && <p className="text-xs text-muted-foreground">Staat de app nog aan?</p>}
      <div className="mt-2.5">
        <VehicleMenu value={status.vehicle} saving={savingVehicle} onChange={onVehicleChange} />
      </div>
    </div>
  );
}
