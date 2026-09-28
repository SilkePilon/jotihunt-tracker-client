import { useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { formatHuntTime, isReading, normalizeHuntCode, resolveHuntTime } from '@/lib/hunt-reports';
import type { HuntReport } from '@/types/HuntReport';

type Errors = { code?: string; time?: string };

const pad = (value: number) => String(value).padStart(2, '0');

/** The server's (Dutch) error message when there is one. */
function errorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError<{ message?: string; errors?: { msg: string }[] }>(error)) return fallback;
  return error.response?.data?.message ?? error.response?.data?.errors?.[0]?.msg ?? fallback;
}

/** HH:MM as numbers, or null when not a valid 24 h time. */
function parseTime(hours: string, minutes: string): { h: number; m: number } | null {
  if (!/^\d{1,2}$/.test(hours) || !/^\d{1,2}$/.test(minutes)) return null;
  const h = Number(hours);
  const m = Number(minutes);
  return h <= 23 && m <= 59 ? { h, m } : null;
}

/** The time on the photo as "HH:MM", or '' while it is not known (only the upload time). */
function knownTime(report: HuntReport): string {
  if (!report.huntTimeKnown) return '';
  const date = new Date(report.huntTime);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

/** HH and MM inputs (auto-advance after two digits) and the resolved date/time. */
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
          className="w-14 text-center font-mono"
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
          className="w-14 text-center font-mono"
          value={minutes}
          onChange={(event) => onMinutes(digits(event.target.value))}
        />
      </div>
      {resolved && (
        <FieldDescription>
          Hunt om {formatHuntTime(resolved.toISOString())} op {resolved.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
        </FieldDescription>
      )}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

/** HQ corrects the code and time read from the photo, or has the photo read again. Admins only. */
export default function HuntFieldsForm({ report }: { report: HuntReport }) {
  const id = `hunt-${report._id}`;
  const { updateReport, rereadReport } = useHuntReports();
  const serverCode = report.huntCode ?? '';
  const serverTime = knownTime(report);
  const [code, setCode] = useState(serverCode);
  const [hours, setHours] = useState(serverTime.slice(0, 2));
  const [minutes, setMinutes] = useState(serverTime.slice(3));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<'save' | 'read' | null>(null);

  // New values from the server (reading finished, another admin saved): take them over for the fields that were
  // not edited here (adjust state during render, no effect)
  const [base, setBase] = useState({ code: serverCode, time: serverTime });
  if (base.code !== serverCode || base.time !== serverTime) {
    setBase({ code: serverCode, time: serverTime });
    if (code === base.code) setCode(serverCode);
    if (`${hours}:${minutes}` === base.time || (!hours && !minutes && !base.time)) {
      setHours(serverTime.slice(0, 2));
      setMinutes(serverTime.slice(3));
    }
  }

  const createdAt = new Date(report.createdAt);
  const time = parseTime(hours, minutes);
  const resolved = time ? resolveHuntTime(time.h, time.m, createdAt) : null;
  const newCode = normalizeHuntCode(code);
  const codeChanged = newCode !== serverCode;
  const timeChanged = (hours || minutes ? `${pad(Number(hours))}:${pad(Number(minutes))}` : '') !== serverTime;
  const reading = isReading(report);

  async function save() {
    const next: Errors = {};
    if (codeChanged && !newCode) next.code = 'Vul de huntcode in';
    if (timeChanged && !time) next.time = 'Vul een geldige tijd in (00:00 – 23:59)';
    setErrors(next);
    if (next.code || next.time || (!codeChanged && !timeChanged)) return;
    setBusy('save');
    try {
      await updateReport(report._id, {
        huntCode: codeChanged ? newCode : undefined,
        huntTime: timeChanged && time ? resolveHuntTime(time.h, time.m, createdAt) : undefined,
      });
      setCode(newCode);
      toast.success('Hunt aangepast');
    } catch (error) {
      toast.error(errorMessage(error, 'Opslaan is mislukt'));
    } finally {
      setBusy(null);
    }
  }

  async function reread() {
    setBusy('read');
    try {
      await rereadReport(report._id);
      toast.success('Foto wordt opnieuw gelezen');
    } catch (error) {
      toast.error(errorMessage(error, 'Opnieuw lezen is mislukt'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-md border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <FieldGroup className="gap-3">
        <Field data-invalid={!!errors.code} className="gap-2">
          <FieldLabel htmlFor={`${id}-code`}>Huntcode</FieldLabel>
          <Input
            id={`${id}-code`}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="Code van de sticker"
            aria-invalid={!!errors.code}
            className="font-mono tracking-wider"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setErrors((current) => ({ ...current, code: undefined }));
            }}
            onBlur={() => setCode((current) => normalizeHuntCode(current))}
          />
          <FieldDescription>Hoofdletters tellen mee.</FieldDescription>
          <FieldError>{errors.code}</FieldError>
        </Field>
        <TimeFields
          id={id}
          hours={hours}
          minutes={minutes}
          onHours={(value) => {
            setHours(value);
            setErrors((current) => ({ ...current, time: undefined }));
          }}
          onMinutes={(value) => {
            setMinutes(value);
            setErrors((current) => ({ ...current, time: undefined }));
          }}
          resolved={resolved}
          error={errors.time}
        />
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy !== null || (!codeChanged && !timeChanged)}>
          {busy === 'save' && <Loader2Icon className="animate-spin" />}
          Opslaan
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy !== null || reading} onClick={() => void reread()}>
          {busy === 'read' ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon data-icon="inline-start" />}
          Opnieuw lezen
        </Button>
      </div>
    </form>
  );
}
