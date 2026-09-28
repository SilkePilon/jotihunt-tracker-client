import { useState } from 'react';
import { ListOrderedIcon, RefreshCwIcon, SmartphoneIcon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/media.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { formatAccuracy, formatBattery, formatDistance, formatLastUpdate, formatSpeed, notConfiguredText } from '@/lib/tracker';
import type { TrackerMe, Vehicle } from '@/types/Tracker';
import type { User } from '@/types/User';
import TrackerQrCode from './TrackerQrCode';
import VehiclePicker from './VehiclePicker';

const CLOCK_TICK_MS = 30_000;

interface TrackerCardProps {
  status: TrackerMe | undefined;
  isError: boolean;
  savingVehicle: boolean;
  onVehicleChange: (vehicle: Vehicle) => void;
  onOpenGuide: () => void;
}

/** Content of the "Mijn tracker" section: not configured / QR to connect / stats when connected. */
export default function TrackerCard({ status, isError, savingVehicle, onVehicleChange, onOpenGuide }: TrackerCardProps) {
  const auth = useAuthUser<User>();
  const isMobile = useIsMobile();
  const [relink, setRelink] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

  if (!status) {
    if (isError) return <p className="text-xs text-muted-foreground">Trackerstatus kan niet worden geladen.</p>;
    return <Skeleton className="h-52 rounded-md" />;
  }

  if (!status.configured) {
    const text = notConfiguredText(status.reason, !!auth?.admin);
    return (
      <div className="flex flex-col gap-1 text-xs text-muted-foreground" data-tracker-state="not-configured">
        <p>{text.title}</p>
        {text.hint && <p>{text.hint}</p>}
      </div>
    );
  }

  const vehiclePicker = <VehiclePicker value={status.vehicle} disabled={savingVehicle} onChange={onVehicleChange} />;

  if (status.connected && !relink) {
    const { stats } = status;
    const rows: [string, string][] = [
      ['Laatste update', formatLastUpdate(stats.lastUpdate, now)],
      ['Snelheid', formatSpeed(stats.speedKmh)],
      ['Batterij', formatBattery(stats.battery)],
      ['Nauwkeurigheid', formatAccuracy(stats.accuracyM)],
      ['Afstand vandaag', formatDistance(stats.distanceTodayM)],
    ];
    return (
      <div className="flex flex-col gap-2" data-tracker-state="connected">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {vehiclePicker}
        <Button variant="outline" size="sm" onClick={() => setRelink(true)}>
          <RefreshCwIcon />
          Opnieuw koppelen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2" data-tracker-state="pairing">
      <TrackerQrCode value={status.qrUrl} />
      <p className="text-center text-xs text-muted-foreground">Scan deze code met de Traccar Client-app</p>
      {vehiclePicker}
      {isMobile && (
        <Button asChild size="sm" className="w-full">
          <a href={status.deepLink}>
            <SmartphoneIcon />
            Open in Traccar-app
          </a>
        </Button>
      )}
      <div className="flex w-full gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onOpenGuide}>
          <ListOrderedIcon />
          Uitleg stap voor stap
        </Button>
        {status.connected && (
          <Button variant="ghost" size="sm" onClick={() => setRelink(false)}>
            Klaar
          </Button>
        )}
      </div>
    </div>
  );
}
