import { useState } from 'react';
import { CheckIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useVisits } from '@/hooks/predictions.hook';
import { nextVisitChoice, visitSelection, visitStatusText } from '@/lib/prediction';
import { cn } from '@/lib/utils';
import MarkerGlyph from './popup/MarkerGlyph';
import { popupActionClass } from './popup/PopupActions';
import { PopupFact } from './popup/PopupFacts';

/** The group's visit status as a fact line: green check when manually visited, sparkles for the AI's view. */
export function VisitStatusFact({ teamApiId }: { teamApiId: number }) {
  const { visits } = useVisits();
  const visit = visits?.find((candidate) => candidate.teamApiId === teamApiId);
  const manualVisited = visitSelection(visit) === 'visited';
  return (
    <PopupFact>
      {manualVisited ? <CheckIcon className="text-green-500!" /> : <SparklesIcon />}
      <span className={cn('truncate', manualVisited ? 'text-green-500' : 'text-(--map-muted)')}>{visitStatusText(visit)}</span>
    </PopupFact>
  );
}

/** House button next to Google Maps: marks the group visited (green), tapping again hands it back to the AI. */
export function VisitToggleButton({ teamApiId }: { teamApiId: number }) {
  const { visits, setVisit } = useVisits();
  const [busy, setBusy] = useState(false);
  const visit = visits?.find((candidate) => candidate.teamApiId === teamApiId);
  const selection = visitSelection(visit);
  const visited = selection === 'visited';
  const label = visited ? 'Bezocht — terug naar AI' : 'Markeer als bezocht';

  async function toggle() {
    setBusy(true);
    try {
      await setVisit(teamApiId, nextVisitChoice(selection));
    } catch {
      toast.error('Bezoekstatus opslaan is mislukt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={visited}
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={toggle}
      className={popupActionClass('neutral', cn('w-[30px] px-0', visited && 'bg-green-600/20 text-green-500'))}
    >
      <MarkerGlyph name="home" />
    </button>
  );
}
