import { useEffect, useRef, useState } from 'react';
import PWAPrompt from 'react-ios-pwa-prompt';
import { iosInstallDue, iosInstallExitMs, readIosInstallEnv } from '@/lib/pwa-install';
import usePromptQueueStore, { usePromptTurn } from '@/stores/prompt-queue.store';
import { useBackEntry } from '@/hooks/back-entry.hook';
import './IosInstallPrompt.css';

/** The library mounts the sheet closed and slides it in after this delay (0 would skip the animation) */
const OPEN_DELAY_MS = 50;

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The iOS "Installeer als app" sheet, on its turn in the prompt queue (after the tour and the other follow-up prompts,
 * a gap apart). Mounted once it's due so the library counts a visit only when it really shows; after closing it stays
 * until its slide-out has finished, then renders nothing.
 * The library's markup gets what it lacks for a modal sheet: Dutch labels, aria-modal, focus moved in (and back after),
 * Escape and the phone's Back close it. Its look follows the app theme (IosInstallPrompt.css).
 */
export default function IosInstallPrompt() {
  // Read once per page load: the library bumps its visit count as soon as it mounts
  const [due] = useState(() => iosInstallDue(readIosInstallEnv()));
  const [closed, setClosed] = useState(false);
  const turn = usePromptTurn('pwa-install', due && !closed);
  const [shown, setShown] = useState(false);
  if (turn && !shown) setShown(true);
  const [gone, setGone] = useState(false);
  const open = shown && !closed;
  const rootRef = useRef<HTMLDivElement>(null);
  // What had focus before the sheet: it gets focus back once the sheet closes
  const returnFocus = useRef<HTMLElement | null>(null);

  /** Close the way the library's own button does (its close handler isn't exposed) */
  const close = () => rootRef.current?.querySelector<HTMLButtonElement>('.iOSPWA-closeButton')?.click();
  useBackEntry('pwa-install', open, close);

  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = root.querySelector<HTMLElement>('.iOSPWA-panel');
    const closeButton = root.querySelector<HTMLButtonElement>('.iOSPWA-closeButton');
    closeButton?.setAttribute('type', 'button');
    closeButton?.setAttribute('aria-label', 'Sluiten');
    root.querySelector('.iOSPWA-overlay')?.setAttribute('aria-label', 'Installatie-uitleg sluiten');
    // The panel names its title and description by id, but the library never sets those ids
    const title = root.querySelector('.iOSPWA-header span');
    const description = root.querySelector('.iOSPWA-description');
    if (title && panel?.getAttribute('aria-labelledby')) title.id = panel.getAttribute('aria-labelledby')!;
    if (description && panel?.getAttribute('aria-describedby')) description.id = panel.getAttribute('aria-describedby')!;
    panel?.setAttribute('aria-modal', 'true');
    panel?.setAttribute('tabindex', '-1');
    // The library blurs the focused element when it slides in: focus the sheet right after that
    const focusTimer = setTimeout(() => panel?.focus({ preventScroll: true }), OPEN_DELAY_MS + 10);
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === 'Tab') {
        // Modal: the close button is the sheet's only control, Tab stays on it
        event.preventDefault();
        closeButton?.focus();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // Closed: render nothing once the slide-out has finished
  useEffect(() => {
    if (!closed) return;
    const timer = setTimeout(() => setGone(true), iosInstallExitMs(reducedMotion()));
    return () => clearTimeout(timer);
  }, [closed]);

  if (!shown || gone) return null;

  return (
    <div ref={rootRef} className="ios-install-prompt">
      <PWAPrompt
        isShown
        delay={OPEN_DELAY_MS}
        onClose={() => {
          setClosed(true);
          usePromptQueueStore.getState().done('pwa-install');
          const target = returnFocus.current;
          if (target?.isConnected) target.focus({ preventScroll: true });
        }}
        appIconPath="/icon_maskable.png"
        copyTitle="Installeer als app"
        copySubtitle="Jotihunt Tracker"
        copyDescription="Deze website kan als app geïnstalleerd worden. Volg de onderstaande instructies om deze app te installeren."
        copyShareStep='Druk op de "Deel" knop in de menubalk'
        copyAddToHomeScreenStep='Druk op "Zet op beginscherm"'
      />
    </div>
  );
}
