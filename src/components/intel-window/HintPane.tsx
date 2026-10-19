import { RefObject, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, MapIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import SuccessBadge from '@/components/auth/SuccessBadge';
import { BeheerCard, BeheerRows, Chevron, RowFrame } from '@/components/beheer/BeheerLayout';
import { IconPill, Pill } from '@/components/beheer/controls/Pill';
import ConfirmDialog from '@/components/ConfirmDialog';
import { MapRef } from '@/components/Map';
import Reveal from '@/components/motion/Reveal';
import CookieBadge from '@/components/tracker/CookieBadge';
import { useHintBoard, useRdPreviewState } from '@/hooks/hints.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { type AnswerPreview, INTEL_CLOSE_MS, answerPreview, hasExistingMarker, initialOpenArea, nextOpenArea } from '@/lib/intel-window';
import { type GuessStatus, guessStatus, parseGuess, parseGuessAnswer } from '@/lib/hint-guess';
import { SWAP } from '@/lib/motion';
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
import useHintGuessStore from '@/stores/hint-guess.store';
import useIntelStore from '@/stores/intel.store';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem } from '@/types/Intel';
import ArticleHtml from './ArticleHtml';

/** Save an answer; resolves true when it is stored (false: failed or waiting for the replace-marker confirm) */
type SaveAnswer = (cell: HintCell, label: string, answer: string) => Promise<boolean>;
/** Ask to remove a stored answer (the confirm lives in the pane) */
type ClearAnswer = (cell: HintCell, label: string) => void;

/**
 * Hint (spec H2): one row per deelgebied, one open at a time (first the store's area, else the first open one) with the
 * area's full text and the answer field. Saving folds the row and unfolds the next open area. Arrives with the detail
 * view, which is keyed per item (IntelDialog's PushView), so the open area never leaks into another hint.
 */
export default function HintPane({ item, area, mapRef }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null> }) {
  const { solve, clear } = useHintBoard({ live: true });
  const cells = new Map(item.cells.map((cell) => [cell.area, cell]));
  const [openArea, setOpenArea] = useState<string | null>(() => initialOpenArea(item.cells, area));
  // The store's area changing while this hint stays on the right (openIntel on the same article) opens that area
  const [lastArea, setLastArea] = useState(area);
  if (area !== lastArea) {
    setLastArea(area);
    if (area && initialOpenArea(item.cells, area) === area) setOpenArea(area);
  }
  // For a save that settles later: the cells and open row by then (a poll or a click can come in between)
  const latest = useRef({ cells: item.cells, openArea });
  useEffect(() => {
    latest.current = { cells: item.cells, openArea };
  });
  const headers = useRef(new Map<string, HTMLButtonElement>());
  // The 409 confirm lives here, not in the row: the row folds away on success and would cut its close animation short
  const [replace, setReplace] = useState<{ cell: HintCell; label: string; answer: string } | null>(null);
  const [askReplace, setAskReplace] = useState(false);
  // Removing an answer: the row stays open and turns back into the empty field
  const [clearing, setClearing] = useState<{ cell: HintCell; label: string } | null>(null);
  const [askClear, setAskClear] = useState(false);

  /** Fold the saved row and unfold the next open area, unless another row was opened meanwhile */
  function saved(cell: HintCell, after: HintCell) {
    const next = nextOpenArea(latest.current.cells.map((existing) => (existing._id === after._id ? after : existing)), cell.area);
    const advance = latest.current.openArea === cell.area;
    setOpenArea((current) => (current === cell.area ? next : current));
    // No next area (its field would take focus): keep focus on the folded row instead of letting it fall to the body
    if (advance && !next) headers.current.get(cell.area)?.focus();
  }

  const save: SaveAnswer = async (cell, label, answer) => {
    try {
      saved(cell, await solve(item.id, cell.area, answer));
      return true;
    } catch (error) {
      if (hasExistingMarker(error)) {
        setReplace({ cell, label, answer });
        setAskReplace(true);
      } else toast.error(apiErrorMessage(error, 'Antwoord opslaan mislukt'));
      return false;
    }
  };

  async function confirmReplace() {
    if (!replace) return;
    try {
      const after = await solve(item.id, replace.cell.area, replace.answer, true);
      setAskReplace(false);
      saved(replace.cell, after);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Antwoord opslaan mislukt'));
    }
  }

  const askToClear: ClearAnswer = (cell, label) => {
    setClearing({ cell, label });
    setAskClear(true);
  };

  async function confirmClear() {
    if (!clearing) return;
    try {
      await clear(item.id, clearing.cell.area);
      setAskClear(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Antwoord wissen mislukt'));
    }
  }

  return (
    <>
      <div>
        <BeheerCard title="Deelgebieden">
          <BeheerRows>
            {areaOptions.map(({ value, label }) => (
              <AreaRow
                key={value}
                cell={cells.get(value)}
                area={value}
                label={label}
                open={openArea === value}
                onToggle={() => setOpenArea(openArea === value ? null : value)}
                onSave={save}
                onClear={askToClear}
                mapRef={mapRef}
                headerRef={(element) => {
                  if (element) headers.current.set(value, element);
                  else headers.current.delete(value);
                }}
              />
            ))}
          </BeheerRows>
        </BeheerCard>
      </div>
      <div>
        <BeheerCard title="Volledige hint">
          <ArticleHtml html={item.content} />
        </BeheerCard>
      </div>
      <ConfirmDialog
        open={askReplace}
        onOpenChange={setAskReplace}
        title="Bestaande marker vervangen?"
        description={`Er staat al een hint-marker voor ${replace?.label ?? ''} op dit uur. Die wordt verplaatst naar dit antwoord.`}
        confirmLabel="Vervangen"
        onConfirm={confirmReplace}
      />
      <ConfirmDialog
        open={askClear}
        onOpenChange={setAskClear}
        title="Antwoord wissen?"
        description={`${clearing?.label ?? ''}: ${clearing?.cell.answer ?? ''}. Het gebied staat daarna weer open${clearing?.cell.markerId ? ' en de hint-marker verdwijnt van de kaart' : ''}.`}
        confirmLabel="Wissen"
        destructive
        onConfirm={confirmClear}
      />
    </>
  );
}

interface AreaRowProps {
  cell: HintCell | undefined;
  area: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  onSave: SaveAnswer;
  onClear: ClearAnswer;
  mapRef: RefObject<MapRef | null>;
  headerRef: (element: HTMLButtonElement | null) => void;
}

function AreaRow({ cell, area, label, open, onToggle, onSave, onClear, mapRef, headerRef }: AreaRowProps) {
  const solved = cell?.status === 'solved' && !!cell.answer;
  // Derived (as AreaChip): an area that is open on screen pops its cookie in once solved; one mounted solved just shows it
  const [poppable, setPoppable] = useState(!solved);
  if (!solved && !poppable) setPoppable(true);
  const dot = <span className="size-[9px] shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area) }} aria-hidden />;

  // No cell at all: nothing to answer against
  if (!cell) {
    return (
      <RowFrame tone="muted">
        <div className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
          {dot}
          <span className="w-16 font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground">geen hint</span>
        </div>
      </RowFrame>
    );
  }

  // "Geen hint" by the split, which can be wrong: answerable like an open row, its header dimmed until it is solved
  const none = cell.status === 'none';

  return (
    <RowFrame tone={open ? 'open' : 'default'}>
      <button
        ref={headerRef}
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center px-3 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <motion.span initial={false} animate={{ opacity: none ? 0.6 : 1 }} transition={SWAP.transition} className="flex min-w-0 flex-1 items-center gap-3">
          {dot}
          <span className="w-16 text-[13px] font-semibold">{label}</span>
          <span className="flex-1" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={solved ? `ok-${cell.answer}` : none ? 'none' : 'open'} {...SWAP} className="flex min-w-0 items-center gap-2">
              {solved ? (
                <>
                  <span className="max-w-56 truncate font-mono text-[12.5px] font-bold text-green-600 dark:text-green-300">{cell.answer}</span>
                  {poppable ? <SuccessBadge size={18} /> : <CookieBadge tone="ok" size={18} />}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{none ? 'geen hint' : 'open'}</span>
              )}
            </motion.span>
          </AnimatePresence>
          <Chevron open={open} />
        </motion.span>
      </button>
      <Reveal>{open && <AreaBody cell={cell} label={label} onSave={onSave} onClear={onClear} mapRef={mapRef} />}</Reveal>
    </RowFrame>
  );
}

const previewKey = (preview: AnswerPreview) => (preview ? `${preview.kind}:${'rd' in preview ? `${preview.rd.x},${preview.rd.y}` : ''}` : '');

function AreaBody({ cell, label, onSave, onClear, mapRef }: { cell: HintCell; label: string; onSave: SaveAnswer; onClear: ClearAnswer; mapRef: RefObject<MapRef | null> }) {
  const close = useIntelStore((state) => state.close);
  const solved = cell.status === 'solved' && !!cell.answer;
  const [editing, setEditing] = useState(!solved);
  const [answer, setAnswer] = useState(cell.answer ?? '');
  const [saving, setSaving] = useState(false);
  // Escape-cancel: the pencil takes focus back when it mounts again
  const [refocus, setRefocus] = useState(false);
  // What the field started from (stored answer or empty): unchanged from it counts as untouched
  const [base, setBase] = useState(cell.answer ?? '');
  // A teammate's answer that came in while our field held something else of our own
  const [teammate, setTeammate] = useState<string | null>(null);
  // The done view after a teammate's answer took over an untouched field: its cookie pops in
  const [popIn, setPopIn] = useState(false);
  // A candidate picked on the map for this row (Toon op kaart): filled into the field, not saved yet
  const pendingAnswer = useHintGuessStore((state) => state.pendingAnswer);
  const [usedPending, setUsedPending] = useState<number | null>(null);
  if (pendingAnswer && pendingAnswer.id !== usedPending && pendingAnswer.articleId === cell.articleId && pendingAnswer.area === cell.area) {
    setUsedPending(pendingAnswer.id);
    setAnswer(pendingAnswer.text);
    setTeammate(null);
    setPopIn(false);
    setEditing(true);
  }
  useEffect(() => {
    if (usedPending !== null) useHintGuessStore.getState().clearPending(usedPending);
  }, [usedPending]);

  // Someone else's answer arriving (a poll) while this row is open. Our own save also changes it: ignored while saving.
  const incoming = solved ? (cell.answer ?? '') : '';
  const [seen, setSeen] = useState(incoming);
  if (incoming !== seen) {
    setSeen(incoming);
    if (!incoming) {
      setTeammate(null);
      // The answer was removed (here or by a teammate): back to the empty field
      if (!editing) {
        setAnswer('');
        setBase('');
        setPopIn(false);
        setEditing(true);
      }
    } else if (!editing) {
      setAnswer(incoming);
      setBase(incoming);
    } else if (!saving && incoming !== answer.trim()) {
      if (!answer.trim() || answer === base) {
        setEditing(false);
        setAnswer(incoming);
        setBase(incoming);
        setTeammate(null);
        setPopIn(true);
      } else setTeammate(incoming);
    } else setTeammate(null);
  }

  // The line under the field. While the next parse is pending it keeps the last one, so typing doesn't make it flicker.
  const typed = editing ? answer : '';
  const { rd, pending } = useRdPreviewState(typed);
  const current = answerPreview(typed, rd);
  const [line, setLine] = useState<AnswerPreview>(null);
  const settled = !typed.trim() || !pending;
  if (settled && previewKey(current) !== previewKey(line)) setLine(current);
  const shown = settled ? current : line;

  // '?' (or '*') for unknown digits in a coordinate: candidates instead of the RD preview, and no saving until it's filled in (word answers with '?' still save)
  const guessAnswer = editing ? parseGuessAnswer(answer) : null;
  const guess = guessAnswer ? parseGuess(guessAnswer.x, guessAnswer.y) : null;
  const canShowGuess = !!guess && (guess.kind === 'points' ? guess.points.length > 0 : !guess.wide);

  function showGuess() {
    if (!guessAnswer) return;
    useHintGuessStore.getState().show({
      source: 'intel',
      x: guessAnswer.x,
      y: guessAnswer.y,
      area: cell.area,
      at: Date.parse(cell.slotTime || cell.publishAt) || null,
      articleId: cell.articleId,
      format: guessAnswer.format,
    });
    close();
  }

  async function save() {
    const value = answer.trim();
    if (!value || saving || parseGuessAnswer(value)) return;
    setSaving(true);
    const ok = await onSave(cell, label, value);
    setSaving(false);
    if (ok) {
      setEditing(false);
      setTeammate(null);
      setPopIn(false);
    }
  }

  function startEdit() {
    setAnswer(cell.answer ?? '');
    setBase(cell.answer ?? '');
    setPopIn(false);
    setEditing(true);
  }

  function cancelEdit() {
    setAnswer(cell.answer ?? '');
    setTeammate(null);
    setEditing(false);
    setRefocus(true);
  }

  function showOnMap() {
    const location = cell.answerLocation;
    if (!location) return;
    close();
    setTimeout(() => mapRef.current?.flyTo({ center: location, duration: 2000, zoom: 15 }), INTEL_CLOSE_MS);
  }

  return (
    // pr/pb leave room for the pills' focus ring: Reveal and the row clip
    <div className="pt-0.5 pr-3.5 pb-3.5 pl-8">
      {/* Mounts with the body (unfolds with it); folds away once the area is solved */}
      <Reveal>{cell.status === 'none' && <p className="pb-3 text-xs text-muted-foreground">Volgens de hint geen opdracht voor {label} deze ronde.</p>}</Reveal>
      {/* The snippet is the raw HTML of this area's part of the article (text, <br>, images) */}
      {cell.snippet && <ArticleHtml html={cell.snippet} className="mb-3 px-0 font-mono text-[13.5px] leading-[1.7]" />}
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div key="edit" {...SWAP} className="flex items-center gap-2">
            <input
              autoFocus
              // Editing a stored answer: Escape cancels the edit and keeps the window open (keepOpenWhileEditing)
              data-inline-edit={solved ? '' : undefined}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void save();
                }
                if (event.key === 'Escape' && solved) {
                  event.stopPropagation();
                  cancelEdit();
                }
              }}
              readOnly={saving}
              placeholder="1234 5678"
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              aria-label={`Antwoord ${label}`}
              className="h-8 w-44 min-w-0 rounded-[10px] bg-beheer-window px-2.5 font-mono text-[13px] ring-1 ring-border outline-none placeholder:text-muted-foreground read-only:opacity-60 focus:ring-primary"
            />
            <Pill variant="primary" disabled={!answer.trim() || saving || !!guessAnswer} onClick={() => void save()} morphKey={saving ? 'saving' : 'idle'} aria-label={saving ? 'Opslaan…' : undefined}>
              {saving ? <Loader2Icon className="animate-spin" /> : 'Opslaan'}
            </Pill>
          </motion.div>
        ) : (
          <motion.div key="done" {...SWAP} className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-mono text-[13px] font-bold text-green-600 dark:text-green-300">{cell.answer}</span>
            {popIn ? <SuccessBadge size={18} /> : <CookieBadge tone="ok" size={18} />}
            {cell.answerLocation && (
              <IconPill aria-label="Op kaart" title="Op kaart" onClick={showOnMap}>
                <MapIcon />
              </IconPill>
            )}
            <IconPill aria-label="Wijzigen" title="Wijzigen" autoFocus={refocus} onClick={startEdit}>
              <PencilIcon />
            </IconPill>
            <IconPill aria-label="Wissen" title="Wissen" onClick={() => onClear(cell, label)}>
              <Trash2Icon />
            </IconPill>
          </motion.div>
        )}
      </AnimatePresence>
      <Reveal>
        {editing && teammate && (
          <p className="pt-2 text-xs text-muted-foreground">
            Intussen ingevuld door een teamgenoot: <span className="font-mono font-semibold text-foreground">{teammate}</span>
          </p>
        )}
      </Reveal>
      <Reveal>
        {shown && !guessAnswer && (
          <div className="pt-2 text-xs">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={shown.kind} {...SWAP}>
                <PreviewLine preview={shown} />
              </motion.p>
            </AnimatePresence>
          </div>
        )}
      </Reveal>
      <Reveal>
        {guessAnswer && (
          <div className="pt-2 text-xs">
            <GuessLine status={guessStatus(guess)} onShow={canShowGuess ? showGuess : undefined} />
          </div>
        )}
      </Reveal>
    </div>
  );
}

function PreviewLine({ preview }: { preview: NonNullable<AnswerPreview> }) {
  if (preview.kind === 'text') return <span className="text-muted-foreground">Tekst-antwoord, geen marker</span>;
  if (preview.kind === 'invalid') return <span className="text-amber-600 dark:text-amber-300">⚠ Geen geldige RD-coördinaat: cijfers omgedraaid?</span>;
  const { x, y, lat, lng } = preview.rd;
  if (preview.kind === 'outside') return <span className="text-amber-600 dark:text-amber-300">⚠ RD {x} {y} ligt buiten het speelgebied: cijfers omgedraaid?</span>;
  return (
    <span className="text-muted-foreground tabular-nums">
      <span className="text-green-600 dark:text-green-300">✓</span> RD {x} {y} · {lat.toFixed(4)} N, {lng.toFixed(4)} E
    </span>
  );
}

/** The preview line for an answer with unknown digits: how many candidates, and a button to see them on the map. */
function GuessLine({ status, onShow }: { status: GuessStatus; onShow?: () => void }) {
  return (
    <span className={cn('flex flex-wrap items-center gap-2', status.tone === 'warn' ? 'text-amber-600 dark:text-amber-300' : 'text-on-guess-container')}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={status.text} {...SWAP}>
          {status.tone === 'warn' ? '⚠ ' : ''}
          {status.text.replace(' · tik er een op de kaart', '').replace(' · tik de stip', '')}
        </motion.span>
      </AnimatePresence>
      {onShow && (
        <Pill onClick={onShow}>
          <MapIcon /> Toon op kaart
        </Pill>
      )}
    </span>
  );
}
