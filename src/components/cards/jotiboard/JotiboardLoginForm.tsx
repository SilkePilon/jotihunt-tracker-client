import { FormEvent, useId, useRef, useState } from 'react';
import { XIcon } from 'lucide-react';
import BusyIcon from '@/components/motion/BusyIcon';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { JOTIBOARD_BUTTON } from './styles';
import InlineError from '@/components/InlineError';

interface JotiboardLoginFormProps {
  /** Logged out: only the password, the username is fixed */
  fixedUsername?: string;
  submitLabel: string;
  onSubmit: (username: string, password: string) => Promise<string | null>;
  /** Shows the "Inloggen bij Jotiboard" header with ✕ */
  onCancel?: () => void;
  /** Leave out the "password is not stored" note (logged out: mockup link-flow) */
  hideNote?: boolean;
}

/** Username + password (link-flow A). The password only travels to our server, which keeps the refresh token only. */
export default function JotiboardLoginForm({ fixedUsername, submitLabel, onSubmit, onCancel, hideNote }: JotiboardLoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // Enter pressed twice before the re-render: one login per tap
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const user = fixedUsername ?? username;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user.trim() || !password || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    let message: string | null;
    try {
      message = await onSubmit(user.trim(), password);
    } catch {
      message = 'Koppelen is mislukt, probeer het opnieuw.';
    } finally {
      pending.current = false;
      setBusy(false);
    }
    setError(message);
    if (!message) setPassword('');
  }

  return (
    <form className="flex w-full flex-col gap-2 text-left" onSubmit={(event) => void submit(event)}>
      {onCancel && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Inloggen bij Jotiboard</span>
          <Button type="button" variant="ghost" size="icon" className="relative size-6 text-muted-foreground after:absolute after:-inset-2.5" aria-label="Koppelen annuleren" onClick={onCancel} disabled={busy}>
            <XIcon />
          </Button>
        </div>
      )}
      {fixedUsername === undefined && (
        <Input autoFocus autoComplete="username" placeholder="Gebruikersnaam" aria-label="Gebruikersnaam" readOnly={busy} value={username} onChange={(event) => setUsername(event.target.value)} />
      )}
      <Input
        type="password"
        autoComplete="current-password"
        placeholder="Wachtwoord"
        aria-label="Wachtwoord"
        autoFocus={fixedUsername !== undefined}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        readOnly={busy}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Reveal gap={8}>
        {error && (
          <InlineError id={errorId}>
            {error}
          </InlineError>
        )}
      </Reveal>
      <Button type="submit" className={cn('h-9 w-full', JOTIBOARD_BUTTON)} disabled={!user.trim() || !password} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
        <BusyIcon busy={busy} />
        {submitLabel}
      </Button>
      {!hideNote && <p className="text-xs leading-snug text-muted-foreground desk:text-[11px]">Het wachtwoord wordt niet bewaard, alleen een versleutelde sessie.</p>}
    </form>
  );
}
