import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useVisits } from '@/hooks/predictions.hook';
import { visitSelection, visitStatusText } from '@/lib/prediction';
import type { VisitChoice } from '@/types/Prediction';

const OPTIONS: { value: VisitChoice; label: string }[] = [
  { value: 'visited', label: 'Bezocht' },
  { value: 'not_visited', label: 'Niet bezocht' },
  { value: 'auto', label: 'Automatisch' },
];

/** Visited / not visited / automatic buttons for a group (used in the group popup). */
export default function VisitControls({ teamApiId }: { teamApiId: number }) {
  const { visits, setVisit } = useVisits();
  const [busy, setBusy] = useState(false);
  const visit = visits?.find((candidate) => candidate.teamApiId === teamApiId);
  const selected = visitSelection(visit);

  async function choose(state: VisitChoice) {
    setBusy(true);
    try {
      await setVisit(teamApiId, state);
    } catch {
      toast.error('Bezoekstatus opslaan is mislukt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{visitStatusText(visit)}</p>
      <div className="grid grid-cols-3 gap-1">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            size="xs"
            variant={selected === option.value ? 'default' : 'outline'}
            aria-pressed={selected === option.value}
            disabled={busy}
            onClick={() => choose(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
