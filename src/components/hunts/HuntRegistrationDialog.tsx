import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAreas } from '@/hooks/areas.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { huntCooldownMs, lastHuntTimeFor } from '@/lib/fox-status';
import { nearestArea } from '@/lib/hunt-reports';
import { downscalePhoto } from '@/lib/image';
import { areaOptions, getColorFromArea, randomId } from '@/lib/utils';
import useHuntCaptureStore from '@/stores/hunt-capture.store';

type Errors = { area?: string; save?: string };
type Position = { lng: number; lat: number };

const CLOCK_TICK_MS = 15_000;
/** How long save() waits for a still-pending geolocation request before uploading without it. */
const POSITION_WAIT_MS = 3_000;

function wait(ms: number): Promise<'timeout'> {
  return new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));
}

/**
 * Register a hunt from a photo: only the fox team. The server reads the code and the handwritten time
 * from the photo in the background; HQ checks them. Driven by the capture store.
 */
export default function HuntRegistrationDialog() {
  const { photo, open, close } = useHuntCaptureStore();
  const { areas } = useAreas();
  const { hunts } = useHunts();
  const { predictions } = usePredictions();
  const { reports, createReport } = useHuntReports();

  const [prepared, setPrepared] = useState<{ source: File; blob: Blob; url: string } | null>(null);
  const [area, setArea] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  /** Resolves with the geolocation result (or null on error/no support); set inside the capture effect, only read in save(). */
  const positionPromiseRef = useRef<Promise<Position | null> | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  /** A save failed on the network or server: the button offers a retry */
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), open ? CLOCK_TICK_MS : null);

  /** One id per photo, sent with every upload attempt so the server can recognise a retry */
  const [uploadId, setUploadId] = useState(() => randomId());

  // Reset the form when a new photo arrives (adjust state during render, no effect)
  const [prevPhoto, setPrevPhoto] = useState<File | null>(null);
  if (photo !== prevPhoto) {
    setPrevPhoto(photo);
    setUploadId(randomId());
    setPrepared(null);
    setArea('');
    setErrors({});
    setSaving(false);
    setFailed(false);
  }

  // Downscale + position for the new photo (all setState calls happen in async callbacks)
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    let url: string | undefined;
    void downscalePhoto(photo)
      .catch(() => photo as Blob)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPrepared({ source: photo, blob, url });
      });
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
  }, [photo]);

  const suggestedArea = nearestArea(position, predictions);
  const chosenArea = area || suggestedArea || '';
  const isRed = !!chosenArea && areas?.find((candidate) => candidate.name.toLowerCase() === chosenArea)?.status === 'red';
  const inCooldown = !!chosenArea && huntCooldownMs(lastHuntTimeFor(hunts, chosenArea, reports), now) > 0;

  const clearError = (key: keyof Errors) => setErrors((current) => ({ ...current, [key]: undefined, save: undefined }));

  async function save() {
    const next: Errors = {};
    if (!chosenArea) next.area = 'Kies de vos';
    setErrors(next);
    if (next.area || !photo || !prepared || prepared.source !== photo) return;

    // The photo this save belongs to: if it's been replaced by the time the request resolves,
    // this save's result (close/error) must not act on the newer dialog state.
    const savingPhoto = photo;
    const savingBlob = prepared.blob;
    setSaving(true);
    try {
      // The time on the photo is only known after reading, so always send the phone's position (the marker
      // starts at the upload time). Wait briefly for a still-pending geolocation request.
      let resolvedPosition = position;
      if (positionPromiseRef.current) {
        const winner = await Promise.race([positionPromiseRef.current, wait(POSITION_WAIT_MS)]);
        if (winner !== 'timeout') resolvedPosition = winner;
      }
      await createReport({ photo: savingBlob, area: chosenArea, position: resolvedPosition, uploadId });
      if (useHuntCaptureStore.getState().photo !== savingPhoto) return;
      toast.success('Hunt verstuurd', { description: 'De code en tijd worden nu gelezen.' });
      close();
    } catch (error) {
      if (useHuntCaptureStore.getState().photo !== savingPhoto) return;
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (status !== undefined && status >= 400 && status < 500) {
        const body = isAxiosError<{ message?: string; errors?: { msg: string }[] }>(error) ? error.response?.data : undefined;
        setErrors({ save: body?.message ?? body?.errors?.[0]?.msg ?? 'Versturen is mislukt.' });
        setFailed(false);
      } else {
        setErrors({ save: 'Versturen is mislukt. Controleer je verbinding.' });
        setFailed(true);
      }
    } finally {
      if (useHuntCaptureStore.getState().photo === savingPhoto) setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md" data-hunt-registration>
        <DialogHeader>
          <DialogTitle>Hunt registreren</DialogTitle>
          <DialogDescription>Kies de vos. De code en tijd worden van de foto gelezen, HQ stuurt de hunt daarna in.</DialogDescription>
        </DialogHeader>
        {prepared ? (
          <img src={prepared.url} alt="Foto van de hunt" className="max-h-48 w-full rounded-md bg-muted object-contain" />
        ) : (
          <div className="flex h-48 w-full items-center justify-center rounded-md bg-muted">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
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

            {isRed && <p className="text-sm text-amber-600 dark:text-amber-500">Deze vos is inactief (rood). De hunt wordt waarschijnlijk afgekeurd.</p>}
            {inCooldown && <p className="text-sm text-amber-600 dark:text-amber-500">Deze vos zit nog in de cooldown van een eerdere hunt.</p>}
            {errors.save && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.save}
              </p>
            )}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" className="w-full sm:w-auto" disabled={saving || !prepared || prepared.source !== photo}>
              {saving && <Loader2Icon className="animate-spin" />}
              {failed ? 'Opnieuw proberen' : 'Versturen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
