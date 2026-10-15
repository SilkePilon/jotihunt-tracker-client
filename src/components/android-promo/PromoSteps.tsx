// src/components/android-promo/PromoSteps.tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { LinkIcon, TriangleAlertIcon } from 'lucide-react';
import { cookiePath, BADGE_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { appDidNotOpen } from '@/lib/android-promo';
import { POP_SPRING } from '@/lib/motion';
import type { PromoStep } from '@/stores/android-promo.store';
import { cn } from '@/lib/utils';

const CHECK = cookiePath(72, BADGE_COOKIE_DEPTH);
const STEP_INDEX: Partial<Record<PromoStep, number>> = { download: 0, install: 1, pair: 2 };

export function Stepper({ step }: { step: PromoStep }) {
  const index = STEP_INDEX[step] ?? -1;
  return (
    <div className="mb-3.5 flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <i key={i} className={cn('h-1 flex-1 rounded-sm transition-colors duration-300', i <= index ? 'bg-primary' : 'bg-beheer-row-high')} />
      ))}
    </div>
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
 * Opens the app via the pairing deep link (`openApp` creates the code and navigates), then waits for the tracker
 * to connect. Still visible after 2.5 s = the app didn't open.
 */
export function PairStep({ openApp, connected, onConnected, onBack }: { openApp: () => Promise<boolean>; connected: boolean; onConnected: () => void; onBack: () => void }) {
  const [phase, setPhase] = useState<'opening' | 'waiting' | 'failed'>('opening');
  const startedAt = useRef(0);
  // Phase starts at 'opening', so the first launch needs no setState (which the effect may not do synchronously)
  const launch = () => {
    startedAt.current = Date.now();
    void openApp().then((opened) => {
      if (!opened) setPhase('failed');
    });
  };
  const attempt = () => {
    setPhase('opening');
    launch();
  };
  useEffect(() => {
    launch();
    // Once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (connected) onConnected();
  }, [connected, onConnected]);
  useEffect(() => {
    if (phase !== 'opening') return;
    const id = window.setInterval(() => {
      if (appDidNotOpen(startedAt.current, Date.now(), document.visibilityState === 'visible')) setPhase('failed');
    }, 250);
    const onVisible = () => document.visibilityState === 'visible' && setPhase('waiting');
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase]);

  if (phase === 'failed') {
    return (
      <div className="flex flex-col gap-2 py-2 text-center">
        <b>App ging niet open?</b>
        <span className="text-[13px] text-muted-foreground">Installeer hem eerst.</span>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onBack} className="h-11 flex-1 rounded-xl bg-beheer-row-high font-semibold">Terug</button>
          <button type="button" onClick={attempt} className="h-11 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground">Opnieuw proberen</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <span className="size-[22px] animate-spin rounded-full border-[3px] border-beheer-row-high border-t-primary" />
      <b>{phase === 'opening' ? 'App openen…' : 'Wachten op de app…'}</b>
      <span className="text-[12.5px] text-muted-foreground">De app opent vanzelf</span>
      {phase === 'waiting' && (
        <button type="button" onClick={attempt} className="h-10 rounded-xl px-4 text-[13.5px] font-semibold text-muted-foreground">
          Opnieuw proberen
        </button>
      )}
    </div>
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
