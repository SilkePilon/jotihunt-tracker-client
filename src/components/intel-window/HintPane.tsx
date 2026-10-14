import { RefObject, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, MapIcon, PencilIcon } from 'lucide-react';
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
import { type AnswerPreview, DETAIL_PART, answerPreview, hasExistingMarker, initialOpenArea, nextOpenArea } from '@/lib/intel-window';
import { SWAP } from '@/lib/motion';
import { areaOptions, getColorFromArea } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem } from '@/types/Intel';
import ArticleHtml from './ArticleHtml';

/** The window's close animation: fly only once the map is in view again */
const DIALOG_CLOSE_MS = 260;

/** Save an answer; resolves true when it is stored (false: failed or waiting for the replace-marker confirm) */
type SaveAnswer = (cell: HintCell, label: string, answer: string) => Promise<boolean>;

/**
 * Hint (spec H2): one row per deelgebied, one open at a time (first the store's area, else the first open one) with the
 * area's full text and the answer field. Saving folds the row and unfolds the next open area. Two staggered detail parts.
 * Keyed by item (DetailSlide), so the open area never leaks into another hint.
 */
export default function HintPane({ item, area, mapRef }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null> }) {
  const { solve } = useHintBoard({ live: true });
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

  return (
    <>
      <motion.div variants={DETAIL_PART}>
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
                mapRef={mapRef}
                headerRef={(element) => {
                  if (element) headers.current.set(value, element);
                  else headers.current.delete(value);
                }}
              />
            ))}
          </BeheerRows>
        </BeheerCard>
      </motion.div>
      <motion.div variants={DETAIL_PART}>
        <BeheerCard title="Volledige hint">
          <ArticleHtml html={item.content} />
        </BeheerCard>
      </motion.div>
      <ConfirmDialog
        open={askReplace}
        onOpenChange={setAskReplace}
        title="Bestaande marker vervangen?"
        description={`Er staat al een hint-marker voor ${replace?.label ?? ''} op dit uur. Die wordt verplaatst naar dit antwoord.`}
        confirmLabel="Vervangen"
        onConfirm={confirmReplace}
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
  mapRef: RefObject<MapRef | null>;
  headerRef: (element: HTMLButtonElement | null) => void;
}

function AreaRow({ cell, area, label, open, onToggle, onSave, mapRef, headerRef }: AreaRowProps) {
  const solved = cell?.status === 'solved' && !!cell.answer;
  // Derived (as AreaChip): an area that is open on screen pops its cookie in once solved; one mounted solved just shows it
  const [poppable, setPoppable] = useState(!solved);
  if (!solved && !poppable) setPoppable(true);
  const dot = <span className="size-[9px] shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area) }} aria-hidden />;

  if (!cell || cell.status === 'none') {
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

  return (
    <RowFrame tone={open ? 'open' : 'default'}>
      <button
        ref={headerRef}
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        {dot}
        <span className="w-16 text-[13px] font-semibold">{label}</span>
        <span className="flex-1" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={solved ? `ok-${cell.answer}` : 'open'} {...SWAP} className="flex min-w-0 items-center gap-2">
            {solved ? (
              <>
                <span className="max-w-56 truncate font-mono text-[12.5px] font-bold text-green-600 dark:text-green-300">{cell.answer}</span>
                {poppable ? <SuccessBadge size={18} /> : <CookieBadge tone="ok" size={18} />}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">open</span>
            )}
          </motion.span>
        </AnimatePresence>
        <Chevron open={open} />
      </button>
      <Reveal>{open && <AreaBody cell={cell} label={label} onSave={onSave} mapRef={mapRef} />}</Reveal>
    </RowFrame>
  );
}

const previewKey = (preview: AnswerPreview) => (preview ? `${preview.kind}:${'rd' in preview ? `${preview.rd.x},${preview.rd.y}` : ''}` : '');

function AreaBody({ cell, label, onSave, mapRef }: { cell: HintCell; label: string; onSave: SaveAnswer; mapRef: RefObject<MapRef | null> }) {
  const close = useIntelStore((state) => state.close);
  const solved = cell.status === 'solved' && !!cell.answer;
  const [editing, setEditing] = useState(!solved);
  const [answer, setAnswer] = useState(cell.answer ?? '');
  const [saving, setSaving] = useState(false);
  // Escape-cancel: the pencil takes focus back when it mounts again
  const [refocus, setRefocus] = useState(false);

  // The line under the field. While the next parse is pending it keeps the last one, so typing doesn't make it flicker.
  const typed = editing ? answer : '';
  const { rd, pending } = useRdPreviewState(typed);
  const current = answerPreview(typed, rd);
  const [line, setLine] = useState<AnswerPreview>(null);
  const settled = !typed.trim() || !pending;
  if (settled && previewKey(current) !== previewKey(line)) setLine(current);
  const shown = settled ? current : line;

  async function save() {
    const value = answer.trim();
    if (!value || saving) return;
    setSaving(true);
    const ok = await onSave(cell, label, value);
    setSaving(false);
    if (ok) setEditing(false);
  }

  function cancelEdit() {
    setAnswer(cell.answer ?? '');
    setEditing(false);
    setRefocus(true);
  }

  function showOnMap() {
    const location = cell.answerLocation;
    if (!location) return;
    close();
    setTimeout(() => mapRef.current?.flyTo({ center: location, duration: 2000, zoom: 15 }), DIALOG_CLOSE_MS);
  }

  return (
    // pr/pb leave room for the pills' focus ring: Reveal and the row clip
    <div className="pt-0.5 pr-3.5 pb-3.5 pl-8">
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
            <Pill variant="primary" disabled={!answer.trim() || saving} onClick={() => void save()} morphKey={saving ? 'saving' : 'idle'} aria-label={saving ? 'Opslaan…' : undefined}>
              {saving ? <Loader2Icon className="animate-spin" /> : 'Opslaan'}
            </Pill>
          </motion.div>
        ) : (
          <motion.div key="done" {...SWAP} className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-mono text-[13px] font-bold text-green-600 dark:text-green-300">{cell.answer}</span>
            <CookieBadge tone="ok" size={18} />
            {cell.answerLocation && (
              <IconPill aria-label="Op kaart" title="Op kaart" onClick={showOnMap}>
                <MapIcon />
              </IconPill>
            )}
            <IconPill aria-label="Wijzigen" title="Wijzigen" autoFocus={refocus} onClick={() => setEditing(true)}>
              <PencilIcon />
            </IconPill>
          </motion.div>
        )}
      </AnimatePresence>
      <Reveal>
        {shown && (
          <div className="pt-2 text-xs">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={shown.kind} {...SWAP}>
                <PreviewLine preview={shown} />
              </motion.p>
            </AnimatePresence>
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
