import { useState } from 'react';
import { ArrowLeftIcon, DownloadIcon, PencilIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import CopyButton from '@/components/CopyButton';
import ImageLightbox from '@/components/ImageLightbox';
import { Button } from '@/components/ui/button';
import { useAuthImage } from '@/hooks/auth-image.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { formatClock } from '@/lib/format';
import { huntSourceLabel, huntTimeLabel, isReading, readFailed } from '@/lib/hunt-reports';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import type { User } from '@/types/User';
import HuntCodeText, { HuntTimeText } from './HuntCodeText';
import { EditCode, EditTime, RereadButton } from './HuntInlineEdit';
import HuntStatusBadge from './HuntStatusBadge';
import StickerHero from './StickerHero';

/** One cell of the facts strip under the photo. */
function FactCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5 max-md:px-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="truncate text-sm max-md:text-xs">{children}</span>
    </div>
  );
}

/** One hunt report: the photo zoomed onto the sticker with code and status over it, the facts HQ needs, and actions. */
export default function HuntDetail({ report, now, onBack, onClose }: { report: HuntReport; now: number; onBack: () => void; onClose: () => void }) {
  const user = useAuthUser<User>();
  const { setSubmitted, deleteReport } = useHuntReports();
  const photo = useAuthImage(report.photoUrl);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** The code/time edit row under the facts (admins) */
  const [editOpen, setEditOpen] = useState(false);
  /** Which field is being edited inline (admins) */
  const [editing, setEditing] = useState<'code' | 'time' | null>(null);
  // Status changes and deleting are HQ work: admins only (the server enforces this too)
  const isAdmin = !!user?.admin;
  const canDelete = isAdmin && !report.submittedAt && !report.site;
  const codeLabel = report.huntCode ?? 'zonder code';
  // Once submitted, who sent it in matters more than where the code came from
  const showSubmitter = report.status === 'submitted' || report.status === 'judged';
  const sourceLabel = huntSourceLabel(report, isAdmin);

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

  async function remove() {
    setBusy(true);
    try {
      await deleteReport(report._id);
      toast.success('Hunt verwijderd');
      onBack();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Verwijderen is mislukt'));
      setConfirmOpen(false);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="relative shrink-0">
        {photo ? (
          <button type="button" className="block w-full cursor-zoom-in" onClick={() => setZoomOpen(true)} aria-label="Foto vergroten">
            <StickerHero src={photo} box={report.stickerBox} alt={`Foto van hunt ${codeLabel}`} className="h-60 max-md:h-52" />
          </button>
        ) : (
          <div className="flex h-60 items-center justify-center bg-muted text-sm text-muted-foreground max-md:h-52">Foto laden…</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-background px-4 pt-12 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <HuntCodeText report={report} className="text-[22px] leading-tight" />
            {isAdmin && report.huntCode && (
              <span className="pointer-events-auto">
                <CopyButton value={report.huntCode} label="Code" />
              </span>
            )}
            <span className="pointer-events-auto ml-auto">
              <HuntStatusBadge report={report} now={now} />
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(report.area) }} />
            {capitalizeFirstLetter(report.area)} · <HuntTimeText report={report} className="font-mono" />
            {isAdmin && report.huntTimeKnown && (
              <span className="pointer-events-auto">
                <CopyButton value={huntTimeLabel(report)} label="Tijd" />
              </span>
            )}· deadline {formatClock(report.deadline)}
          </div>
        </div>
        <Button type="button" variant="secondary" size="icon-sm" className="absolute top-3 left-3 bg-background/70 backdrop-blur" onClick={onBack} aria-label="Terug">
          <ArrowLeftIcon />
        </Button>
        <Button type="button" variant="secondary" size="icon-sm" className="absolute top-3 right-3 bg-background/70 backdrop-blur" onClick={onClose} aria-label="Sluiten">
          <XIcon />
        </Button>
      </div>

      <div className="grid shrink-0 grid-cols-3 divide-x border-y">
        <FactCell label="Gemeld door">
          {report.reportedByName} · {formatClock(report.createdAt)}
        </FactCell>
        {showSubmitter ? (
          <FactCell label="Ingestuurd door">{report.submittedAt ? `${report.submittedByName ?? 'Onbekend'} · ${formatClock(report.submittedAt)}` : '–'}</FactCell>
        ) : (
          <FactCell label="Bron">
            <span className={readFailed(report) ? 'text-destructive' : 'text-muted-foreground'} title={sourceLabel}>
              {sourceLabel}
            </span>
          </FactCell>
        )}
        <FactCell label="jotihunt.nl">{report.site ? `${report.site.status} · ${report.site.points} pt` : <span className="text-muted-foreground">Nog niet beoordeeld</span>}</FactCell>
      </div>

      {isAdmin && editOpen && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b px-4 py-2.5 text-sm">
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

      {(report.duplicateOf || (report.needsReview && !isReading(report))) && (
        <div className="mx-4 mt-3 flex shrink-0 flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {report.duplicateOf && (
            <p className="flex items-center gap-1.5">
              <TriangleAlertIcon className="size-4 shrink-0" />
              Zelfde code als hunt van {report.duplicateOf.reportedByName}
            </p>
          )}
          {report.needsReview && !isReading(report) && <p>Controleer de code en tijd met de foto.</p>}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-3 pb-4">
        {photo ? (
          <Button asChild variant="outline" size="sm">
            <a href={photo} download={`hunt-${report.huntCode ?? report._id}.jpg`}>
              <DownloadIcon data-icon="inline-start" />
              Foto
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled>
            <DownloadIcon data-icon="inline-start" />
            Foto
          </Button>
        )}
        {isAdmin && (
          <Button
            type="button"
            variant={editOpen ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={editOpen}
            onClick={() => {
              setEditOpen(!editOpen);
              setEditing(null);
            }}
          >
            <PencilIcon data-icon="inline-start" />
            Bewerken
          </Button>
        )}
        {isAdmin && <RereadButton report={report} />}
        {canDelete && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => setConfirmOpen(true)}>
            Verwijderen
          </Button>
        )}
        <span className={cn('ml-auto flex gap-2', !isAdmin && 'hidden')}>
          {!report.submittedAt && (
            <Button type="button" disabled={busy} onClick={() => void changeSubmitted(true)}>
              Ingestuurd
            </Button>
          )}
          {report.submittedAt && report.status !== 'judged' && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void changeSubmitted(false)}>
              Terugzetten
            </Button>
          )}
        </span>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hunt ${codeLabel} verwijderen?`}
        description="De foto wordt ook verwijderd."
        confirmLabel="Verwijderen"
        destructive
        onConfirm={remove}
      />
      {photo && <ImageLightbox src={photo} alt={`Foto van hunt ${codeLabel}`} open={zoomOpen} onOpenChange={setZoomOpen} />}
    </div>
  );
}
