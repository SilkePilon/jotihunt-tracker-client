import { AnimatePresence, motion } from 'motion/react';
import { ClockIcon } from 'lucide-react';
import { useNextHint } from '@/hooks/next-hint.hook';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { IntelTab } from '@/types/Intel';

const TABS: { value: IntelTab; label: string }[] = [
  { value: 'all', label: 'Alles' },
  { value: 'hint', label: 'Hints' },
  { value: 'assignment', label: 'Opdrachten' },
  { value: 'news', label: 'Nieuws' },
];

/** "Intel", the tabs (a dot on Nieuws / Opdrachten while one of those is unread) and the countdown to the next hint. Leaves room right for the dialog's close button. */
export default function IntelTopBar({ unread }: { unread: Partial<Record<IntelTab, boolean>> }) {
  const tab = useIntelStore((state) => state.tab);
  const setTab = useIntelStore((state) => state.setTab);
  const next = useNextHint();
  return (
    <div className="flex items-center gap-4 py-4 pr-14 pl-6">
      <h2 className="text-[17px] font-bold">Intel</h2>
      <div role="tablist" aria-label="Soort" className="flex gap-0.5 rounded-xl bg-beheer-row p-[3px]">
        {TABS.map((option) => {
          const active = option.value === tab;
          return (
            <button
              key={option.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(option.value)}
              className={cn('relative flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {active && <motion.span layoutId="intel-tab" className="absolute inset-0 rounded-[9px] bg-beheer-row-high" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{option.label}</span>
              <AnimatePresence>{unread[option.value] && <motion.span key="dot" {...POP} className="relative size-[7px] rounded-full bg-primary" aria-label="ongelezen" />}</AnimatePresence>
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold tabular-nums', next.isUrgent || next.isNewHint ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300')}>
        <ClockIcon className="size-3.5" />
        {next.isCountdown ? `Volgende hint over ${next.label}` : next.label}
      </span>
    </div>
  );
}
