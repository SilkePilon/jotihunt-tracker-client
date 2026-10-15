// src/components/android-promo/PromoSteps.tsx
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LinkIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { cookiePath, BADGE_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { appDidNotOpen } from '@/lib/android-promo';
import { POP_SPRING, SWAP, SWAP_TRANSITION } from '@/lib/motion';
import type { PromoStep } from '@/stores/android-promo.store';
import type { PairPhase } from './pair-launch';
import { cn } from '@/lib/utils';

const CHECK = cookiePath(72, BADGE_COOKIE_DEPTH);
const STEP_INDEX: Partial<Record<PromoStep, number>> = { download: 0, install: 1, pair: 2 };

export function Stepper({ step }: { step: PromoStep }) {
  const index = STEP_INDEX[step] ?? -1;
  return (
    <div className="flex flex-1 gap-1.5">
      {[0, 1, 2].map((i) => (
        <i key={i} className={cn('h-1 flex-1 rounded-sm transition-colors duration-300', i <= index ? 'bg-primary' : 'bg-beheer-row-high')} />
      ))}
    </div>
  );
}

/** The way out of every step after the intro: the hero's round X, on the plain step background */
export function StepClose({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" aria-label="Sluiten" onClick={onClose} className="grid size-[34px] shrink-0 place-items-center rounded-full bg-beheer-row-high text-muted-foreground transition-colors hover:text-foreground">
      <XIcon className="size-5" />
    </button>
  );
}

export function DownloadingStep({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 1200);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="size-[22px] animate-spin rounded-full border-[3px] border-beheer-row-high border-t-primary" />
      <b>Downloaden…</b>
    </div>
  );
}

export function InstallStep({ onPair, onRedownload }: { onPair: () => void; onRedownload: () => void }) {
  return (
    <>
      <b className="block text-[17px]">Installeer de app</b>
      <p className="mb-3 mt-1 text-[13.5px] text-muted-foreground">
        Tik op de download-melding en dan op <b className="text-foreground">Installeren</b>.
      </p>
      <div className="flex gap-2.5 rounded-[14px] bg-[color-mix(in_oklab,#f59e0b_16%,var(--card))] px-3 py-2.5 text-[12.5px]">
        <TriangleAlertIcon className="size-5 shrink-0 text-amber-500" />
        <div>
          Vraagt Android om toestemming? Kies <b>Instellingen → Toestaan van deze bron</b> voor Chrome, en ga terug.
        </div>
      </div>
      <div className="mt-3.5 flex flex-col gap-2">
        <button type="button" onClick={onPair} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
          <LinkIcon className="size-5" /> Geïnstalleerd, koppel nu
        </button>
        <button type="button" onClick={onRedownload} className="h-10 rounded-xl text-[13.5px] font-semibold text-muted-foreground">
          Opnieuw downloaden
        </button>
      </div>
    </>
  );
}

/**
 * Shows a pairing attempt (see usePairLaunch in ./pair-launch) and waits for a new app device on the account. Still visible 2.5 s
 * after navigating = the app didn't open. Not the tracker's `connected`: another client (Traccar Client) may
 * already be connected, which would show "Gekoppeld!" straight away.
 */
export function PairStep({ phase, startedAt, onPhase, onRetry, deviceCount, refresh, onPaired, onBack }: {
  phase: PairPhase;
  /** When the deep link was opened; null while the code is being made */
  startedAt: number | null;
  onPhase: (phase: PairPhase) => void;
  /** A new attempt, from the retry tap */
  onRetry: () => void;
  /** App devices on the account; undefined while loading */
  deviceCount: number | undefined;
  /** Reload the account (device list) */
  refresh: () => void;
  onPaired: () => void;
  onBack: () => void;
}) {
  const baseline = useRef<number | undefined>(undefined);
  const paired = useEffectEvent(onPaired);
  const reload = useEffectEvent(refresh);
  const setPhase = useEffectEvent(onPhase);
  // Success = the account gained an app device since this step started
  useEffect(() => {
    if (deviceCount === undefined) return;
    if (baseline.current === undefined) baseline.current = deviceCount;
    else if (deviceCount > baseline.current) paired();
  }, [deviceCount]);
  // Poll the device list while on this step, and right away when the user comes back from the app
  useEffect(() => {
    const id = window.setInterval(() => reload(), 3000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  // Only once the deep link was opened: no app within 2.5 s = failed; back from the app = waiting for it
  useEffect(() => {
    if (phase !== 'opening' || startedAt === null) return;
    const id = window.setInterval(() => {
      if (appDidNotOpen(startedAt, Date.now(), document.visibilityState === 'visible')) setPhase('failed');
    }, 250);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setPhase('waiting');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, startedAt]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={phase} {...SWAP}>
        {phase === 'failed' || phase === 'error' ? (
          <div className="flex flex-col gap-2 py-2 text-center">
            <b>{phase === 'failed' ? 'App ging niet open?' : 'Kon geen koppelcode maken'}</b>
            <span className="text-[13px] text-muted-foreground">{phase === 'failed' ? 'Installeer hem eerst.' : 'Controleer je verbinding.'}</span>
            <div className="mt-2 flex gap-2">
              {phase === 'failed' && (
                <button type="button" onClick={onBack} className="h-11 flex-1 rounded-xl bg-beheer-row-high font-semibold">Terug</button>
              )}
              <button type="button" onClick={onRetry} className="h-11 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground">Opnieuw proberen</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="size-[22px] animate-spin rounded-full border-[3px] border-beheer-row-high border-t-primary" />
            <b>{phase === 'opening' ? 'App openen…' : 'Wachten op de app…'}</b>
            <span className="text-[12.5px] text-muted-foreground">De app opent vanzelf</span>
            {phase === 'waiting' && (
              <button type="button" onClick={onRetry} className="h-10 rounded-xl px-4 text-[13.5px] font-semibold text-muted-foreground">
                Opnieuw proberen
              </button>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Animates its height to follow the content (measured), so the dialog grows and shrinks smoothly between steps */
export function AutoHeight({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className="overflow-hidden" initial={false} animate={{ height }} transition={SWAP_TRANSITION}>
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}

export function DoneStep({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="flex flex-col items-center gap-1 pt-1.5 text-center">
        <motion.svg width="72" height="72" viewBox="0 0 72 72" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={POP_SPRING} aria-hidden>
          <path d={CHECK} fill="#22c55e" />
          <path d="M22.3 36.7L31.7 46.1L49.7 27.4" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
        <b className="mt-2 text-lg">Gekoppeld!</b>
        <span className="text-[13px] text-muted-foreground">Je tracker staat nu in de app · live</span>
      </div>
      <button type="button" onClick={onClose} className="mt-3.5 h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">
        Klaar
      </button>
    </>
  );
}
