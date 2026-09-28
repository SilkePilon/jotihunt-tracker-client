import { useEffect, useId, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAreas } from '@/hooks/areas.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { usePredictions } from '@/hooks/predictions.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { huntCooldownMs, lastHuntTimeFor } from '@/lib/fox-status';
import { formatHuntTime, nearestArea, normalizeHuntCode, resolveHuntTime } from '@/lib/hunt-reports';
import { downscalePhoto } from '@/lib/image';
import { readHuntCode } from '@/lib/ocr';
import { areaOptions, getColorFromArea } from '@/lib/utils';
import useHuntCaptureStore from '@/stores/hunt-capture.store';
import type { HuntKind } from '@/types/HuntReport';

type OcrState = 'idle' | 'reading' | 'found' | 'not_found';
type Errors = { code?: string; area?: string; time?: string; save?: string };

const CLOCK_TICK_MS = 15_000;
const pad = (value: number) => String(value).padStart(2, '0');

/** HH:MM as numbers, or null when not a valid 24 h time. */
function parseTime(hours: string, minutes: string): { h: number; m: number } | null {
  if (!/^\d{1,2}$/.test(hours) || !/^\d{1,2}$/.test(minutes)) return null;
  const h = Number(hours);
  const m = Number(minutes);
  return h <= 23 && m <= 59 ? { h, m } : null;
}

interface TimeFieldsProps {
  id: string;
  hours: string;
  minutes: string;
  onHours: (value: string) => void;
  onMinutes: (value: string) => void;
  resolved: Date | null;
  error?: string;
}

/** HH and MM inputs (auto-advance after two digits), a "Nu" button and the resolved date/time. */
function TimeFields({ id, hours, minutes, onHours, onMinutes, resolved, error }: TimeFieldsProps) {
  const minutesRef = useRef<HTMLInputElement>(null);
  const digits = (value: string) => value.replace(/\D/g, '').slice(0, 2);
  const labelId = `${id}-time-label`;

  return (
    <Field data-invalid={!!error} className="gap-2">
      <FieldLabel id={labelId}>Tijd op de foto</FieldLabel>
      <div className="flex items-center gap-2" role="group" aria-labelledby={labelId}>
        <Input
          id={`${id}-hours`}
          inputMode="numeric"
          maxLength={2}
          placeholder="UU"
          autoComplete="off"
          aria-label="Uren"
          aria-invalid={!!error}
          className="w-14 text-center"
          value={hours}
          onChange={(event) => {
            const value = digits(event.target.value);
            onHours(value);
            if (value.length === 2) minutesRef.current?.focus();
          }}
        />
        <span className="font-semibold">:</span>
        <Input
          ref={minutesRef}
          inputMode="numeric"
          maxLength={2}
          placeholder="MM"
          autoComplete="off"
          aria-label="Minuten"
          aria-invalid={!!error}
          className="w-14 text-center"
          value={minutes}
          onChange={(event) => onMinutes(digits(event.target.value))}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const current = new Date();
            onHours(pad(current.getHours()));
            onMinutes(pad(current.getMinutes()));
          }}
        >
          Nu
        </Button>
      </div>
      {resolved && (
        <FieldDescription>
          Hunt om {formatHuntTime(resolved.toISOString())} op{' '}
          {resolved.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
        </FieldDescription>
      )}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

/** Register a hunt from a photo: code (OCR), fox team, handwritten time and kind. Driven by the capture store. */
export default function HuntRegistrationDialog() {
  const id = useId();
  const { photo, open, close } = useHuntCaptureStore();
  const { areas } = useAreas();
  const { hunts } = useHunts();
  const { predictions } = usePredictions();
  const { reports, createReport } = useHuntReports();

  const [prepared, setPrepared] = useState<{ source: File; blob: Blob; url: string } | null>(null);
  const [ocr, setOcr] = useState<OcrState>('idle');
  const [code, setCode] = useState('');
  const [area, setArea] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [kind, setKind] = useState<HuntKind>('hunt');
  const [position, setPosition] = useState<{ lng: number; lat: number } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  /** A save failed for another reason than a duplicate code: the button offers a retry */
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), open ? CLOCK_TICK_MS : null);

  // Reset the form when a new photo arrives (adjust state during render, no effect)
  const [prevPhoto, setPrevPhoto] = useState<File | null>(null);
  if (photo !== prevPhoto) {
    setPrevPhoto(photo);
    setPrepared(null);
    setOcr(photo ? 'reading' : 'idle');
    setCode('');
    setArea('');
    setHours('');
    setMinutes('');
    setKind('hunt');
    setErrors({});
    setSaving(false);
    setFailed(false);
  }

  // Downscale + OCR + position for the new photo (all setState calls happen in async callbacks)
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    let url: string | undefined;
    void downscalePhoto(photo)
      .catch(() => photo as Blob)
      .then(async (blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPrepared({ source: photo, blob, url });
        const found = await readHuntCode(blob);
        if (cancelled) return;
        setCode((current) => current || found);
        setOcr(found ? 'found' : 'not_found');
      });
    navigator.geolocation?.getCurrentPosition(
      (result) => !cancelled && setPosition({ lng: result.coords.longitude, lat: result.coords.latitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo]);

  const suggestedArea = nearestArea(position, predictions);
  const chosenArea = area || suggestedArea || '';
  const time = parseTime(hours, minutes);
  const resolved = time ? resolveHuntTime(time.h, time.m, new Date(now)) : null;
  const isRed = !!chosenArea && areas?.find((candidate) => candidate.name.toLowerCase() === chosenArea)?.status === 'red';
  const inCooldown = !!chosenArea && kind === 'hunt' && huntCooldownMs(lastHuntTimeFor(hunts, chosenArea, reports), now) > 0;

  const clearError = (key: keyof Errors) => setErrors((current) => ({ ...current, [key]: undefined, save: undefined }));

  async function save() {
    const huntCode = normalizeHuntCode(code);
    const next: Errors = {};
    if (!huntCode) next.code = 'Vul de huntcode in';
    if (!chosenArea) next.area = 'Kies de vos';
    if (!time) next.time = 'Vul een geldige tijd in (00:00 – 23:59)';
    setErrors(next);
    if (next.code || next.area || !time || !photo || !prepared || prepared.source !== photo) return;

    // The photo this save belongs to: if it's been replaced by the time the request resolves,
    // this save's result (close/error) must not act on the newer dialog state.
    const savingPhoto = photo;
    const savingBlob = prepared.blob;
    setSaving(true);
    try {
      const report = await createReport({
        photo: savingBlob,
        huntCode,
        huntTime: resolveHuntTime(time.h, time.m, new Date()),
        area: chosenArea,
        kind,
        position,
      });
      if (useHuntCaptureStore.getState().photo !== savingPhoto) return;
      toast.success('Hunt geregistreerd', { description: `HQ heeft tot ${formatHuntTime(report.deadline)} om hem in te sturen.` });
      close();
    } catch (error) {
      if (useHuntCaptureStore.getState().photo !== savingPhoto) return;
      if (isAxiosError<{ reason?: string; reportedByName?: string }>(error) && error.response?.status === 409) {
        setErrors({ code: `Deze code is al geregistreerd door ${error.response.data?.reportedByName ?? 'iemand anders'}` });
        setFailed(false);
      } else {
        setErrors({ save: 'Opslaan is mislukt. Controleer je verbinding.' });
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
          <DialogDescription>Controleer de gegevens van de foto. HQ stuurt de hunt daarna in.</DialogDescription>
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
            <Field data-invalid={!!errors.code} className="gap-2">
              <FieldLabel htmlFor={`${id}-code`}>Huntcode</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id={`${id}-code`}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={!!errors.code}
                  className="font-mono uppercase"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    clearError('code');
                  }}
                  onBlur={() => setCode((current) => normalizeHuntCode(current))}
                />
                {ocr === 'reading' && <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />}
              </div>
              {ocr === 'reading' && <FieldDescription>Code lezen…</FieldDescription>}
              {ocr === 'found' && <FieldDescription>Controleer de code</FieldDescription>}
              {ocr === 'not_found' && <FieldDescription>Code niet gelezen, typ hem over</FieldDescription>}
              <FieldError>{errors.code}</FieldError>
            </Field>

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

            <TimeFields
              id={id}
              hours={hours}
              minutes={minutes}
              onHours={(value) => {
                setHours(value);
                clearError('time');
              }}
              onMinutes={(value) => {
                setMinutes(value);
                clearError('time');
              }}
              resolved={resolved}
              error={errors.time}
            />

            <Field className="gap-2">
              <FieldLabel>Soort</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                aria-label="Soort"
                className="w-full"
                value={kind}
                onValueChange={(next) => next && setKind(next as HuntKind)}
              >
                <ToggleGroupItem value="hunt" className="flex-1">
                  Hunt
                </ToggleGroupItem>
                <ToggleGroupItem value="tegenhunt" className="flex-1">
                  Tegenhunt
                </ToggleGroupItem>
              </ToggleGroup>
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
              {failed ? 'Opnieuw proberen' : 'Registreren'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
