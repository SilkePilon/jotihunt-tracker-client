import { FormEvent, useId, useState } from 'react';
import { Loader2Icon, XIcon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { JOTIBOARD_BUTTON } from './styles';

interface JotiboardLoginFormProps {
  /** Logged out: only the password, the username is fixed */
  fixedUsername?: string;
  submitLabel: string;
  onSubmit: (username: string, password: string) => Promise<string | null>;
  /** Shows the "Inloggen bij Jotiboard" header with ✕ */
  onCancel?: () => void;
}

/** Username + password (link-flow A). The password only travels to our server, which keeps the refresh token only. */
export default function JotiboardLoginForm({ fixedUsername, submitLabel, onSubmit, onCancel }: JotiboardLoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const user = fixedUsername ?? username;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(user.trim(), password);
    setBusy(false);
    setError(message);
    if (!message) setPassword('');
  }

  return (
    <form className="flex w-full flex-col gap-2 text-left" onSubmit={(event) => void submit(event)}>
      {onCancel && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Inloggen bij Jotiboard</span>
          <Button type="button" variant="ghost" size="icon" className="size-6 text-muted-foreground" aria-label="Koppelen annuleren" onClick={onCancel}>
            <XIcon />
          </Button>
        </div>
      )}
      {fixedUsername === undefined && (
        <Input autoFocus autoComplete="username" placeholder="Gebruikersnaam" aria-label="Gebruikersnaam" value={username} onChange={(event) => setUsername(event.target.value)} />
      )}
      <Input
        type="password"
        autoComplete="current-password"
        placeholder="Wachtwoord"
        aria-label="Wachtwoord"
        autoFocus={fixedUsername !== undefined}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Reveal gap={8}>
        {error && (
          <p id={errorId} className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </Reveal>
      <Button type="submit" className={cn('h-9 w-full rounded-lg font-semibold', JOTIBOARD_BUTTON)} disabled={!user.trim() || !password || busy}>
        {busy && <Loader2Icon className="animate-spin" />}
        {submitLabel}
      </Button>
      <p className="text-[11px] leading-snug text-muted-foreground">Het wachtwoord wordt niet bewaard, alleen een versleutelde sessie.</p>
    </form>
  );
}
