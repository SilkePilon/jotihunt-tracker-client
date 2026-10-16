import { Loader2Icon, RefreshCwIcon, SmartphoneIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/media.hook';
import { useNow } from '@/hooks/now.hook';
import { buildPairingUrl, formatPairingCode, secondsLeft } from '@/lib/app-pairing';
import { formatCountdown } from '@/lib/format';
import type { PairingCode } from '@/types/Tracker';
import TrackerQrCode from './TrackerQrCode';
import InlineError from '@/components/InlineError';

const apiBase = import.meta.env.API_BASE_URL;

interface TrackerPairingProps {
  pairing: PairingCode | null;
  creating: boolean;
  failed: boolean;
  /** Make a new code (after expiry or a failure) */
  onRetry: () => void;
  onClose: () => void;
}

function Countdown({ seconds }: { seconds: number }) {
  return (
    <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" />
      {formatCountdown(seconds * 1000)}
    </span>
  );
}

/** One-time pairing code for the Android app: a small QR next to the code (desktop), or an "open in app" button (phone). */
export default function TrackerPairing({ pairing, creating, failed, onRetry, onClose }: TrackerPairingProps) {
  const isMobile = useIsMobile();
  // Ticks only until the code expires (the still clock decides, see HuntListRow)
  const stillNow = useNow(false);
  const now = useNow(!!pairing && Date.parse(pairing.expiresAt) > stillNow);

  const left = pairing ? secondsLeft(pairing.expiresAt, now) : 0;
  const active = pairing && left > 0 && !creating ? pairing : null;
  const pairingUrl = active ? buildPairingUrl(apiBase, active.code, window.location.origin) : '';

  let body;
  if (active && isMobile) {
    body = (
      <>
        <Button asChild>
          <a href={pairingUrl}>
            <SmartphoneIcon />
            Open in de Jotihunt-app
          </a>
        </Button>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            of typ <span className="font-mono text-sm font-semibold tracking-wider whitespace-nowrap text-foreground">{formatPairingCode(active.code)}</span>
          </span>
          <Countdown seconds={left} />
        </div>
      </>
    );
  } else if (active) {
    body = (
      <div className="flex items-start gap-3">
        <TrackerQrCode value={pairingUrl} size={96} label="QR-code om de Jotihunt-app te koppelen" />
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-xs text-muted-foreground">of typ</span>
          <span className="font-mono text-lg font-bold tracking-wider whitespace-nowrap">{formatPairingCode(active.code)}</span>
          <Countdown seconds={left} />
        </div>
      </div>
    );
  } else if (creating && !pairing) {
    body = <Skeleton className={isMobile ? 'h-14 rounded-md' : 'h-24 rounded-md'} />;
  } else {
    body = (
      <Button variant="outline" disabled={creating} onClick={onRetry}>
        {creating ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
        {pairing ? 'Nieuwe code' : 'Opnieuw'}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-tracker-state="pairing">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{isMobile ? 'Koppel deze telefoon' : 'Scan met de Jotihunt-app'}</span>
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground" aria-label="Koppelen annuleren" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      {body}
      {failed && <InlineError>Code maken is mislukt, probeer het opnieuw.</InlineError>}
    </div>
  );
}
