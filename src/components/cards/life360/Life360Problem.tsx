import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import CookieBadge from '@/components/tracker/CookieBadge';
import { Button } from '@/components/ui/button';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Life360ProblemStatus } from '@/types/Life360';
import Life360Logo from './Life360Logo';
import { LIFE360_BUTTON } from './styles';

interface Life360ProblemProps {
  status: Life360ProblemStatus;
  /** Resolves to an error text, or null when the code was sent */
  onSendCode: (email: string) => Promise<string | null>;
}

/** Linked before, not readable now: logged out (mockup expired A) or paused by Life360's rate limit. */
export default function Life360Problem({ status, onSendCode }: Life360ProblemProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    setError(await onSendCode(status.email));
    setBusy(false);
  }

  if (status.state === 'paused') {
    return (
      <div className="flex flex-col items-center gap-0.5 pt-1 pb-0.5 text-center" data-life360-state="paused">
        <CookieBadge tone="warn" size={72} />
        <p className="mt-2 text-base font-bold">Even geduld</p>
        <p className="text-xs text-muted-foreground">
          Life360 vraagt ons te wachten. Volgende poging om <b className="font-semibold text-foreground">{formatClock(status.retryAt)}</b>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5 pt-1 pb-0.5 text-center" data-life360-state="loggedOut">
      <CookieBadge tone="warn" size={72} />
      <p className="mt-2 text-base font-bold">Uitgelogd</p>
      <p className="text-xs text-muted-foreground">Life360 heeft de sessie beëindigd. Laatste posities blijven grijs op de kaart.</p>
      <Button size="lg" className={cn('mt-2.5 h-11 w-full rounded-lg text-sm font-semibold', LIFE360_BUTTON)} disabled={busy} onClick={() => void sendCode()}>
        {busy ? <Loader2Icon className="animate-spin" /> : <Life360Logo className="size-5" />}
        Stuur nieuwe code
      </Button>
      <p className="mt-1.5 max-w-full truncate text-[11px] text-muted-foreground">
        naar <b className="font-semibold text-foreground">{status.email}</b>
      </p>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
