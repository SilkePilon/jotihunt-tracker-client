import { AnimatePresence, motion } from 'motion/react';
import { QrCodeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useNow } from '@/hooks/now.hook';
import { formatCountdown } from '@/lib/format';
import { SUBMIT_WINDOW_MS } from '@/lib/hunt-reports';
import { fadeUp, POP, SWAP } from '@/lib/motion';
import { capitalizeFirstLetter, cn } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';

const RING = 132;
const STROKE = 8;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Last minutes: the ring and time turn red */
const URGENT_MS = 5 * 60_000;

/** The QR code in a soft orange circle, with a scan line moving over it. */
function QrIllustration() {
  return (
    <motion.div className="relative grid size-[72px] place-items-center overflow-hidden rounded-full bg-primary-container text-on-primary-container" {...POP}>
      <QrCodeIcon className="size-9" strokeWidth={1.8} />
      <motion.span
        aria-hidden
        className="absolute inset-x-4 h-0.5 rounded-full bg-on-primary-container/70 motion-reduce:hidden"
        initial={{ top: '28%' }}
        animate={{ top: ['28%', '70%', '28%'] }}
        transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
      />
    </motion.div>
  );
}

/** Ring that empties over the 15 minutes, with mm:ss left inside; "Te laat!" once the deadline passed. */
function CountdownRing({ deadline }: { deadline: string }) {
  const now = useNow(true);
  const left = Math.max(0, new Date(deadline).getTime() - now);
  const fraction = Math.min(1, left / SUBMIT_WINDOW_MS);
  const late = left === 0;
  const urgent = !late && left < URGENT_MS;

  return (
    <div className="relative grid place-items-center" style={{ width: RING, height: RING }}>
      <svg width={RING} height={RING} className="-rotate-90" aria-hidden>
        <circle cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-beheer-row-high" />
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          className={cn('transition-[stroke-dashoffset,stroke] duration-1000 ease-linear', urgent ? 'stroke-red-500' : 'stroke-primary')}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" role="timer" aria-live="off">
        <AnimatePresence mode="wait" initial={false}>
          {late ? (
            <motion.span key="late" className="text-lg font-bold text-red-700 dark:text-red-300" {...SWAP}>
              Te laat!
            </motion.span>
          ) : (
            <motion.span key="left" className="flex flex-col items-center" {...SWAP}>
              <span className={cn('text-3xl font-bold tabular-nums tracking-tight transition-colors', urgent && 'text-red-700 dark:text-red-300')}>{formatCountdown(left)}</span>
              <span className="text-xs font-medium text-muted-foreground">om te bevestigen</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** After "Melden" without a photo: scan the fox's QR code and confirm on jotihunt.nl before the deadline. */
export default function QrConfirmStep({ report, onClose }: { report: HuntReport; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <QrIllustration />
      <div className="flex flex-col gap-1.5">
        <DialogTitle className="text-lg font-bold tracking-tight">Scan nu de QR-code</DialogTitle>
        <DialogDescription className="leading-relaxed">Scan de QR-code bij de vos en bevestig op jotihunt.nl. Je locatie is nodig.</DialogDescription>
      </div>
      <motion.div {...fadeUp(0.15)}>
        <CountdownRing deadline={report.deadline} />
      </motion.div>
      <motion.p className="text-xs text-muted-foreground" {...fadeUp(0.25)}>
        Hunt op {capitalizeFirstLetter(report.area)} gemeld. Bevestigd zie je vanzelf in de lijst.
      </motion.p>
      <Button className="h-10 w-full rounded-xl font-semibold" onClick={onClose}>
        Sluiten
      </Button>
    </div>
  );
}
