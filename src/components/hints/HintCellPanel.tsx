import { useState } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { MapPinIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { sanitizeHintHtml } from '@/lib/hints';
import { capitalizeFirstLetter } from '@/lib/utils';

interface HintCellPanelProps {
  article: HintArticle;
  cell: HintCell;
  currentUserId?: string;
  actions: ReturnType<typeof useHintBoard>;
  onClose: () => void;
  onShowOnMap: (lng: number, lat: number) => void;
}

function errorMessage(error: unknown) {
  if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
  return String(error);
}

/**
 * Open clicked images in a new tab so they can be zoomed.
 */
function openImage(event: React.MouseEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement;
  if (target instanceof HTMLImageElement) {
    event.preventDefault();
    window.open(target.src, '_blank', 'noopener');
  }
}

export default function HintCellPanel({ article, cell, currentUserId, actions, onClose, onShowOnMap }: HintCellPanelProps) {
  const [answer, setAnswer] = useState(cell.answer ?? '');
  const [note, setNote] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  const { articleId, area } = cell;
  const rd = useRdPreview(answer);
  const claimedByMe = cell.status === 'solving' && cell.claimedBy?._id === currentUserId;

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

  return (
    <aside className="flex h-full w-[440px] shrink-0 flex-col gap-4 overflow-y-auto border-l bg-background p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{capitalizeFirstLetter(area)}</h2>
          <p className="text-sm text-muted-foreground">
            {article.title} · {new Date(article.publishAt).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Sluiten">
          <XIcon />
        </Button>
      </div>

      {cell.articleChanged && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500 p-2 text-sm">
          <TriangleAlertIcon className="size-4 shrink-0 text-amber-600" />
          De hint is na publicatie aangepast. Controleer het antwoord.
        </div>
      )}

      <div
        className="rounded-md border p-3 text-sm [&_img]:max-w-full [&_img]:cursor-zoom-in"
        onClick={openImage}
        dangerouslySetInnerHTML={{ __html: sanitizeHintHtml(cell.snippet ?? article.content) }}
      />
      {cell.snippet && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Volledige hint</summary>
          <div
            className="mt-2 rounded-md border p-3 [&_img]:max-w-full [&_img]:cursor-zoom-in"
            onClick={openImage}
            dangerouslySetInnerHTML={{ __html: sanitizeHintHtml(article.content) }}
          />
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {cell.status === 'open' && (
          <Button disabled={busy} onClick={() => run(() => actions.claim(articleId, area))}>
            Claimen
          </Button>
        )}
        {cell.status === 'solving' && !claimedByMe && <span className="text-sm">Bezig: {cell.claimedBy?.name}</span>}
        {claimedByMe && (
          <Button variant="outline" disabled={busy} onClick={() => run(() => actions.release(articleId, area))}>
            Vrijgeven
          </Button>
        )}
        {cell.status === 'none' ? (
          <Button variant="outline" disabled={busy} onClick={() => run(() => actions.setStatus(articleId, area, 'open'))}>
            Toch een hint
          </Button>
        ) : (
          cell.status !== 'solved' && (
            <Button variant="ghost" disabled={busy} onClick={() => run(() => actions.setStatus(articleId, area, 'none'))}>
              Geen hint
            </Button>
          )
        )}
      </div>

      {cell.status !== 'none' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (answer.trim()) submitAnswer();
          }}
        >
          <label className="text-sm font-medium" htmlFor="hint-answer">
            Antwoord
          </label>
          <div className="flex gap-2">
            <Input id="hint-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="1234 5678 of woord" />
            <Button type="submit" disabled={busy || !answer.trim()}>
              Oplossen
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {rd
              ? `RD ${rd.x}, ${rd.y} → ${rd.lat.toFixed(5)}, ${rd.lng.toFixed(5)}`
              : answer.trim()
                ? 'Geen coördinaat: wordt als tekst-antwoord opgeslagen.'
                : ''}
          </p>
        </form>
      )}

      {cell.status === 'solved' && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={cell.check === 'verified' ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => run(() => actions.setCheck(articleId, area, cell.check === 'verified' ? 'unchecked' : 'verified'))}
          >
            Klopt
          </Button>
          <Button
            variant={cell.check === 'disputed' ? 'destructive' : 'outline'}
            disabled={busy}
            onClick={() => run(() => actions.setCheck(articleId, area, cell.check === 'disputed' ? 'unchecked' : 'disputed'))}
          >
            Twijfel
          </Button>
          {cell.checkedBy && <span className="text-xs text-muted-foreground">door {cell.checkedBy.name}</span>}
          {cell.answerLocation && (
            <Button variant="secondary" onClick={() => onShowOnMap(cell.answerLocation![0], cell.answerLocation![1])}>
              <MapPinIcon />
              Toon op kaart
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Notities</h3>
        {cell.notes.length === 0 && <p className="text-xs text-muted-foreground">Nog geen notities.</p>}
        <ul className="flex flex-col gap-2">
          {cell.notes.map((item) => (
            <li key={item._id} className="rounded-md bg-muted p-2 text-sm">
              <div className="text-xs text-muted-foreground">
                {item.user?.name ?? 'Onbekend'} · {new Date(item.createdAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="whitespace-pre-wrap">{item.text}</div>
            </li>
          ))}
        </ul>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bijv. lijkt Ogham, zie regel 2" />
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
      </div>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hint-marker vervangen?</AlertDialogTitle>
            <AlertDialogDescription>
              Er staat al een hint-marker voor {capitalizeFirstLetter(area)} op dit uur. Wil je die vervangen door dit antwoord?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => submitAnswer(true)}>Vervangen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
