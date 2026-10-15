import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRightIcon, Trash2Icon, UnlinkIcon } from 'lucide-react';
import HoldButton from '@/components/auth/HoldButton';
import AutoHeight from '@/components/motion/AutoHeight';
import { inlineLinkClass } from '@/components/tracker/styles';
import { purgeText } from '@/lib/jotiboard';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { JotiboardCounts } from '@/types/Jotiboard';
import { JOTIBOARD_BLOCK } from './styles';

type Step = 'list' | 'unlink' | 'purge';

interface JotiboardActionsProps {
  counts: JotiboardCounts;
  /** Show the "Ontkoppelen" row (there is a link) */
  canUnlink: boolean;
  /** Show the "Data verwijderen" row (there is imported data) */
  canPurge: boolean;
  onUnlink: () => Promise<boolean>;
  onPurge: () => Promise<boolean>;
  /** Close the block (after a done action) */
  onDone: () => void;
}

function Row({ icon, title, subtitle, danger, onClick }: { icon: ReactNode; title: string; subtitle: string; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 border-t border-border px-0.5 py-2.5 text-left first:border-t-0 [&_svg]:size-4 [&_svg]:shrink-0">
      <span className={cn(danger && 'text-destructive')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13px] font-medium', danger && 'text-destructive')}>{title}</span>
        <span className="block text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRightIcon className="text-muted-foreground" />
    </button>
  );
}

/** The ⋯ block (mockup B3): a list of actions; each swaps to a hold-to-confirm step inside the same grey block. */
export default function JotiboardActions({ counts, canUnlink, canPurge, onUnlink, onPurge, onDone }: JotiboardActionsProps) {
  const [step, setStep] = useState<Step>('list');
  const [busy, setBusy] = useState(false);

  async function confirm(action: () => Promise<boolean>) {
    setBusy(true);
    const done = await action();
    setBusy(false);
    if (done) {
      setStep('list');
      onDone();
    }
  }

  return (
    <AutoHeight scene={step} className={cn('w-full', JOTIBOARD_BLOCK)} innerClassName="px-2.5">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} {...SWAP}>
          {step === 'list' && (
            <div className="flex flex-col">
              {canUnlink && <Row icon={<UnlinkIcon />} title="Ontkoppelen" subtitle="Geïmporteerde data blijft staan" onClick={() => setStep('unlink')} />}
              {canPurge && <Row icon={<Trash2Icon />} title="Data verwijderen" subtitle={`${purgeText(counts)} · eigen data blijft`} danger onClick={() => setStep('purge')} />}
            </div>
          )}
          {step !== 'list' && (
            <div className="flex flex-col py-2.5 text-left">
              <p className="text-sm font-bold">{step === 'purge' ? 'Data verwijderen?' : 'Jotiboard ontkoppelen?'}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {step === 'purge'
                  ? `${purgeText(counts)} van Jotiboard. Onze eigen markers en oplossingen blijven staan. Automatisch synchroniseren gaat uit.`
                  : 'De server vergeet de Jotiboard-sessie. Wat al geïmporteerd is blijft staan.'}
              </p>
              <HoldButton
                durationMs={1500}
                busy={busy}
                busyLabel={step === 'purge' ? 'Verwijderen…' : 'Ontkoppelen…'}
                className={cn('mt-2.5 h-10 rounded-lg text-[13px]', step === 'purge' ? 'bg-destructive text-white' : 'bg-foreground text-background')}
                onConfirm={() => void confirm(step === 'purge' ? onPurge : onUnlink)}
              >
                {step === 'purge' ? <Trash2Icon /> : <UnlinkIcon />}
                Ingedrukt houden…
              </HoldButton>
              <button type="button" className={cn(inlineLinkClass, 'mt-1.5 self-center text-[11px]')} disabled={busy} onClick={() => setStep('list')}>
                annuleren
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AutoHeight>
  );
}
