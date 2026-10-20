import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useEdition } from '@/hooks/edition.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { editionMeta, type EditionView } from '@/lib/editions';
import { POP, SWAP } from '@/lib/motion';
import { BeheerCard, BeheerRow, BeheerRows } from './BeheerLayout';
import { Pill } from './controls/Pill';

type Pending = { kind: 'show'; edition: EditionView } | { kind: 'create' };

/** Beheer → Algemeen: which Jotihunt everyone sees (archives read-only) and starting the next one (design A1). */
export default function EditionsCard() {
  const { state, showEdition, createEdition } = useEdition();
  // The question stays set while the dialog closes, so its text doesn't change during the exit animation
  const [pending, setPending] = useState<Pending>({ kind: 'create' });
  const [open, setOpen] = useState(false);
  const liveYear = state?.liveYear;

  function ask(next: Pending) {
    setPending(next);
    setOpen(true);
  }

  async function confirm() {
    try {
      if (pending.kind === 'show') await showEdition(pending.edition.year);
      else await createEdition();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Wisselen van editie is mislukt.'));
      setOpen(false);
      return;
    }
    window.location.reload();
    // Stay busy until the page is gone
    await new Promise(() => {});
  }

  const dialog =
    pending.kind === 'show'
      ? pending.edition.live
        ? { title: `Terug naar Jotihunt ${pending.edition.year}?`, description: 'Iedereen ziet weer de live editie.', confirmLabel: 'Terug naar live' }
        : { title: `Archief ${pending.edition.year} tonen?`, description: `Iedereen ziet nu archief ${pending.edition.year}. Alleen-lezen.`, confirmLabel: 'Tonen' }
      : liveYear !== undefined
        ? { title: `Jotihunt ${liveYear + 1} starten?`, description: `${liveYear} wordt archief. ${liveYear + 1} begint leeg; eigen nachtgebieden gaan mee. Herlaad daarna de teams.`, confirmLabel: 'Starten' }
        : // The button is disabled until the editions load; never show "undefined" meanwhile
          { title: 'Nieuwe editie starten?', description: 'De live editie wordt archief. De nieuwe begint leeg; eigen nachtgebieden gaan mee. Herlaad daarna de teams.', confirmLabel: 'Starten' };

  return (
    <BeheerCard title="Jotihunt-editie" description="Iedereen ziet de gekozen editie. Archief is alleen-lezen.">
      <AnimatePresence mode="wait" initial={false}>
        {!state ? (
          <motion.div key="loading" {...SWAP}>
            <Skeleton className="h-[52px] w-full rounded-2xl bg-beheer-row" />
          </motion.div>
        ) : (
          <motion.div key="rows" {...SWAP}>
            <BeheerRows>
              {state.editions.map((edition) => (
                <BeheerRow
                  key={edition.year}
                  tone={edition.shown ? 'shown' : 'default'}
                  leading={<span className="shrink-0 text-xl leading-7 font-extrabold tracking-tight tabular-nums">{edition.year}</span>}
                  // The meta sits beside the year as the only line (no empty title line above it)
                  title={<span className="truncate text-xs font-normal text-muted-foreground transition-colors duration-200">{editionMeta(edition)}</span>}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {edition.shown ? (
                      // Same height as the pill, so the rows don't change height when the shown edition swaps
                      <motion.span key="shown" className="inline-flex h-8 items-center gap-1 px-1 text-xs font-bold" {...POP}>
                        <CheckIcon className="size-3.5" strokeWidth={3} /> Getoond
                      </motion.span>
                    ) : (
                      <motion.span key="view" className="inline-grid" {...POP}>
                        <Pill onClick={() => ask({ kind: 'show', edition })}>Bekijken</Pill>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </BeheerRow>
              ))}
            </BeheerRows>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-3 flex">
        <Pill variant="primary" disabled={!state} onClick={() => ask({ kind: 'create' })}>
          <PlusIcon /> Nieuwe editie
        </Pill>
      </div>
      <ConfirmDialog open={open} onOpenChange={setOpen} title={dialog.title} description={dialog.description} confirmLabel={dialog.confirmLabel} onConfirm={confirm} />
    </BeheerCard>
  );
}
