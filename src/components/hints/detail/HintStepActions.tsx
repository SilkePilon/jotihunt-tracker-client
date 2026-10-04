import { ReactNode } from 'react';
import { CheckIcon, MapPinIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HintCell } from '@/types/HintCell';
import { useHintBoard } from '@/hooks/hints.hook';
import { HintStepNumber } from '@/lib/hints';

interface HintStepActionsProps {
  cell: HintCell;
  currentUserId?: string;
  isAdmin?: boolean;
  actions: ReturnType<typeof useHintBoard>;
  busy: boolean;
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
  /** Claims the cell; when someone else has it the caller asks before taking it over */
  onClaim: (overwrite?: boolean) => void;
  /** Whether the answer form of the current step was revealed */
  showForm: boolean;
  onRevealForm: (step: HintStepNumber) => void;
  answerForm: ReactNode;
  onShowOnMap: (lng: number, lat: number) => void;
}

type StepProps = Omit<HintStepActionsProps, 'currentUserId'> & { noHintButton: ReactNode; releaseButton: ReactNode };

function OpenStep({ busy, onClaim, showForm, onRevealForm, answerForm, noHintButton }: StepProps) {
  return (
    <>
      <p className="text-sm text-muted-foreground">Claim deze hint zodat anderen zien dat jij hem oplost.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy} onClick={() => onClaim()}>
          Claimen
        </Button>
        {!showForm && (
          <Button variant="ghost" disabled={busy} onClick={() => onRevealForm(1)}>
            Direct oplossen
          </Button>
        )}
        {noHintButton}
      </div>
      {showForm && answerForm}
    </>
  );
}

function SolvingStep({ cell, isAdmin, busy, onClaim, showForm, onRevealForm, answerForm, noHintButton, releaseButton, claimedByMe, claimedByOther }: StepProps & { claimedByMe: boolean; claimedByOther: boolean }) {
  if (claimedByOther && !showForm) {
    return (
      <>
        <p className="text-sm">
          <span className="font-semibold">{cell.claimedBy?.name}</span> is hiermee bezig
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onClaim()}>
            Overnemen
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRevealForm(2)}>
            Toch een antwoord invullen
          </Button>
          {isAdmin && releaseButton}
        </div>
      </>
    );
  }
  return (
    <>
      {claimedByOther && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{cell.claimedBy?.name}</span> is hiermee bezig
        </p>
      )}
      {answerForm}
      <div className="-mb-1 flex flex-wrap items-center gap-1 border-t pt-2">
        {(claimedByMe || isAdmin) && releaseButton}
        {noHintButton}
      </div>
    </>
  );
}

function SolvedStep({ cell, actions, busy, run, showForm, onRevealForm, answerForm, onShowOnMap }: StepProps) {
  const { articleId, area } = cell;
  return (
    <>
      <div>
        <div className="break-all font-mono text-2xl font-semibold">{cell.answer}</div>
        {cell.claimedBy && <div className="text-xs text-muted-foreground">door {cell.claimedBy.name}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={cell.check === 'verified' ? 'default' : 'outline'}
          disabled={busy}
          onClick={() => run(() => actions.setCheck(articleId, area, cell.check === 'verified' ? 'unchecked' : 'verified'))}
        >
          <CheckIcon />
          Klopt
        </Button>
        <Button
          variant={cell.check === 'disputed' ? 'destructive' : 'outline'}
          disabled={busy}
          onClick={() => run(() => actions.setCheck(articleId, area, cell.check === 'disputed' ? 'unchecked' : 'disputed'))}
        >
          <TriangleAlertIcon />
          Twijfel
        </Button>
        {cell.answerLocation && (
          <Button variant="secondary" onClick={() => onShowOnMap(cell.answerLocation![0], cell.answerLocation![1])}>
            <MapPinIcon />
            Op kaart
          </Button>
        )}
      </div>
      {cell.check !== 'unchecked' && cell.checkedBy && <p className="text-xs text-muted-foreground">gecontroleerd door {cell.checkedBy.name}</p>}
      {showForm ? (
        answerForm
      ) : (
        <div>
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => onRevealForm(3)}>
            Antwoord aanpassen
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * The actions of the current step of a hint cell: claim (open), solve (solving) or check (solved).
 */
export default function HintStepActions({ currentUserId, ...props }: HintStepActionsProps) {
  const { cell, actions, busy, run } = props;
  const { articleId, area } = cell;

  const noHintButton = (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => actions.setStatus(articleId, area, 'none'))}>
      Geen hint
    </Button>
  );

  const releaseButton = (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => actions.release(articleId, area))}>
      Vrijgeven
    </Button>
  );

  const stepProps = { ...props, noHintButton, releaseButton };

  if (cell.status === 'open') return <OpenStep {...stepProps} />;
  if (cell.status === 'solving') {
    const claimedByMe = !!cell.claimedBy && cell.claimedBy._id === currentUserId;
    const claimedByOther = !!cell.claimedBy && cell.claimedBy._id !== currentUserId;
    return <SolvingStep {...stepProps} claimedByMe={claimedByMe} claimedByOther={claimedByOther} />;
  }
  return <SolvedStep {...stepProps} />;
}
