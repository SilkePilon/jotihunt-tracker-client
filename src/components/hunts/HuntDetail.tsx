import { useState } from 'react';
import { ArrowLeftIcon, DownloadIcon, TriangleAlertIcon, ZoomInIcon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import CopyButton from '@/components/CopyButton';
import { Button } from '@/components/ui/button';
import { useAuthImage } from '@/hooks/auth-image.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { formatClock } from '@/lib/format';
import { huntSourceLabel, huntTimeLabel, isReading, readFailed } from '@/lib/hunt-reports';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import type { User } from '@/types/User';
import HuntCodeText, { HuntTimeText } from './HuntCodeText';
import { EditCode, EditTime, RereadButton } from './HuntInlineEdit';
import ImageLightbox from '@/components/ImageLightbox';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">{children}</dd>
    </>
  );
}

/** One hunt report: photo (downloadable), the facts HQ needs to submit it on jotihunt.nl, and actions. */
export default function HuntDetail({ report, onBack }: { report: HuntReport; onBack: () => void }) {
  const user = useAuthUser<User>();
  const { setSubmitted, deleteReport } = useHuntReports();
  const photo = useAuthImage(report.photoUrl);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Which field is being edited inline (admins) */
  const [editing, setEditing] = useState<'code' | 'time' | null>(null);
  // Status changes and deleting are HQ work: admins only (the server enforces this too)
  const isAdmin = !!user?.admin;
  const canDelete = isAdmin && !report.submittedAt && !report.site;
  const codeLabel = report.huntCode ?? 'zonder code';

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
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Terug
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-3">
          {photo ? (
            <button type="button" className="group relative block w-full cursor-zoom-in" onClick={() => setZoomOpen(true)} aria-label="Foto vergroten">
              <img src={photo} alt={`Foto van hunt ${codeLabel}`} className="max-h-[50dvh] w-full rounded-md bg-muted object-contain" />
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-badge bg-background/90 px-2 py-1 text-xs font-medium opacity-0 shadow transition-opacity group-hover:opacity-100 max-md:opacity-100">
                <ZoomInIcon className="size-3.5" />
                Vergroten
              </span>
            </button>
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">Foto laden…</div>
          )}
          <div>
            {photo ? (
              <Button asChild variant="outline" size="sm">
                <a href={photo} download={`hunt-${report.huntCode ?? report._id}.jpg`}>
                  <DownloadIcon data-icon="inline-start" />
                  Foto downloaden
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled>
                <DownloadIcon data-icon="inline-start" />
                Foto downloaden
              </Button>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
            <Fact label="Deelgebied">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(report.area) }} />
              {capitalizeFirstLetter(report.area)}
            </Fact>
            <Fact label="Code">
              {editing !== 'code' && <HuntCodeText report={report} />}
              {isAdmin && editing !== 'code' && report.huntCode && <CopyButton value={report.huntCode} label="Code" />}
              {isAdmin && <EditCode report={report} editing={editing === 'code'} onEditingChange={(on) => setEditing(on ? 'code' : null)} />}
              {isAdmin && editing !== 'code' && <RereadButton report={report} />}
            </Fact>
            <Fact label="Tijd">
              {editing !== 'time' && <HuntTimeText report={report} className="font-mono" />}
              {isAdmin && editing !== 'time' && report.huntTimeKnown && <CopyButton value={huntTimeLabel(report)} label="Tijd" />}
              {isAdmin && <EditTime report={report} editing={editing === 'time'} onEditingChange={(on) => setEditing(on ? 'time' : null)} />}
            </Fact>
            <Fact label="Bron">
              <span className={readFailed(report) ? 'text-destructive' : 'text-muted-foreground'}>{huntSourceLabel(report, isAdmin)}</span>
            </Fact>
            <Fact label="Gemeld door">
              {report.reportedByName} · {formatClock(report.createdAt)}
            </Fact>
            <Fact label="Deadline">{formatClock(report.deadline)}</Fact>
            <Fact label="Ingestuurd door">{report.submittedAt ? `${report.submittedByName ?? 'Onbekend'} · ${formatClock(report.submittedAt)}` : '–'}</Fact>
            <Fact label="jotihunt.nl">{report.site ? `${report.site.status} · ${report.site.points} pt` : 'Nog niet beoordeeld'}</Fact>
          </dl>

          {(report.needsReview || report.duplicateOf) && (
            <div className="flex flex-col gap-1 text-sm text-amber-700 dark:text-amber-400">
              {report.duplicateOf && (
                <p className="flex items-center gap-1.5">
                  <TriangleAlertIcon className="size-4 shrink-0" />
                  Zelfde code als hunt van {report.duplicateOf.reportedByName}
                </p>
              )}
              {report.needsReview && !isReading(report) && <p>Controleer de code en tijd met de foto.</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isAdmin && !report.submittedAt && (
              <Button type="button" disabled={busy} onClick={() => void changeSubmitted(true)}>
                Ingestuurd
              </Button>
            )}
            {isAdmin && report.submittedAt && report.status !== 'judged' && (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void changeSubmitted(false)}>
                Terugzetten
              </Button>
            )}
            {canDelete && (
              <Button type="button" variant="destructive" className="ml-auto" disabled={busy} onClick={() => setConfirmOpen(true)}>
                Verwijderen
              </Button>
            )}
          </div>
        </div>
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
