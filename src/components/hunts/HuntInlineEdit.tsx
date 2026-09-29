import { useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { CheckIcon, Loader2Icon, PencilIcon, RefreshCwIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { isReading, normalizeHuntCode, resolveHuntTime } from '@/lib/hunt-reports';
import type { HuntReport } from '@/types/HuntReport';

const pad = (value: number) => String(value).padStart(2, '0');


/** The server's (Dutch) error message when there is one. */
function errorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError<{ message?: string; errors?: { msg: string }[] }>(error)) return fallback;
  return error.response?.data?.message ?? error.response?.data?.errors?.[0]?.msg ?? fallback;
}

/** Small outline icon button with a tooltip, same size as the copy buttons. */
export function IconAction({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon-xs" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SaveCancel({ saving, onSave, onCancel }: { saving: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <>
      <IconAction label="Opslaan" onClick={onSave} disabled={saving}>
        {saving ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
      </IconAction>
      <IconAction label="Annuleren" onClick={onCancel} disabled={saving}>
        <XIcon />
      </IconAction>
    </>
  );
}

/** Pencil button that turns the code into a (case-sensitive) input with save / cancel. Admins only. */
export function EditCode({ report, editing, onEditingChange }: { report: HuntReport; editing: boolean; onEditingChange: (editing: boolean) => void }) {
  const { updateReport } = useHuntReports();
  const [value, setValue] = useState(report.huntCode ?? '');
  const [saving, setSaving] = useState(false);

  function start() {
    setValue(report.huntCode ?? '');
    onEditingChange(true);
  }

  async function save() {
    const huntCode = normalizeHuntCode(value);
    if (!huntCode) {
      toast.error('Vul een code in');
      return;
    }
    if (huntCode === report.huntCode) {
      onEditingChange(false);
      return;
    }
    setSaving(true);
    try {
      await updateReport(report._id, { huntCode });
      toast.success('Code opgeslagen');
      onEditingChange(false);
    } catch (error) {
      toast.error('Opslaan is mislukt', { description: errorMessage(error, 'Probeer het opnieuw.') });
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <IconAction label="Code aanpassen" onClick={start}>
        <PencilIcon />
      </IconAction>
    );
  }
  return (
    <>
      <Input
        autoFocus
        data-inline-edit
        aria-label="Huntcode"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        className="h-7 w-32 font-mono"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save();
          if (event.key === 'Escape') onEditingChange(false);
        }}
      />
      <SaveCancel saving={saving} onSave={() => void save()} onCancel={() => onEditingChange(false)} />
    </>
  );
}

/** Pencil button that turns the time into HH : MM inputs with save / cancel. Admins only. */
export function EditTime({ report, editing, onEditingChange }: { report: HuntReport; editing: boolean; onEditingChange: (editing: boolean) => void }) {
  const { updateReport } = useHuntReports();
  const minutesRef = useRef<HTMLInputElement>(null);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const digits = (text: string) => text.replace(/\D/g, '').slice(0, 2);

  function start() {
    if (report.huntTimeKnown) {
      const date = new Date(report.huntTime);
      setHours(pad(date.getHours()));
      setMinutes(pad(date.getMinutes()));
    } else {
      setHours('');
      setMinutes('');
    }
    onEditingChange(true);
  }

  async function save() {
    const h = Number(hours);
    const m = Number(minutes);
    if (!/^\d{1,2}$/.test(hours) || !/^\d{1,2}$/.test(minutes) || h > 23 || m > 59) {
      toast.error('Vul een geldige tijd in (00:00 – 23:59)');
      return;
    }
    setSaving(true);
    try {
      // The time on the sticker is the most recent HH:MM before the upload (the hunt runs through the night)
      await updateReport(report._id, { huntTime: resolveHuntTime(h, m, new Date(report.createdAt)) });
      toast.success('Tijd opgeslagen');
      onEditingChange(false);
    } catch (error) {
      toast.error('Opslaan is mislukt', { description: errorMessage(error, 'Probeer het opnieuw.') });
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') void save();
    if (event.key === 'Escape') onEditingChange(false);
  }

  if (!editing) {
    return (
      <IconAction label="Tijd aanpassen" onClick={start}>
        <PencilIcon />
      </IconAction>
    );
  }
  return (
    <>
      <Input
        autoFocus
        data-inline-edit
        inputMode="numeric"
        maxLength={2}
        placeholder="UU"
        aria-label="Uren"
        className="h-7 w-11 px-1 text-center font-mono"
        value={hours}
        onChange={(event) => {
          const value = digits(event.target.value);
          setHours(value);
          if (value.length === 2) minutesRef.current?.focus();
        }}
        onKeyDown={onKeyDown}
      />
      <span className="font-semibold">:</span>
      <Input
        ref={minutesRef}
        data-inline-edit
        inputMode="numeric"
        maxLength={2}
        placeholder="MM"
        aria-label="Minuten"
        className="h-7 w-11 px-1 text-center font-mono"
        value={minutes}
        onChange={(event) => setMinutes(digits(event.target.value))}
        onKeyDown={onKeyDown}
      />
      <SaveCancel saving={saving} onSave={() => void save()} onCancel={() => onEditingChange(false)} />
    </>
  );
}

/** Refresh button: the AI reads the photo again (code and time, also values entered by hand). Admins only. */
export function RereadButton({ report }: { report: HuntReport }) {
  const { rereadReport } = useHuntReports();
  const [busy, setBusy] = useState(false);
  const reading = isReading(report);

  async function reread() {
    setBusy(true);
    try {
      await rereadReport(report._id);
      toast('De foto wordt opnieuw gelezen');
    } catch (error) {
      toast.error('Opnieuw lezen is mislukt', { description: errorMessage(error, 'Probeer het opnieuw.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <IconAction label={reading ? 'Wordt gelezen…' : 'Opnieuw laten lezen door AI'} onClick={() => void reread()} disabled={busy || reading}>
      <RefreshCwIcon className={reading || busy ? 'animate-spin' : undefined} />
    </IconAction>
  );
}
