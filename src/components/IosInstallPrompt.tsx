import { useState } from 'react';
import PWAPrompt from 'react-ios-pwa-prompt';
import { iosInstallDue, readIosInstallEnv } from '@/lib/pwa-install';
import usePromptQueueStore, { usePromptTurn } from '@/stores/prompt-queue.store';

/**
 * The iOS "Installeer als app" sheet, on its turn in the prompt queue (after the tour and the other follow-up prompts,
 * a gap apart). Mounted once it's due so the library counts a visit only when it really shows; it stays mounted after
 * closing so its slide-out finishes (closed, it sits off-screen without catching taps).
 */
export default function IosInstallPrompt() {
  // Read once per page load: the library bumps its visit count as soon as it mounts
  const [due] = useState(() => iosInstallDue(readIosInstallEnv()));
  const [closed, setClosed] = useState(false);
  const turn = usePromptTurn('pwa-install', due && !closed);
  const [shown, setShown] = useState(false);
  if (turn && !shown) setShown(true);
  if (!shown) return null;

  return (
    <PWAPrompt
      isShown
      // Mount closed, then slide in (0 would skip the animation)
      delay={50}
      onClose={() => {
        setClosed(true);
        usePromptQueueStore.getState().done('pwa-install');
      }}
      appIconPath="/icon_maskable.png"
      copyTitle="Installeer als app"
      copySubtitle="Jotihunt Tracker"
      copyDescription="Deze website kan als app geïnstalleerd worden. Volg de onderstaande instructies om deze app te installeren."
      copyShareStep='Druk op de "Deel" knop in de menubalk'
      copyAddToHomeScreenStep='Druk op "Zet op beginscherm"'
    />
  );
}
