import { Fragment, useState } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, MapPinIcon, TriangleAlertIcon } from 'lucide-react';
import ImageLightbox from '@/components/ImageLightbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HintArticle, HintCell } from '@/types/HintCell';
import { useHintBoard, useRdPreview } from '@/hooks/hints.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { formatCountdown, hintStep, HintStepNumber, remainingMs, sanitizeHintHtml } from '@/lib/hints';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';

interface HintDetailProps {
  article: HintArticle;
  cell: HintCell;
  currentUserId?: string;
  isAdmin?: boolean;
  actions: ReturnType<typeof useHintBoard>;
  onBack: () => void;
  onShowOnMap: (lng: number, lat: number) => void;
}

const STEP_LABELS: Record<HintStepNumber, string> = { 1: 'Claimen', 2: 'Oplossen', 3: 'Controleren' };
const STEPS: HintStepNumber[] = [1, 2, 3];

function errorMessage(error: unknown) {
  if (isAxiosError(error)) {
    return error.response?.data?.message ?? error.response?.data?.errors?.[0]?.msg ?? error.message;
  }
  return String(error);
}

const formatTime = (date: string) => new Date(date).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

/**
 * Claim → solve → check progress as three badges joined by lines.
 */
function HintStepper({ cell }: { cell: HintCell }) {
  const step = hintStep(cell);
  return (
    <ol className="flex items-center gap-2" aria-label="Voortgang">
      {STEPS.map((number) => {
        const done = step.done.includes(number);
        const current = !done && step.current === number;
        const disputed = number === 3 && step.checkState === 'disputed';
        return (
          <Fragment key={number}>
            {number > 1 && <li aria-hidden className={cn('h-px min-w-3 flex-1', step.done.includes((number - 1) as HintStepNumber) ? 'bg-green-500' : 'bg-border')} />}
            <li
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-badge border px-2.5 py-1 text-xs font-medium',
                done && 'border-green-600 bg-green-600 text-white dark:border-green-700 dark:bg-green-700',
                current && !disputed && 'border-primary bg-primary/10 text-primary',
                current && disputed && 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                !done && !current && 'border-border text-muted-foreground',
              )}
            >
              {done ? (
                <CheckIcon className="size-3.5" />
              ) : disputed ? (
                <TriangleAlertIcon className="size-3.5" />
              ) : (
                <span className="font-mono">{number}</span>
              )}
              {disputed ? 'Twijfel' : STEP_LABELS[number]}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/**
 * Sanitised hint HTML; clicking an image opens it in the zoomable lightbox.
 */
function HintContent({ html, onZoom, className }: { html: string; onZoom: (src: string) => void; className?: string }) {
  return (
    <div
      className={cn('rounded-lg border p-3 text-sm [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded', className)}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLImageElement) {
          event.preventDefault();
          onZoom(target.src);
        }
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeHintHtml(html) }}
    />
  );
}

interface AnswerFormProps {
  answer: string;
  onAnswerChange: (answer: string) => void;
  busy: boolean;
  onSubmit: () => void;
}

function AnswerForm({ answer, onAnswerChange, busy, onSubmit }: AnswerFormProps) {
  const rd = useRdPreview(answer);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (answer.trim()) onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="hint-answer">
        Antwoord
      </label>
      <div className="flex gap-2">
        <Input
          id="hint-answer"
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="1234 5678 of woord"
          maxLength={200}
          autoComplete="off"
          className="font-mono"
        />
        <Button type="submit" disabled={busy || !answer.trim()}>
          Oplossen
        </Button>
      </div>
      <p className="min-h-4 text-xs text-muted-foreground">
        {rd ? (
          <>
            RD {rd.x}, {rd.y} → {rd.lat.toFixed(5)}, {rd.lng.toFixed(5)} · <span className="font-medium text-foreground">wordt hint-marker</span>
          </>
        ) : answer.trim() ? (
          'Geen coördinaat: wordt als tekst-antwoord opgeslagen.'
        ) : (
          ''
        )}
      </p>
    </form>
  );
}

/**
 * Detail of one hint cell: the hint itself, where it is in the claim → solve → check flow with the actions of the
 * current step, and the notes.
 */
export default function HintDetail({ article, cell, currentUserId, isAdmin, actions, onBack, onShowOnMap }: HintDetailProps) {
  const [answer, setAnswer] = useState(cell.answer ?? '');
  const [note, setNote] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  /** The step whose answer form was revealed ("Direct oplossen", "Toch een antwoord invullen", "Antwoord aanpassen") */
  const [formForStep, setFormForStep] = useState<HintStepNumber | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useInterval(() => setNow(Date.now()), 1000);

  const { articleId, area } = cell;
  const areaName = capitalizeFirstLetter(area);
  const step = hintStep(cell);
  const showForm = formForStep === step.current;
  const claimedByMe = cell.status === 'solving' && !!cell.claimedBy && cell.claimedBy._id === currentUserId;
  const claimedByOther = cell.status === 'solving' && !!cell.claimedBy && cell.claimedBy._id !== currentUserId;
  const left = remainingMs(cell.publishAt, now);
  const showTimer = (cell.status === 'open' || cell.status === 'solving') && left > 0;

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409 && error.response.data?.claimedBy) {
        toast.error(`Al geclaimd door ${error.response.data.claimedBy.name}`);
      } else {
        toast.error('Actie mislukt', { description: errorMessage(error) });
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(replaceMarker = false) {
    setBusy(true);
    try {
      const solved = await actions.solve(articleId, area, answer, replaceMarker);
      setFormForStep(null);
      toast.success(solved.answerKind === 'rd' ? 'Opgelost, hint-marker geplaatst!' : 'Antwoord opgeslagen');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409 && error.response.data?.existingMarkerId) {
        setConfirmReplace(true);
      } else {
        toast.error('Opslaan mislukt', { description: errorMessage(error) });
      }
    } finally {
      setBusy(false);
    }
  }

  const answerForm = <AnswerForm answer={answer} onAnswerChange={setAnswer} busy={busy} onSubmit={() => submitAnswer()} />;

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

  function stepBody() {
    if (cell.status === 'open') {
      return (
        <>
          <p className="text-sm text-muted-foreground">Claim deze hint zodat anderen zien dat jij hem oplost.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy} onClick={() => run(() => actions.claim(articleId, area))}>
              Claimen
            </Button>
            {!showForm && (
              <Button variant="ghost" disabled={busy} onClick={() => setFormForStep(1)}>
                Direct oplossen
              </Button>
            )}
            {noHintButton}
          </div>
          {showForm && answerForm}
        </>
      );
    }

    if (cell.status === 'solving') {
      if (claimedByOther && !showForm) {
        return (
          <>
            <p className="text-sm">
              <span className="font-semibold">{cell.claimedBy?.name}</span> is hiermee bezig
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFormForStep(2)}>
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

    // Solved
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
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setFormForStep(3)}>
              Antwoord aanpassen
            </Button>
          </div>
        )}
      </>
    );
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
        <span className="text-sm text-muted-foreground">Hint {formatTime(article.publishAt)}</span>
        {showTimer && (
          <span className={cn('ml-auto font-mono text-sm tabular-nums', left < 5 * 60 * 1000 && 'font-bold text-red-600')} title="Tijd om te scoren">
            {formatCountdown(left)}
          </span>
        )}
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
          {stepBody()}
        </section>
      )}

      <Collapsible>
        <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          {cell.notes.length === 0 ? 'Notitie toevoegen' : `💬 ${cell.notes.length} ${cell.notes.length === 1 ? 'notitie' : 'notities'}`}
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-2 pt-2">
          {cell.notes.length > 0 && (
            <ul className="flex flex-col gap-2">
              {cell.notes.map((item) => (
                <li key={item._id} className="rounded-md bg-muted p-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {item.user?.name ?? 'Onbekend'} · {formatTime(item.createdAt)}
                  </div>
                  <div className="whitespace-pre-wrap">{item.text}</div>
                </li>
              ))}
            </ul>
          )}
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bijv. lijkt Ogham, zie regel 2" maxLength={1000} />
          <Button
            variant="outline"
            disabled={busy || !note.trim()}
            onClick={() =>
              run(async () => {
                await actions.addNote(articleId, area, note.trim());
                setNote('');
              })
            }
          >
            Notitie toevoegen
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {zoomSrc && <ImageLightbox src={zoomSrc} alt={`Hint ${areaName}`} open onOpenChange={(open) => !open && setZoomSrc(null)} />}

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hint-marker vervangen?</AlertDialogTitle>
            <AlertDialogDescription>Er staat al een hint-marker voor {areaName} op dit uur. Wil je die vervangen door dit antwoord?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => submitAnswer(true)}>Vervangen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
