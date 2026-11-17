import { Loader2Icon, RefreshCwIcon, SmartphoneIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/media.hook';
import { useNow } from '@/hooks/now.hook';
import { buildPairingUrl, formatPairingCode, secondsLeft } from '@/lib/app-pairing';
import { formatCountdown } from '@/lib/format';
import type { PairingCode } from '@/types/Tracker';
import { AnimatePresence, motion } from 'motion/react';
import { useAppRelease } from '@/hooks/app-pairing.hook';
import { absoluteUrl } from '@/lib/app-pairing';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useAppOpenCheck, usePairLaunch } from '@/components/android-promo/pair-launch';
import Reveal from '@/components/motion/Reveal';
import TrackerQrCode from './TrackerQrCode';
import InlineError from '@/components/InlineError';
import { inlineLinkClass } from './styles';

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
  // Phones: the jotihunt:// link goes nowhere without the app. Opened from the tap; still on this page 2.5 s later = no
  // app, so the APK download unfolds under the button
  const launch = usePairLaunch(async () => pairingUrl || null, () => true);
  useAppOpenCheck(launch.phase, launch.startedAt, launch.setPhase);
  const { release } = useAppRelease();
  const appMissing = isMobile && launch.phase === 'failed' && release;

  let body;
  let bodyKey: 'code' | 'loading' | 'retry';
  if (active && isMobile) {
    bodyKey = 'code';
    body = (
      <>
        <Button asChild size="lg">
          <a
            href={pairingUrl}
            onClick={(event) => {
              event.preventDefault();
              launch.start();
            }}
          >
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
        <Reveal gap={8}>
          {appMissing && (
            <p className="text-xs text-muted-foreground" role="status">
              App niet geopend?{' '}
              <a className={cn(inlineLinkClass, COARSE_HIT_AREA)} href={absoluteUrl(apiBase, appMissing.url, window.location.origin)} download>
                Download de app ({appMissing.versionName})
              </a>
            </p>
          )}
        </Reveal>
      </>
    );
  } else if (active) {
    bodyKey = 'code';
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
    bodyKey = 'loading';
    body = <Skeleton className={isMobile ? 'h-14 rounded-md' : 'h-24 rounded-md'} />;
  } else {
    bodyKey = 'retry';
    body = (
      <Button variant="outline" size="lg" disabled={creating} onClick={onRetry}>
        {creating ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
        {pairing ? 'Nieuwe code' : 'Opnieuw'}
      </Button>
    );
  }

  return (
    // isolate: the download link's 44px touch area stays above the card's background
    <div className="isolate flex flex-col gap-2" data-tracker-state="pairing">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{isMobile ? 'Koppel deze telefoon' : 'Scan met de Jotihunt-app'}</span>
        <Button variant="ghost" size="icon" className="relative size-6 text-muted-foreground after:absolute after:-inset-2.5" aria-label="Koppelen annuleren" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      {/* Skeleton, code and "Nieuwe code" cross-fade instead of popping */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={bodyKey} {...SWAP} className="flex flex-col gap-2">
          {body}
        </motion.div>
      </AnimatePresence>
      <Reveal gap={8}>{failed && <InlineError>Code maken is mislukt, probeer het opnieuw.</InlineError>}</Reveal>
    </div>
  );
}
