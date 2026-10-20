import { FormEvent, useId, useState } from 'react';
import { Loader2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TrackerQrCode from '@/components/tracker/TrackerQrCode';
import { useEdition } from '@/hooks/edition.hook';
import { useNow } from '@/hooks/now.hook';
import { secondsLeft } from '@/lib/app-pairing';
import { formatCountdown } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TelegramAdminStatus } from '@/types/Telegram';
import TelegramLogo from './TelegramLogo';
import InlineError from '@/components/InlineError';

/** Telegram's brand blue. */
const TELEGRAM_BUTTON = 'bg-[#229ED9] text-white hover:bg-[#229ED9]/90';

export interface TelegramLinkActions {
  /** Start a QR login */
  onLink: () => Promise<unknown>;
  /** Cancel a pending login */
  onCancel: () => Promise<unknown>;
  /** Send the 2FA password; resolves to an error text, or null when accepted */
  onSubmitPassword: (password: string) => Promise<string | null>;
}

function Header({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold">{title}</span>
      <Button variant="ghost" size="icon" className="size-6 text-muted-foreground" aria-label="Koppelen annuleren" onClick={onCancel}>
        <XIcon />
      </Button>
    </div>
  );
}

function QrStep({ url, expiresAt, onCancel }: { url?: string; expiresAt?: string; onCancel: () => void }) {
  const now = useNow(true);
  if (!url) {
    // The server is still asking Telegram for the first token
    return (
      <div className="flex flex-col gap-2" data-telegram-state="qr">
        <Header title="Scan in Telegram" onCancel={onCancel} />
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin text-[#229ED9]" />
          QR-code laden…
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-telegram-state="qr">
      <Header title="Scan in Telegram" onCancel={onCancel} />
      <div className="flex items-start gap-3">
        <TrackerQrCode value={url} size={96} label="QR-code om Telegram te koppelen" />
        <div className="flex flex-col gap-1.5 text-xs leading-normal text-muted-foreground">
          <span>
            Instellingen → Apparaten →<br />
            <b className="text-foreground">Desktop-apparaat koppelen</b>
          </span>
          {expiresAt && (
            <span className="flex items-center gap-1.5 tabular-nums">
              <Loader2Icon className="size-3.5 animate-spin text-[#229ED9]" />
              {formatCountdown(secondsLeft(expiresAt, now) * 1000)}
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">De server kan alle chats van dit account lezen, maar gebruikt alleen berichten van @Jotihunt_bot.</p>
    </div>
  );
}

function PasswordStep({ hint, onSubmit, onCancel }: { hint?: string; onSubmit: TelegramLinkActions['onSubmitPassword']; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(await onSubmit(password));
    setBusy(false);
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={submit} data-telegram-state="password">
      <Header title="Cloud-wachtwoord van Telegram" onCancel={onCancel} />
      <Input
        type="password"
        autoComplete="current-password"
        aria-label="Cloud-wachtwoord van Telegram"
        placeholder={hint}
        value={password}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error && (
        <InlineError id={errorId}>
          {error}
        </InlineError>
      )}
      <Button type="submit" className={TELEGRAM_BUTTON} disabled={!password || busy}>
        {busy && <Loader2Icon className="animate-spin" />}
        Koppelen
      </Button>
    </form>
  );
}

/** Admins: link the group's Telegram account (L1, inside the "Jotihunt-berichten" card). Nothing once linked. */
export default function TelegramLinkPanel({ status, onLink, onCancel, onSubmitPassword }: { status: TelegramAdminStatus } & TelegramLinkActions) {
  const [starting, setStarting] = useState(false);
  // Linking is refused while an archive edition is shown (423)
  const { readOnly } = useEdition();

  async function start() {
    setStarting(true);
    try {
      await onLink();
    } finally {
      setStarting(false);
    }
  }

  const cancel = () => void onCancel();

  switch (status.state) {
    case 'unavailable':
      return <p className="text-xs text-muted-foreground">Telegram is niet ingesteld op de server (TELEGRAM_API_ID/HASH).</p>;
    case 'qr':
      return <QrStep url={status.url} expiresAt={status.expiresAt} onCancel={cancel} />;
    case 'password':
      return <PasswordStep hint={status.hint} onSubmit={onSubmitPassword} onCancel={cancel} />;
    case 'unlinked':
      return (
        <div className="flex flex-col gap-2.5" data-telegram-state="unlinked">
          <p className="text-xs text-muted-foreground">Koppel het Telegram-account dat de berichten van @Jotihunt_bot krijgt. Tegenhunts worden dan automatisch gemeld.</p>
          <Button size="lg" className={cn('h-11 w-full rounded-lg text-sm font-semibold', TELEGRAM_BUTTON)} disabled={starting || readOnly} onClick={() => void start()}>
            {starting ? <Loader2Icon className="animate-spin" /> : <TelegramLogo className="size-[18px]" />}
            Koppel Telegram
          </Button>
        </div>
      );
    default:
      return null;
  }
}
