import { useState } from 'react';
import { isAxiosError } from 'axios';
import { ArrowLeftIcon, CopyIcon, DownloadIcon, ZoomInIcon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuthImage } from '@/hooks/auth-image.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { formatHuntTime, isConcealed } from '@/lib/hunt-reports';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import type { User } from '@/types/User';
import Concealed from './Concealed';
import ImageLightbox from './ImageLightbox';

/** The server's (Dutch) error message when there is one. */
function errorMessage(error: unknown, fallback: string): string {
  return (isAxiosError<{ message?: string }>(error) && error.response?.data?.message) || fallback;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">{children}</dd>
    </>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} gekopieerd`);
    } catch {
      toast.error('Kopiëren mislukt');
    }
  }

  return (
    <Button type="button" variant="outline" size="icon-xs" aria-label={`${label} kopiëren`} onClick={() => void copy()}>
      <CopyIcon />
    </Button>
  );
}

/** One hunt report: photo (downloadable), the facts HQ needs to submit it on jotihunt.nl, and actions. */
export default function HuntDetail({ report, now, onBack }: { report: HuntReport; now: number; onBack: () => void }) {
  const user = useAuthUser<User>();
  const { setSubmitted, deleteReport } = useHuntReports();
  const photo = useAuthImage(report.photoUrl);
  const [zoomOpen, setZoomOpen] = useState(false);
  const concealed = isConcealed(report, now);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Status changes and deleting are HQ work: admins only (the server enforces this too)
  const isAdmin = !!user?.admin;
  const canDelete = isAdmin && !report.submittedAt && !report.site;

  async function changeSubmitted(submitted: boolean) {
    setBusy(true);
    try {
      await setSubmitted(report._id, submitted);
      toast.success(submitted ? 'Gemarkeerd als ingestuurd' : 'Teruggezet naar te versturen');
    } catch (error) {
      toast.error(errorMessage(error, 'Opslaan is mislukt'));
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
      toast.error(errorMessage(error, 'Verwijderen is mislukt'));
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
            <Concealed concealed={concealed} kind="image" className="overflow-hidden rounded-md">
              <button type="button" className="group relative block w-full cursor-zoom-in" onClick={() => setZoomOpen(true)} aria-label="Foto vergroten">
                <img src={photo} alt={`Foto van hunt ${report.huntCode}`} className="max-h-[50dvh] w-full rounded-md bg-muted object-contain" />
                <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium opacity-0 shadow transition-opacity group-hover:opacity-100 max-md:opacity-100">
                  <ZoomInIcon className="size-3.5" />
                  Vergroten
                </span>
              </button>
            </Concealed>
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">Foto laden…</div>
          )}
          <div>
            {photo ? (
              <Button asChild variant="outline" size="sm">
                <a href={photo} download={`hunt-${report.huntCode}.jpg`}>
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
              <Concealed concealed={concealed}>
                <span className="truncate font-mono font-medium">{report.huntCode}</span>
              </Concealed>
              <CopyButton value={report.huntCode} label="Code" />
            </Fact>
            <Fact label="Tijd">
              <span className="font-mono">{formatHuntTime(report.huntTime)}</span>
              <CopyButton value={formatHuntTime(report.huntTime)} label="Tijd" />
            </Fact>
            <Fact label="Soort">{capitalizeFirstLetter(report.kind)}</Fact>
            <Fact label="Gemeld door">
              {report.reportedByName} · {formatHuntTime(report.createdAt)}
            </Fact>
            <Fact label="Deadline">{formatHuntTime(report.deadline)}</Fact>
            <Fact label="Ingestuurd door">{report.submittedAt ? `${report.submittedByName ?? 'Onbekend'} · ${formatHuntTime(report.submittedAt)}` : '–'}</Fact>
            <Fact label="jotihunt.nl">{report.site ? `${report.site.status} · ${report.site.points} pt` : 'Nog niet beoordeeld'}</Fact>
          </dl>

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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hunt {report.huntCode} verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>De foto wordt ook verwijderd.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {photo && <ImageLightbox src={photo} alt={`Foto van hunt ${report.huntCode}`} open={zoomOpen} onOpenChange={setZoomOpen} />}
    </div>
  );
}
