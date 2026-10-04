import { useRef, useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import AnswerForm from '@/components/hints/detail/AnswerForm';
import { STEP_LABELS } from '@/components/hints/detail/hint-detail.utils';
import HintNotes from '@/components/hints/detail/HintNotes';
import HintStepActions from '@/components/hints/detail/HintStepActions';
import HintStepper from '@/components/hints/detail/HintStepper';
import { Button } from '@/components/ui/button';
import { useGuardedWrite } from '@/hooks/guarded-write.hook';
import useHintActions from '@/hooks/hint-actions.hook';
import { useRdPreview, type HintBoardActions } from '@/hooks/hints.hook';
import { useOutlet } from '@/hooks/outlet.hook';
import { hintStep, type HintStepNumber } from '@/lib/hints';
import { capitalizeFirstLetter, cn } from '@/lib/utils';
import type { HintCell } from '@/types/HintCell';
import OverwriteDialog from './OverwriteDialog';

interface HintWorkflowProps {
  cell: HintCell;
  actions: HintBoardActions;
  selfId?: string;
  isAdmin?: boolean;
}

/**
 * The work on one hint cell: where it is in the claim → solve → check flow with the actions of the current step, and
 * the notes. Claiming and answering ask before overwriting someone else's claim or answer.
 */
export default function HintWorkflow({ cell, actions, selfId, isAdmin }: HintWorkflowProps) {
  const [answer, setAnswer] = useState(cell.answer ?? '');
  /** The step whose answer form was revealed ("Direct oplossen", "Toch een antwoord invullen", "Antwoord aanpassen") */
  const [formForStep, setFormForStep] = useState<HintStepNumber | null>(null);
  /** What the last solve returned, to pick the success text */
  const solvedKind = useRef<HintCell['answerKind']>(undefined);

  const { articleId, area } = cell;
  const hintActions = useHintActions();
  const guard = useGuardedWrite();
  const rd = useRdPreview(answer);
  const navigate = useNavigate();
  const { mapRef } = useOutlet();

  const busy = hintActions.busy || guard.busy;
  const { run } = hintActions;
  const areaName = capitalizeFirstLetter(area);
  const step = hintStep(cell);
  const showForm = formForStep === step.current;

  /** Someone else was first: fetch the board, so the pane shows their claim or answer behind the dialog */
  function refreshBoard() {
    void actions.refresh();
  }

  /** Reveals the answer form, seeded with the current answer (someone else may have solved it since opening) */
  function revealForm(formStep: HintStepNumber) {
    setAnswer(cell.answer ?? '');
    setFormForStep(formStep);
  }

  function submit() {
    void guard.run(
      async (flags) => {
        solvedKind.current = (await actions.solve(articleId, area, answer, flags)).answerKind;
      },
      answer.trim(),
      () => {
        setFormForStep(null);
        toast.success(solvedKind.current === 'rd' ? 'Opgelost, hint-marker geplaatst!' : 'Antwoord opgeslagen');
      },
      refreshBoard,
    );
  }

  function claim() {
    void guard.run((flags) => actions.claim(articleId, area, flags.overwrite), 'bezig', undefined, refreshBoard);
  }

  function showOnMap(lng: number, lat: number) {
    navigate('/');
    mapRef.current?.flyTo({ center: [lng, lat], duration: 2000, zoom: 15 });
  }

  return (
    <>
      {cell.articleChanged && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500 p-2 text-sm">
          <TriangleAlertIcon className="size-4 shrink-0 text-amber-600" aria-hidden />
          De hint is na publicatie aangepast. Controleer het antwoord.
        </div>
      )}

      {cell.status === 'none' ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/40 p-4">
          <span className="text-sm text-muted-foreground">Geen hint voor {areaName}</span>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run(() => actions.setStatus(articleId, area, 'open'))}>
            Toch een hint
          </Button>
        </div>
      ) : (
        <>
          <HintStepper cell={cell} />
          <section className={cn('flex flex-col gap-3 rounded-lg border p-4', step.checkState === 'disputed' ? 'border-red-300 dark:border-red-900' : 'border-primary/40')}>
            <h3 className="text-sm font-semibold">
              Stap {step.current} · {STEP_LABELS[step.current]}
            </h3>
            <HintStepActions
              cell={cell}
              currentUserId={selfId}
              isAdmin={isAdmin}
              actions={actions}
              busy={busy}
              run={run}
              onClaim={claim}
              showForm={showForm}
              onRevealForm={revealForm}
              answerForm={<AnswerForm answer={answer} onAnswerChange={setAnswer} busy={busy} onSubmit={submit} />}
              onShowOnMap={showOnMap}
            />
          </section>
        </>
      )}

      <HintNotes
        notes={cell.notes}
        busy={busy}
        onAdd={(text, clear) =>
          run(async () => {
            await actions.addNote(articleId, area, text);
            clear();
          })
        }
      />

      <OverwriteDialog guard={guard} currentLocation={cell.answerLocation} newLocation={rd ? [rd.lng, rd.lat] : undefined} />
    </>
  );
}
