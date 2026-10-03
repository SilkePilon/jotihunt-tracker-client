import { useState } from 'react';
import { ArrowLeftIcon, ChevronDownIcon, TriangleAlertIcon } from 'lucide-react';
import ImageLightbox from '@/components/ImageLightbox';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HintArticle, HintCell } from '@/types/HintCell';
import { useHintBoard } from '@/hooks/hints.hook';
import useHintActions from '@/hooks/hint-actions.hook';
import { hintStep, HintStepNumber } from '@/lib/hints';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import AnswerForm from './detail/AnswerForm';
import Countdown from './detail/Countdown';
import HintContent from './detail/HintContent';
import HintNotes from './detail/HintNotes';
import HintStepActions from './detail/HintStepActions';
import HintStepper from './detail/HintStepper';
import ReplaceMarkerDialog from './detail/ReplaceMarkerDialog';
import { formatClock } from '@/lib/format';
import { STEP_LABELS } from './detail/hint-detail.utils';

interface HintDetailProps {
  article: HintArticle;
  cell: HintCell;
  currentUserId?: string;
  isAdmin?: boolean;
  actions: ReturnType<typeof useHintBoard>;
  onBack: () => void;
  onShowOnMap: (lng: number, lat: number) => void;
}

/**
 * Detail of one hint cell: the hint itself, where it is in the claim → solve → check flow with the actions of the
 * current step, and the notes.
 */
export default function HintDetail({ article, cell, currentUserId, isAdmin, actions, onBack, onShowOnMap }: HintDetailProps) {
  const [answer, setAnswer] = useState(cell.answer ?? '');
  const [confirmReplace, setConfirmReplace] = useState(false);
  /** The step whose answer form was revealed ("Direct oplossen", "Toch een antwoord invullen", "Antwoord aanpassen") */
  const [formForStep, setFormForStep] = useState<HintStepNumber | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const { articleId, area } = cell;
  const { busy, run, submitAnswer } = useHintActions(actions, articleId, area);
  const areaName = capitalizeFirstLetter(area);
  const step = hintStep(cell);
  const showForm = formForStep === step.current;

  /** Reveals the answer form, seeded with the current answer (someone else may have solved it since opening) */
  function revealForm(formStep: HintStepNumber) {
    setAnswer(cell.answer ?? '');
    setFormForStep(formStep);
  }

  function submit(replaceMarker = false) {
    return submitAnswer(answer, replaceMarker, { onSolved: () => setFormForStep(null), onExistingMarker: () => setConfirmReplace(true) });
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="-ml-2 flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Overzicht
        </Button>
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area) }} aria-hidden />
        <h2 className="text-lg font-bold">{areaName}</h2>
        <span className="text-sm text-muted-foreground">Hint {formatClock(article.publishAt)}</span>
        {(cell.status === 'open' || cell.status === 'solving') && <Countdown publishAt={cell.publishAt} />}
      </div>

      {cell.articleChanged && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500 p-2 text-sm">
          <TriangleAlertIcon className="size-4 shrink-0 text-amber-600" />
          De hint is na publicatie aangepast. Controleer het antwoord.
        </div>
      )}

      {cell.status === 'none' ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/40 p-4">
          <span className="text-sm text-muted-foreground">Geen hint voor {areaName}</span>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => actions.setStatus(articleId, area, 'open'))}>
            Toch een hint
          </Button>
        </div>
      ) : (
        <HintStepper cell={cell} />
      )}

      <HintContent html={cell.snippet ?? article.content} onZoom={setZoomSrc} />
      {cell.snippet && (
        <Collapsible>
          <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            Volledige hint
          </CollapsibleTrigger>
          <CollapsibleContent>
            <HintContent html={article.content} onZoom={setZoomSrc} className="mt-2" />
          </CollapsibleContent>
        </Collapsible>
      )}

      {cell.status !== 'none' && (
        <section className={cn('flex flex-col gap-3 rounded-lg border p-4', step.checkState === 'disputed' ? 'border-red-300 dark:border-red-900' : 'border-primary/40')}>
          <h3 className="text-sm font-semibold">
            Stap {step.current} · {STEP_LABELS[step.current]}
          </h3>
          <HintStepActions
            cell={cell}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            actions={actions}
            busy={busy}
            run={run}
            showForm={showForm}
            onRevealForm={revealForm}
            answerForm={<AnswerForm answer={answer} onAnswerChange={setAnswer} busy={busy} onSubmit={() => submit()} />}
            onShowOnMap={onShowOnMap}
          />
        </section>
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

      {zoomSrc && <ImageLightbox src={zoomSrc} alt={`Hint ${areaName}`} open onOpenChange={(open) => !open && setZoomSrc(null)} />}

      <ReplaceMarkerDialog open={confirmReplace} onOpenChange={setConfirmReplace} areaName={areaName} onConfirm={() => submit(true)} />
    </div>
  );
}
