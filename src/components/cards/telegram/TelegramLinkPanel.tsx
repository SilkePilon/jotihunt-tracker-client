import { FormEvent, useId, useState } from 'react';
import { Loader2Icon, XIcon } from 'lucide-react';
import BusyIcon from '@/components/motion/BusyIcon';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TrackerQrCode from '@/components/tracker/TrackerQrCode';
import { useEdition } from '@/hooks/edition.hook';
import { useNow } from '@/hooks/now.hook';
import { usePending } from '@/hooks/pending.hook';
import { secondsLeft } from '@/lib/app-pairing';
import { formatCountdown } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TelegramAdminStatus } from '@/types/Telegram';
import TelegramLogo from './TelegramLogo';
import InlineError from '@/components/InlineError';

/** Telegram's blue as a button: TELEGRAM_FILL (#229ED9 darkened to 4.66:1 with white) and a darker hover. Literal values: Tailwind needs static class names. */
const TELEGRAM_BUTTON = 'bg-[#1b7caa] text-white hover:bg-[#19729d]';

export interface TelegramLinkActions {
  /** Start a QR login */
  onLink: () => Promise<unknown>;
  /** Cancel a pending login */
  onCancel: () => Promise<unknown>;
  /** Send the 2FA password; resolves to an error text, or null when accepted */
  onSubmitPassword: (password: string) => Promise<string | null>;
}

function Header({ title, onCancel, disabled, cancelling }: { title: string; onCancel: () => void; disabled?: boolean; cancelling?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold">{title}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative size-6 text-muted-foreground after:absolute after:-inset-2.5"
        aria-label="Koppelen annuleren"
        // The running ✕ keeps the focus (aria-disabled); a second tap is refused by usePending
        aria-disabled={cancelling || undefined}
        aria-busy={cancelling || undefined}
        disabled={disabled && !cancelling}
        onClick={onCancel}
      >
        <BusyIcon busy={!!cancelling} icon={<XIcon />} />
      </Button>
    </div>
  );
}

function QrStep({ url, expiresAt, onCancel }: { url?: string; expiresAt?: string; onCancel: () => Promise<unknown> }) {
  const now = useNow(true);
  const { pending, run } = usePending<'cancel'>();
  const header = <Header title="Scan in Telegram" onCancel={() => void run('cancel', onCancel)} cancelling={pending === 'cancel'} />;
  if (!url) {
    // The server is still asking Telegram for the first token
    return (
      <div className="flex flex-col gap-2" data-telegram-state="qr">
        {header}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin text-[#229ED9]" />
          QR-code laden…
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-telegram-state="qr">
      {header}
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

function PasswordStep({ hint, onSubmit, onCancel }: { hint?: string; onSubmit: TelegramLinkActions['onSubmitPassword']; onCancel: () => Promise<unknown> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Sending the password and ✕ change the same login: one at a time
  const { pending, run } = usePending<'submit' | 'cancel'>();
  const errorId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) return;
    const message = await run('submit', async () => {
      try {
        return await onSubmit(password);
      } catch {
        return 'Er ging iets mis, probeer het opnieuw.';
      }
    });
    if (message !== undefined) setError(message);
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={submit} data-telegram-state="password">
      <Header title="Cloud-wachtwoord van Telegram" onCancel={() => void run('cancel', onCancel)} disabled={!!pending} cancelling={pending === 'cancel'} />
      <Input
        type="password"
        autoComplete="current-password"
        aria-label="Cloud-wachtwoord van Telegram"
        placeholder={hint}
        readOnly={!!pending}
        value={password}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Reveal gap={8}>{error && <InlineError id={errorId}>{error}</InlineError>}</Reveal>
      <Button
        type="submit"
        className={TELEGRAM_BUTTON}
        // The running button stays focusable (aria-disabled); usePending refuses a second submit
        disabled={!password || (!!pending && pending !== 'submit')}
        aria-disabled={pending === 'submit' || undefined}
        aria-busy={pending === 'submit' || undefined}
      >
        <BusyIcon busy={pending === 'submit'} />
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
    if (starting) return;
    setStarting(true);
    try {
      await onLink();
    } finally {
      setStarting(false);
    }
  }

  const cancel = () => onCancel();

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
            <BusyIcon busy={starting} icon={<TelegramLogo className="size-[18px]" />} />
            Koppel Telegram
          </Button>
        </div>
      );
    default:
      return null;
  }
}
