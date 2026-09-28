import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import TrackerCard from '@/components/tracker/TrackerCard';
import TrackerGuideDialog from '@/components/tracker/TrackerGuideDialog';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { sectionTransition, trackerSummary } from '@/lib/tracker';
import useSidebarStore from '@/stores/sidebar.store';
import type { Vehicle } from '@/types/Tracker';
import SidebarSection from './SidebarSection';

/**
 * "Mijn tracker": connect this user's phone as GPS tracker. Forced open while the phone is not connected,
 * collapsed once when it connects; after that the user decides (persisted like the other sections).
 */
export default function TrackerSection() {
  const { status, isError, setVehicle } = useTrackerStatus();
  const storedOpen = useSidebarStore((state) => state.openSections.tracking);
  const setSectionOpen = useSidebarStore((state) => state.setSectionOpen);
  const [guideOpen, setGuideOpen] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Adjust the open state during render when `connected` changes (no effect, no ref)
  const connected = status?.configured ? status.connected : undefined;
  const [prevConnected, setPrevConnected] = useState<boolean | undefined>(undefined);
  const [forcedOpen, setForcedOpen] = useState<boolean | null>(null);
  if (connected !== prevConnected) {
    setPrevConnected(connected);
    const transition = sectionTransition(prevConnected, connected);
    if (transition) setForcedOpen(transition === 'open');
  }

  function handleOpenChange(open: boolean) {
    setForcedOpen(null);
    setSectionOpen('tracking', open);
  }

  async function changeVehicle(vehicle: Vehicle) {
    setSavingVehicle(true);
    try {
      await setVehicle(vehicle);
    } catch {
      toast.error('Voertuig opslaan is mislukt', { description: 'Probeer het opnieuw.' });
    } finally {
      setSavingVehicle(false);
    }
  }

  const summaryText = trackerSummary(status);
  const summary = connected ? <Badge variant="secondary">{summaryText}</Badge> : summaryText;

  return (
    <>
      <SidebarSection id="tracking" title="Mijn tracker" summary={summary} open={forcedOpen ?? storedOpen} onOpenChange={handleOpenChange}>
        <TrackerCard
          status={status}
          isError={isError}
          savingVehicle={savingVehicle}
          onVehicleChange={changeVehicle}
          onOpenGuide={() => setGuideOpen(true)}
        />
      </SidebarSection>
      {status?.configured && <TrackerGuideDialog open={guideOpen} onOpenChange={setGuideOpen} status={status} />}
    </>
  );
}
