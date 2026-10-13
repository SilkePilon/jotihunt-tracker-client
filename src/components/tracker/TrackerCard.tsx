import { useState } from 'react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { Skeleton } from '@/components/ui/skeleton';
import { usePairingCode } from '@/hooks/app-pairing.hook';
import { notConfiguredText, trackerView } from '@/lib/tracker';
import type { TrackerMe, Vehicle } from '@/types/Tracker';
import type { User } from '@/types/User';
import TrackerIdle from './TrackerIdle';
import TrackerLive from './TrackerLive';
import TrackerPairing from './TrackerPairing';

interface TrackerCardProps {
  status: TrackerMe | undefined;
  isError: boolean;
  savingVehicle: boolean;
  onVehicleChange: (vehicle: Vehicle) => void;
  onOpenGuide: () => void;
}

/** Content of the "Mijn tracker" section: one view per state (see `trackerView`). */
export default function TrackerCard({ status, isError, savingVehicle, onVehicleChange, onOpenGuide }: TrackerCardProps) {
  const auth = useAuthUser<User>();
  const { pairing, creating, failed, create } = usePairingCode();
  const [pairingOpen, setPairingOpen] = useState(false);

  // Leave the pairing panel once the phone connects (adjusted during render, like TrackerSection). Re-pairing while
  // already connected has no such transition, so there only ✕ closes it.
  const connected = status?.configured ? status.connected : undefined;
  const [prevConnected, setPrevConnected] = useState(connected);
  if (connected !== prevConnected) {
    setPrevConnected(connected);
    if (connected && prevConnected === false) setPairingOpen(false);
  }

  function startPairing() {
    setPairingOpen(true);
    void create();
  }

  const view = trackerView(status, isError, pairingOpen);
  if (view === 'error') return <p className="text-xs text-muted-foreground">Trackerstatus kan niet worden geladen.</p>;
  if (!status || view === 'loading') return <Skeleton className="h-40 rounded-md" />;

  if (!status.configured) {
    const text = notConfiguredText(status.reason, !!auth?.admin);
    return (
      <div className="flex flex-col gap-1 text-xs text-muted-foreground" data-tracker-state="not-configured">
        <p>{text.title}</p>
        {text.hint && <p>{text.hint}</p>}
      </div>
    );
  }

  if (view === 'pairing') {
    return <TrackerPairing pairing={pairing} creating={creating} failed={failed} onRetry={() => void create()} onClose={() => setPairingOpen(false)} />;
  }
  if (view === 'idle') return <TrackerIdle onPair={startPairing} onOpenGuide={onOpenGuide} />;
  return <TrackerLive status={status} savingVehicle={savingVehicle} onVehicleChange={onVehicleChange} onRepair={startPairing} />;
}
