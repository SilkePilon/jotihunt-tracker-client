import { useId } from 'react';
import { motion } from 'motion/react';
import { Volume2Icon, VolumeXIcon } from 'lucide-react';
import { MAP_TILE } from '@/lib/map-chrome';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Browsers block sound until the first click; the HQ screen asks for one. Fades away once clicked. */
export default function AudioUnlock({ onUnlock }: { onUnlock: () => void }) {
  const hintId = useId();
  return (
    <motion.button
      type="button"
      onClick={onUnlock}
      // Focused on load: Enter or Space turns the sound on too (and a screen reader starts here)
      autoFocus
      // A short name; the browser explanation is its description
      aria-label="Klik om geluid aan te zetten"
      aria-describedby={hintId}
      className="group fixed inset-0 z-50 flex items-center justify-center bg-black/60 outline-none backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* No legacy .card class: its unlayered box-shadow hid both the shadow and the keyboard focus ring */}
      <span className="flex flex-col items-center gap-3 rounded-2xl bg-card px-8 py-6 text-card-foreground shadow-(--shadow-dialog) group-focus-visible:ring-[3px] group-focus-visible:ring-ring">
        <Volume2Icon className="size-12 text-primary-text" aria-hidden />
        <span className="text-2xl font-semibold">Klik om geluid aan te zetten</span>
        <span id={hintId} className="text-muted-foreground">Browsers spelen pas geluid af na één klik</span>
      </span>
    </motion.button>
  );
}

/**
 * After a reload (an automatic update, the edition reloader) the click from before still counts for the wall (wake
 * lock, cursor), but this browser blocks sound again: a banner at the top of the map column instead of the full
 * overlay, so the wall stays readable but nobody misses that sound is off. Below the tour chip / stale badge row, so it
 * covers neither. Sized in rem like the rest of the wall; pops in and out.
 */
export function AudioUnlockBanner({ onUnlock }: { onUnlock: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onUnlock}
      className={cn(
        MAP_TILE,
        'absolute left-1/2 top-20 z-20 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl py-2 pl-2 pr-5 text-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
      )}
      // Centred through motion's x: motion owns the transform (POP scales it)
      style={{ x: '-50%' }}
      {...POP}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-container text-on-primary-container">
        <VolumeXIcon className="size-6" aria-hidden />
      </span>
      {/* The visible text is the button's name (no aria-label that says something else) */}
      <span className="font-semibold">Geluid staat uit — klik om aan te zetten</span>
    </motion.button>
  );
}
