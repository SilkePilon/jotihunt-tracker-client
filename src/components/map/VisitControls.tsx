import { useState } from 'react';
import { CheckIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useVisits } from '@/hooks/predictions.hook';
import { nextVisitChoice, visitSelection, visitStatusText } from '@/lib/prediction';
import MarkerGlyph from './popup/MarkerGlyph';
import { ICON_ACTION, popupActionClass } from './popup/PopupActions';
import { PopupRow } from './popup/PopupRows';

/** The group's visit status as a row: green with a check when manually visited, sparkles for the AI's view. */
export function VisitStatusRow({ teamApiId }: { teamApiId: number }) {
  const { visits } = useVisits();
  const visit = visits?.find((candidate) => candidate.teamApiId === teamApiId);
  const manualVisited = visitSelection(visit) === 'visited';
  return <PopupRow icon={manualVisited ? <CheckIcon /> : <SparklesIcon />} title={visitStatusText(visit)} tone={manualVisited ? 'success' : 'default'} />;
}

/** House button next to Route: marks the group visited (green), tapping again hands it back to the AI. */
export function VisitToggleButton({ teamApiId }: { teamApiId: number }) {
  const { visits, setVisit } = useVisits();
  const [busy, setBusy] = useState(false);
  const visit = visits?.find((candidate) => candidate.teamApiId === teamApiId);
  const selection = visitSelection(visit);
  const visited = selection === 'visited';
  const title = visited ? 'Bezocht — terug naar AI' : 'Markeer als bezocht';

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
      aria-label="Bezocht"
      title={title}
      disabled={busy}
      onClick={toggle}
      className={popupActionClass(visited ? 'success' : 'neutral', ICON_ACTION)}
    >
      <MarkerGlyph name="home" />
    </button>
  );
}
