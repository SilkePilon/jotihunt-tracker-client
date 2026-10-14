import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DownloadIcon, Loader2Icon, PencilIcon, SendIcon, Trash2Icon, TriangleAlertIcon, Undo2Icon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { toast } from 'sonner';
import { IconPill, Pill } from '@/components/beheer/controls/Pill';
import ImageLightbox from '@/components/ImageLightbox';
import Reveal from '@/components/motion/Reveal';
import { useAuthImage } from '@/hooks/auth-image.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { formatClock } from '@/lib/format';
import { huntSourceLabel, isReading, readFailed } from '@/lib/hunt-reports';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import type { User } from '@/types/User';
import HuntCodeText, { HuntTimeText } from './HuntCodeText';
import { EditCode, EditTime, RereadButton } from './HuntInlineEdit';
import StickerHero from './StickerHero';

/** The parent column's gap (gap-2.5), so the edit box folding away leaves no gap behind */
const GAP = 10;

/** One fact tile: small uppercase label, one truncated line. */
function Fact({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-black/5 px-3 py-2 dark:bg-black/15">
      <div className="text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className={cn('truncate text-[13px] font-semibold', className)}>{children}</div>
    </div>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-amber-500/12 px-3 py-2 text-[12.5px] font-medium text-amber-700 dark:text-amber-300">
      <TriangleAlertIcon className="size-4 shrink-0" />
      {children}
    </p>
  );
}

/** A hunt row's unfolded part: the photo zoomed on the sticker, facts, warnings and the actions (admins: edit, re-read, delete, submit). */
export default function HuntRowDetails({ report, onDelete }: { report: HuntReport; onDelete: () => void }) {
  const user = useAuthUser<User>();
  const { setSubmitted } = useHuntReports();
  const photo = useAuthImage(report.photoUrl);
  const ref = useRef<HTMLDivElement>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  /** Which field is being edited inline */
  const [editing, setEditing] = useState<'code' | 'time' | null>(null);
  const [busy, setBusy] = useState(false);
  // Status changes, edits and deleting are HQ work: admins only (the server enforces this too)
  const isAdmin = !!user?.admin;
  const canDelete = isAdmin && !report.submittedAt && !report.site;
  const codeLabel = report.huntCode ?? 'zonder code';
  // Once submitted, who sent it in matters more than where the code came from
  const showSubmitter = report.status === 'submitted' || report.status === 'judged';
  const sourceLabel = huntSourceLabel(report, isAdmin);

  // Bring the row into view once it has unfolded (also when the window opens on this hunt)
  useEffect(() => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' }), 250);
    return () => clearTimeout(timer);
  }, []);

  async function changeSubmitted(submitted: boolean) {
    setBusy(true);
    try {
      await setSubmitted(report._id, submitted);
      toast.success(submitted ? 'Gemarkeerd als ingestuurd' : 'Teruggezet naar te versturen');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opslaan is mislukt'));
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!photo) return;
    const link = document.createElement('a');
    link.href = photo;
    link.download = `hunt-${report.huntCode ?? report._id}.jpg`;
    link.click();
  }

  const submitAction = !report.submittedAt ? 'submit' : report.status !== 'judged' ? 'undo' : null;

  return (
    <div ref={ref} className="flex flex-col gap-2.5">
      {photo ? (
        <button
          type="button"
          className="block w-full cursor-zoom-in overflow-hidden rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => setZoomOpen(true)}
          aria-label="Foto vergroten"
        >
          <StickerHero src={photo} box={report.stickerBox} alt={`Foto van hunt ${codeLabel}`} className="h-[190px] max-md:h-[170px]" />
        </button>
      ) : (
        <div className="flex h-[190px] items-center justify-center rounded-2xl bg-black/5 text-sm text-muted-foreground max-md:h-[170px] dark:bg-black/15">Foto laden…</div>
      )}

      {isAdmin && (
        <Reveal gap={GAP}>
          {editOpen && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-primary/8 px-3 py-2 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Code</span>
                {editing !== 'code' && <HuntCodeText report={report} />}
                <EditCode report={report} editing={editing === 'code'} onEditingChange={(on) => setEditing(on ? 'code' : null)} />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Tijd</span>
                {editing !== 'time' && <HuntTimeText report={report} className="font-mono" />}
                <EditTime report={report} editing={editing === 'time'} onEditingChange={(on) => setEditing(on ? 'time' : null)} />
              </span>
            </div>
          )}
        </Reveal>
      )}

      <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-[14px] max-md:grid-cols-1">
        <Fact label="Gemeld door">
          {report.reportedByName} · {formatClock(report.createdAt)}
        </Fact>
        {showSubmitter ? (
          <Fact label="Ingestuurd door">{report.submittedAt ? `${report.submittedByName ?? 'Onbekend'} · ${formatClock(report.submittedAt)}` : '–'}</Fact>
        ) : (
          <Fact label="Bron" className={readFailed(report) ? 'text-destructive dark:text-red-300' : 'font-medium text-muted-foreground'}>
            <span title={sourceLabel}>{sourceLabel}</span>
          </Fact>
        )}
        <Fact
          label="jotihunt.nl"
          className={report.site ? (report.site.points > 0 ? 'text-green-700 dark:text-green-400' : 'text-destructive dark:text-red-300') : 'font-medium text-muted-foreground'}
        >
          {report.site ? `${report.site.status} · ${report.site.points} pt` : 'Nog niet beoordeeld'}
        </Fact>
      </div>

      {report.duplicateOf && <Warning>Zelfde code als hunt van {report.duplicateOf.reportedByName}</Warning>}
      {report.needsReview && !isReading(report) && <Warning>Controleer de code en tijd met de foto.</Warning>}

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill variant="secondary" disabled={!photo} onClick={download}>
          <DownloadIcon />
          Foto
        </Pill>
        {isAdmin && (
          <Pill
            variant="secondary"
            aria-pressed={editOpen}
            className={cn(editOpen && 'bg-primary/20 text-orange-700 hover:bg-primary/25 dark:text-orange-300')}
            onClick={() => {
              setEditOpen(!editOpen);
              setEditing(null);
            }}
          >
            <PencilIcon />
            Bewerken
          </Pill>
        )}
        {isAdmin && <RereadButton report={report} />}
        {canDelete && (
          <IconPill variant="danger-soft" aria-label="Verwijderen" title="Verwijderen" onClick={onDelete}>
            <Trash2Icon />
          </IconPill>
        )}
        {isAdmin && submitAction && (
          <span className="ml-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={submitAction} className="inline-flex" {...SWAP}>
                {submitAction === 'submit' ? (
                  <Pill variant="primary" size="md" disabled={busy} morphKey={busy ? 'busy' : 'idle'} onClick={() => void changeSubmitted(true)}>
                    {busy ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                    Ingestuurd
                  </Pill>
                ) : (
                  <Pill variant="secondary" disabled={busy} morphKey={busy ? 'busy' : 'idle'} onClick={() => void changeSubmitted(false)}>
                    {busy ? <Loader2Icon className="animate-spin" /> : <Undo2Icon />}
                    Terugzetten
                  </Pill>
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </div>

      {photo && <ImageLightbox src={photo} alt={`Foto van hunt ${codeLabel}`} open={zoomOpen} onOpenChange={setZoomOpen} />}
    </div>
  );
}
