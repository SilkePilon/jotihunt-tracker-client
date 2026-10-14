import { useEffect, useState } from 'react';
import { RefreshCwIcon, TimerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import CookieBadge from '@/components/tracker/CookieBadge';
import TrackerQrCode from '@/components/tracker/TrackerQrCode';
import { useQrLogin } from '@/hooks/qr-login.hook';
import type { SessionResult } from '@/lib/auth-api';
import { formatCountdown } from '@/lib/format';

const QR_SIZE = 176;

/** Right half of the login card: log this laptop in by scanning the code with a phone that is already logged in. */
export default function QrLoginPanel({ onApproved }: { onApproved: (result: SessionResult) => void }) {
  const { state, restart } = useQrLogin(onApproved);

  return (
    <div className="flex w-[290px] flex-col items-center justify-center gap-3 p-8 text-center" aria-live="polite">
      {state.phase === 'loading' && (
        <>
          <Skeleton className="rounded-lg" style={{ width: QR_SIZE, height: QR_SIZE }} />
          <h2 className="text-base font-semibold">Inloggen met QR-code</h2>
          <p className="text-xs text-balance text-muted-foreground">Scan met de camera van een telefoon waarop je al bent ingelogd.</p>
        </>
      )}
      {state.phase === 'waiting' && (
        <>
          <TrackerQrCode value={state.url} size={QR_SIZE} label="QR-code om in te loggen" />
          <h2 className="text-base font-semibold">Inloggen met QR-code</h2>
          <p className="text-xs text-balance text-muted-foreground">Scan met de camera van een telefoon waarop je al bent ingelogd.</p>
          <Countdown until={state.expiresAt} />
        </>
      )}
      {state.phase === 'scanned' && (
        <>
          <div className="relative" style={{ width: QR_SIZE, height: QR_SIZE }}>
            <div className="absolute inset-0 opacity-30 blur-sm" aria-hidden>
              <TrackerQrCode value={state.url} size={QR_SIZE} label="" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-20 items-center justify-center rounded-full bg-sky-500/80 text-2xl font-bold text-white ring-4 ring-card">{state.name.charAt(0).toUpperCase()}</span>
            </div>
          </div>
          <h2 className="text-base font-semibold">Bevestig op je telefoon</h2>
          <p className="text-xs text-muted-foreground">Gescand door {state.name}</p>
          <button type="button" onClick={restart} className="text-xs font-medium underline decoration-muted-foreground/50 underline-offset-2">
            Niet jij? Opnieuw
          </button>
        </>
      )}
      {state.phase === 'done' && (
        <>
          <CookieBadge tone="ok" size={72} />
          <h2 className="mt-2 text-base font-bold">Ingelogd</h2>
          <p className="text-xs text-muted-foreground">Welkom, {state.name}</p>
        </>
      )}
      {(state.phase === 'expired' || state.phase === 'error') && (
        <>
          <div className="flex items-center justify-center rounded-lg border border-dashed" style={{ width: QR_SIZE, height: QR_SIZE }}>
            <RefreshCwIcon className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">{state.phase === 'expired' ? 'Code verlopen' : 'Kan geen code maken'}</h2>
          <p className="text-xs text-balance text-muted-foreground">
            {state.phase === 'expired' ? 'Maak een nieuwe code om met je telefoon in te loggen.' : 'Kan de server niet bereiken, controleer je verbinding.'}
          </p>
          <Button variant="outline" size="sm" onClick={restart}>
            Nieuwe code
          </Button>
        </>
      )}
    </div>
  );
}

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
      <TimerIcon className="size-3.5" />
      Nieuwe code over {formatCountdown(until - now)}
    </span>
  );
}
