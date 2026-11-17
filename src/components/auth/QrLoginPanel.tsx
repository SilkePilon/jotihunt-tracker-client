import { useNow } from '@/hooks/now.hook';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RefreshCwIcon, TimerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AutoHeight from '@/components/motion/AutoHeight';
import SuccessBadge from '@/components/auth/SuccessBadge';
import CookieBadge from '@/components/tracker/CookieBadge';
import TrackerQrCode from '@/components/tracker/TrackerQrCode';
import { useQrLogin } from '@/hooks/qr-login.hook';
import type { SessionResult } from '@/lib/auth-api';
import { formatCountdown } from '@/lib/format';
import { fadeUp, POP, SWAP, SWAP_TRANSITION, swapPreset } from '@/lib/motion';
import { qrPanelAnnouncement, type QrPanelState } from '@/lib/qr-login';

const QR_SIZE = 176;

// Reduced motion leaves the blur out (MotionConfig "user" only skips the scale): a plain fade remains
const qrSharp = (reduced: boolean) => ({ opacity: 1, scale: 1, ...(reduced ? {} : { filter: 'blur(0px)' }) });
const qrFaded = (reduced: boolean) => ({ opacity: 0.3, scale: 0.96, ...(reduced ? {} : { filter: 'blur(4px)' }) });
const CROSS_FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.25 } };

/** loading, waiting and scanned are one scene: the QR box stays put while its contents and the text below change */
function sceneOf(state: QrPanelState) {
  if (state.phase === 'loading' || state.phase === 'waiting' || state.phase === 'scanned') return 'qr';
  return state.phase;
}

/** Right half of the login card: log this laptop in by scanning the code with a phone that is already logged in. */
export default function QrLoginPanel({ onApproved }: { onApproved: (result: SessionResult) => void }) {
  const { state, restart } = useQrLogin(onApproved);

  return (
    <div className="flex w-[290px] flex-col justify-center p-8 text-center">
      {/* Only the heading and status line are announced (not the whole panel, nor each countdown tick) */}
      <span role="status" className="sr-only">
        {qrPanelAnnouncement(state)}
      </span>
      <AutoHeight scene={sceneOf(state)} className="-m-2" innerClassName="p-2">
        <AnimatePresence mode="wait" initial={false}>
          {sceneOf(state) === 'qr' && <QrScene key="qr" state={state} restart={restart} />}
          {state.phase === 'done' && (
            <motion.div key="done" className="flex flex-col items-center gap-3" {...SWAP}>
              <SuccessBadge size={72} />
              <motion.h2 className="mt-2 text-base font-bold" {...fadeUp(0.2)}>
                Ingelogd
              </motion.h2>
              <motion.p className="text-xs text-muted-foreground" {...fadeUp(0.3)}>
                Welkom, {state.name}
              </motion.p>
            </motion.div>
          )}
          {(state.phase === 'expired' || state.phase === 'error') && (
            <motion.div key={state.phase} className="flex flex-col items-center gap-3" {...SWAP}>
              <div className="flex items-center justify-center rounded-lg border border-dashed" style={{ width: QR_SIZE, height: QR_SIZE }}>
                <RefreshCwIcon className="size-8 text-muted-foreground" />
              </div>
              <h2 className="text-base font-bold">{state.phase === 'expired' ? 'Code verlopen' : 'Kan geen code maken'}</h2>
              <p className="text-xs text-balance text-muted-foreground">
                {state.phase === 'expired' ? 'Maak een nieuwe code om met je telefoon in te loggen.' : 'Kan de server niet bereiken, controleer je verbinding.'}
              </p>
              <Button variant="outline" size="sm" onClick={restart}>
                Nieuwe code
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>
    </div>
  );
}

function QrScene({ state, restart }: { state: QrPanelState; restart: () => void }) {
  const scanned = state.phase === 'scanned';
  const url = state.phase === 'waiting' || state.phase === 'scanned' ? state.url : null;
  const reduced = useReducedMotion() ?? false;
  const swap = swapPreset(reduced);

  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={swap.initial}
      animate={swap.animate}
      // Approved: the code and the cookie shrink away before the check pops in
      exit={{ opacity: 0, scale: 0.92, ...(reduced ? {} : { filter: 'blur(4px)' }) }}
      transition={SWAP_TRANSITION}
    >
      <div className="relative" style={{ width: QR_SIZE, height: QR_SIZE }}>
        <motion.div className="absolute inset-0" initial={false} animate={scanned ? qrFaded(reduced) : qrSharp(reduced)} transition={SWAP_TRANSITION} aria-hidden={scanned || undefined}>
          {/* Skeleton → code and a renewed code cross-fade on top of each other, so the box never changes size */}
          <AnimatePresence initial={false}>
            <motion.div key={url ?? 'loading'} className="absolute inset-0" {...CROSS_FADE}>
              {url ? <TrackerQrCode value={url} size={QR_SIZE} label={scanned ? '' : 'QR-code om in te loggen'} /> : <Skeleton className="size-full rounded-lg" />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <AnimatePresence initial={false}>
          {state.phase === 'scanned' && (
            <motion.div key="pending" className="absolute inset-0 flex items-center justify-center" {...POP}>
              <CookieBadge tone="neutral" size={80} glyph="?" outline={4} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.h2 key={scanned ? 'confirm' : 'scan'} className="text-base font-bold" {...SWAP}>
          {scanned ? 'Bevestig op je telefoon' : 'Inloggen met QR-code'}
        </motion.h2>
      </AnimatePresence>
      {/* Fixed heights: the one-line "Gescand door …" and the two-line scan hint take the same room, so nothing shifts */}
      <div className="flex min-h-8 flex-col justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {state.phase === 'scanned' ? (
            <motion.p key="scanned" className="text-xs text-muted-foreground" {...SWAP}>
              Gescand door {state.name}
            </motion.p>
          ) : (
            <motion.p key="hint" className="text-xs text-balance text-muted-foreground" {...SWAP}>
              Scan met de camera van een telefoon waarop je al bent ingelogd.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="flex h-4 items-center">
        <AnimatePresence mode="wait" initial={false}>
          {state.phase === 'waiting' && (
            <motion.div key="countdown" {...SWAP}>
              <Countdown until={state.expiresAt} />
            </motion.div>
          )}
          {scanned && (
            <motion.button
              key="restart"
              type="button"
              onClick={restart}
              // The ::after grows the target to 24px tall without moving the line
              className="relative text-xs font-medium underline decoration-muted-foreground/50 underline-offset-2 after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']"
              {...SWAP}
            >
              Niet jij? Opnieuw
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Countdown({ until }: { until: number }) {
  const now = useNow(true);
  return (
    <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground" aria-hidden>
      <TimerIcon className="size-3.5" />
      Nieuwe code over {formatCountdown(until - now)}
    </span>
  );
}
