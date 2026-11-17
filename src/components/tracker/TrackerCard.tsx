import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import LoadError from '@/components/LoadError';
import { Skeleton } from '@/components/ui/skeleton';
import { SWAP } from '@/lib/motion';
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
  /** Refetch the status after a failed first load */
  onRetry: () => Promise<unknown> | unknown;
  savingVehicle: boolean;
  onVehicleChange: (vehicle: Vehicle) => void;
  onOpenGuide: () => void;
}

/** Content of the "Mijn tracker" section: one view per state (see `trackerView`). */
export default function TrackerCard({ status, isError, onRetry, savingVehicle, onVehicleChange, onOpenGuide }: TrackerCardProps) {
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
  // Connected and no-signal are one view (TrackerLive); every other change of view swaps
  const swapKey = view === 'connected' || view === 'no-signal' ? 'live' : view;

  let content: ReactNode;
  if (view === 'error') {
    content = <LoadError message="Trackerstatus kon niet worden geladen." onRetry={onRetry} />;
  } else if (!status || view === 'loading') {
    content = <Skeleton className="h-40 rounded-md" role="status" aria-label="Trackerstatus laden" />;
  } else if (!status.configured) {
    const text = notConfiguredText(status.reason, !!auth?.admin);
    content = (
      <div className="flex flex-col gap-1 text-xs text-muted-foreground" data-tracker-state="not-configured">
        <p>{text.title}</p>
        {text.hint && <p>{text.hint}</p>}
      </div>
    );
  } else if (view === 'pairing') {
    content = <TrackerPairing pairing={pairing} creating={creating} failed={failed} onRetry={() => void create()} onClose={() => setPairingOpen(false)} />;
  } else if (view === 'idle') {
    content = <TrackerIdle onPair={startPairing} onOpenGuide={onOpenGuide} />;
  } else {
    content = <TrackerLive status={status} savingVehicle={savingVehicle} onVehicleChange={onVehicleChange} onRepair={startPairing} />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={swapKey} {...SWAP}>
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
