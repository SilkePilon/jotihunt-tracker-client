import { motion } from 'motion/react';
import { Volume2Icon } from 'lucide-react';

/** Browsers block sound until the first click; the HQ screen asks for one. Fades away once clicked. */
export default function AudioUnlock({ onUnlock }: { onUnlock: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onUnlock}
      // Focused on load: Enter or Space turns the sound on too (and a screen reader starts here)
      autoFocus
      className="group fixed inset-0 z-50 flex items-center justify-center bg-black/60 outline-none backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <span className="card flex flex-col items-center gap-3 rounded-2xl bg-card px-8 py-6 text-card-foreground shadow-2xl group-focus-visible:ring-[3px] group-focus-visible:ring-ring">
        <Volume2Icon className="size-12 text-primary" aria-hidden />
        <span className="text-2xl font-semibold">Klik om geluid aan te zetten</span>
        <span className="text-muted-foreground">Browsers spelen pas geluid af na één klik</span>
      </span>
    </motion.button>
  );
}
