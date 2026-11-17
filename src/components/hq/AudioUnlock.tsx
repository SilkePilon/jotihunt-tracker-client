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
 * After a reload the click from before still counts for the wall (wake lock, cursor), but this browser blocks sound
 * again: a small corner tile instead of the full overlay, so the wall stays readable. Pops in and out.
 */
export function AudioUnlockTile({ onUnlock }: { onUnlock: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onUnlock}
      className={cn(
        MAP_TILE,
        'absolute right-4 top-4 z-20 flex items-center gap-2 rounded-2xl py-2 pl-3 pr-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
      )}
      {...POP}
    >
      <VolumeXIcon className="size-5 text-primary-text" aria-hidden />
      {/* The visible text is the button's name (no aria-label that says something else) */}
      <span className="font-semibold">Geluid aanzetten</span>
    </motion.button>
  );
}
