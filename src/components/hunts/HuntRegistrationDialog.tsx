import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import AutoHeight from '@/components/motion/AutoHeight';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAreas } from '@/hooks/areas.hook';
import { useSyncedHunts } from '@/hooks/hunt-sync.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import { SLOW_CLOCK_TICK_MS, useNow } from '@/hooks/now.hook';
import { apiErrorMessage, apiErrorStatus } from '@/lib/api-error';
import { huntCooldownMs, lastHuntTimeFor } from '@/lib/fox-status';
import { nearestArea } from '@/lib/hunt-reports';
import { preparePhoto } from '@/lib/image';
import { SWAP } from '@/lib/motion';
import { areaOptions, getColorFromArea, randomId } from '@/lib/utils';
import useHuntCaptureStore from '@/stores/hunt-capture.store';
import type { HuntReport } from '@/types/HuntReport';
import QrConfirmStep from './QrConfirmStep';

type Errors = { area?: string; save?: string };
type Position = { lng: number; lat: number };

/** How long save() waits for a still-pending geolocation request before uploading without it. */
const POSITION_WAIT_MS = 3_000;
/** The parent FieldGroup's gap (gap-4), so a warning folding away leaves no gap behind */
const FIELD_GAP = 16;

function wait(ms: number): Promise<'timeout'> {
  return new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));
}

/**
 * Register a hunt: only the fox team. With a photo ("Foto bij hunt" on) the server reads the code and the handwritten
 * time from it in the background and HQ submits it. Without one (QR hunt) the tap time and position are saved and the
 * dialog swaps to the confirm step: scan the fox's QR code and confirm on jotihunt.nl within 15 minutes.
 * Driven by the capture store.
 */
export default function HuntRegistrationDialog() {
  const { photo, open, session, startedAt, close } = useHuntCaptureStore();
  const { areas } = useAreas();
  const { hunts } = useSyncedHunts();
  const { predictions } = usePredictions();
  const { createReport } = useHuntReports();

  const [prepared, setPrepared] = useState<{ source: File; blob: Blob; thumb: Blob | null; url: string } | null>(null);
  const [area, setArea] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  /** Resolves with the geolocation result (or null on error/no support); set inside the session effect, only read in save(). */
  const positionPromiseRef = useRef<Promise<Position | null> | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  /** A save failed on the network or server: the button offers a retry */
  const [failed, setFailed] = useState(false);
  /** The QR hunt that was just sent: the dialog shows the confirm step */
  const [sent, setSent] = useState<HuntReport | null>(null);
  const now = useNow(open, SLOW_CLOCK_TICK_MS);

  /** One id per hunt, sent with every upload attempt so the server can recognise a retry */
  const [uploadId, setUploadId] = useState(() => randomId());

  // Reset the form for every new hunt (adjust state during render, no effect)
  const [prevSession, setPrevSession] = useState(session);
  if (session !== prevSession) {
    setPrevSession(session);
    setUploadId(randomId());
    setPrepared(null);
    // The previous hunt's position must not suggest an area or be uploaded with this one
    setPosition(null);
    setArea('');
    setErrors({});
    setSaving(false);
    setFailed(false);
    setSent(null);
  }

  const withPhoto = photo !== null;

  // Downscale the photo (if any) + position for the new hunt (all setState calls happen in async callbacks)
  useEffect(() => {
    if (session === 0) return;
    let cancelled = false;
    let url: string | undefined;
    if (photo) {
      // Not decodable here: upload the original without a thumbnail (the list then shows the full photo)
      void preparePhoto(photo)
        .catch(() => ({ photo: photo as Blob, thumb: null }))
        .then(({ photo: blob, thumb }) => {
          if (cancelled) return;
          url = URL.createObjectURL(blob);
          setPrepared({ source: photo, blob, thumb, url });
        });
    }
    positionPromiseRef.current = new Promise<Position | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (result) => {
          const next = { lng: result.coords.longitude, lat: result.coords.latitude };
          if (!cancelled) setPosition(next);
          resolve(next);
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      );
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [session, photo]);

  const suggestedArea = nearestArea(position, predictions);
  const chosenArea = area || suggestedArea || '';
  const isRed = !!chosenArea && areas?.find((candidate) => candidate.name.toLowerCase() === chosenArea)?.status === 'red';
  const inCooldown = !!chosenArea && huntCooldownMs(lastHuntTimeFor(hunts, chosenArea), now) > 0;
  const photoReady = !withPhoto || (!!prepared && prepared.source === photo);

  const clearError = (key: keyof Errors) => setErrors((current) => ({ ...current, [key]: undefined, save: undefined }));

  async function save() {
    const next: Errors = {};
    if (!chosenArea) next.area = 'Kies de vos';
    setErrors(next);
    if (next.area || !photoReady) return;

    // The hunt this save belongs to: if a new one started by the time the request resolves,
    // this save's result (close/error) must not act on the newer dialog state.
    const savingSession = session;
    const isCurrent = () => useHuntCaptureStore.getState().session === savingSession;
    setSaving(true);
    try {
      // The time on the photo is only known after reading, so always send the phone's position (the marker
      // starts at the upload time). Wait briefly for a still-pending geolocation request.
      let resolvedPosition = position;
      if (positionPromiseRef.current) {
        const winner = await Promise.race([positionPromiseRef.current, wait(POSITION_WAIT_MS)]);
        if (winner !== 'timeout') resolvedPosition = winner;
      }
      const report = withPhoto
        ? await createReport({ photo: prepared!.blob, thumb: prepared!.thumb, area: chosenArea, position: resolvedPosition, uploadId })
        : await createReport({ photo: null, area: chosenArea, position: resolvedPosition, uploadId, takenAt: new Date(startedAt) });
      if (!isCurrent()) return;
      if (withPhoto) {
        toast.success('Hunt verstuurd', { description: 'De code en tijd worden nu gelezen.' });
        close();
      } else {
        setSent(report);
      }
    } catch (error) {
      if (!isCurrent()) return;
      const status = apiErrorStatus(error);
      if (status !== undefined && status >= 400 && status < 500) {
        setErrors({ save: apiErrorMessage(error, 'Versturen is mislukt.') });
        setFailed(false);
      } else {
        setErrors({ save: 'Versturen is mislukt. Controleer je verbinding.' });
        setFailed(true);
      }
    } finally {
      if (isCurrent()) setSaving(false);
    }
  }

  const scene = sent ? 'sent' : 'form';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md" data-hunt-registration>
        <AutoHeight scene={scene} className="-m-1" innerClassName="p-1">
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div key="sent" {...SWAP}>
                <QrConfirmStep report={sent} onClose={close} />
              </motion.div>
            ) : (
              <motion.div key="form" className="flex flex-col gap-4" {...SWAP}>
                <DialogHeader>
                  <DialogTitle>{withPhoto ? 'Hunt registreren' : 'Hunt melden'}</DialogTitle>
                  <DialogDescription>
                    {withPhoto
                      ? 'Kies de vos. De code en tijd worden van de foto gelezen, HQ stuurt de hunt daarna in.'
                      : 'Kies de vos en tik op Melden. Daarna scan je de QR-code bij de vos.'}
                  </DialogDescription>
                </DialogHeader>
                {withPhoto &&
                  (prepared ? (
                    <img src={prepared.url} alt="Foto van de hunt" className="max-h-48 w-full rounded-md bg-muted object-contain" />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center rounded-md bg-muted">
                      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ))}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                >
                  <FieldGroup className="gap-4">
                    <Field data-invalid={!!errors.area} className="gap-2">
                      <FieldLabel>Vos</FieldLabel>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        spacing={1}
                        aria-label="Vos"
                        className="grid w-full grid-cols-3"
                        value={chosenArea}
                        onValueChange={(next) => {
                          if (!next) return;
                          setArea(next);
                          clearError('area');
                        }}
                      >
                        {areaOptions.map((option) => (
                          <ToggleGroupItem key={option.value} value={option.value} className="justify-start gap-1.5">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(option.value) }} />
                            {option.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <FieldError>{errors.area}</FieldError>
                    </Field>

                    <Reveal gap={FIELD_GAP}>{isRed && <p className="text-sm text-amber-600 dark:text-amber-500">Deze vos is inactief (rood). De hunt wordt waarschijnlijk afgekeurd.</p>}</Reveal>
                    <Reveal gap={FIELD_GAP}>{inCooldown && <p className="text-sm text-amber-600 dark:text-amber-500">Deze vos zit nog in de cooldown van een eerdere hunt.</p>}</Reveal>
                    <Reveal gap={FIELD_GAP}>
                      {errors.save && (
                        <p role="alert" className="text-sm font-medium text-destructive">
                          {errors.save}
                        </p>
                      )}
                    </Reveal>
                  </FieldGroup>
                  <DialogFooter className="mt-4">
                    <Button type="submit" className="h-10 w-full rounded-xl font-semibold sm:w-auto" disabled={saving || !photoReady}>
                      {saving && <Loader2Icon className="animate-spin" />}
                      {failed ? 'Opnieuw proberen' : withPhoto ? 'Versturen' : 'Melden'}
                    </Button>
                  </DialogFooter>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </AutoHeight>
      </DialogContent>
    </Dialog>
  );
}
