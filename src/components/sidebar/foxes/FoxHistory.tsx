import { Fragment, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EyeIcon, EyeOffIcon, RotateCwIcon } from 'lucide-react';
import AutoHeight from '@/components/motion/AutoHeight';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreaHistory } from '@/hooks/area-history.hook';
import { useNow } from '@/hooks/now.hook';
import { historyModel, historyStatusLine } from '@/lib/fox-history';
import type { SidebarFox } from '@/lib/fox-status';
import { EASE_OUT, SWAP } from '@/lib/motion';
import { cn, getColorFromArea } from '@/lib/utils';
import FoxHistoryTimeline from './FoxHistoryTimeline';

/** The window plays in once the panel's open spring has (mostly) settled. */
const PLAY_DELAY_MS = 300;
const MINUTE_MS = 60_000;

interface FoxHistoryProps {
  fox: SidebarFox;
  hidden: boolean;
  onToggleHidden: () => void;
}

/** "Verberg op kaart" / "Toon op kaart": both labels share one grid cell, so the button keeps its width and only fades. */
function HideButton({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  const options = [
    { on: !hidden, icon: EyeOffIcon, label: 'Verberg op kaart' },
    { on: hidden, icon: EyeIcon, label: 'Toon op kaart' },
  ];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hidden ? 'Toon op kaart' : 'Verberg op kaart'}
      className="inline-grid h-7 cursor-pointer rounded-[10px] bg-secondary px-2.5 text-xs font-semibold text-secondary-foreground transition-colors duration-150 outline-none hover:bg-[color-mix(in_oklab,var(--foreground)_12%,var(--card))] focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {options.map(({ on, icon: Icon, label }) => (
        <span
          key={label}
          aria-hidden
          className={cn(
            'col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 transition-[opacity,filter] duration-200 motion-reduce:transition-none',
            on ? 'opacity-100 blur-0' : 'opacity-0 blur-[2px]',
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </span>
      ))}
    </button>
  );
}

/** Four empty lanes + the axis while the history loads. */
function TimelineSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-[20px_minmax(0,1fr)] pt-1 pb-5">
      {Array.from({ length: 4 }, (_, index) => (
        <Fragment key={index}>
          <div className="flex h-[22px] items-center">
            <Skeleton className="size-3 rounded-[4px]" />
          </div>
          <div className="flex h-[22px] items-center px-1">
            <Skeleton className="h-3 rounded-[4px]" style={{ width: `${[92, 64, 38, 74][index]}%` }} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * The fold-out under a fox's chip: name, status line, the last three hours as a timeline and the hide-on-map button.
 * Fetches only while mounted; the window moves on every minute.
 */
export default function FoxHistory({ fox, hidden, onToggleHidden }: FoxHistoryProps) {
  const reduced = useReducedMotion() ?? false;
  const { history, error, mutate } = useAreaHistory(fox.area.name);
  const now = useNow(true, MINUTE_MS);
  const model = useMemo(() => (history ? historyModel(history, now) : undefined), [history, now]);
  const line = useMemo(() => (history ? historyStatusLine(history, now) : undefined), [history, now]);

  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setOpened(true), PLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // A retry shows the skeleton again (SWR keeps the old error until the new answer is in)
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    setRetrying(true);
    void mutate()
      .catch(() => undefined)
      .finally(() => setRetrying(false));
  };

  const scene = model ? 'ready' : error && !retrying ? 'error' : 'loading';
  const swap = reduced ? { ...SWAP, transition: { duration: 0 } } : SWAP;

  return (
    <div className="mt-2 rounded-2xl bg-card p-2.5 text-foreground">
      <div className="mx-0.5 flex items-baseline justify-between text-[12.5px] font-medium">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(fox.area.name) }} />
          <span className="truncate">{fox.name}</span>
        </span>
        <span className="shrink-0 text-[11px] font-normal text-muted-foreground">laatste 3 uur</span>
      </div>

      {/* Status line: the word shimmers and swaps (fade + blur-up) when the status changes */}
      <div className="mx-0.5 mt-0.5 flex min-h-4 flex-wrap items-center text-xs text-muted-foreground tabular-nums">
        {line ? (
          <>
            <span className="relative inline-flex">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={line.status ?? 'none'}
                  className="fox-history-shimmer whitespace-nowrap"
                  initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={reduced ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
                >
                  {line.word}
                </motion.span>
              </AnimatePresence>
            </span>
            {line.rest.split(' · ').map((part) => (
              <Fragment key={part}>
                <span className="px-1 opacity-50">·</span>
                {part}
              </Fragment>
            ))}
          </>
        ) : (
          scene === 'loading' && <Skeleton className="h-2.5 w-36" />
        )}
      </div>

      <AutoHeight scene={scene} className="mt-1">
        <AnimatePresence mode="wait" initial={false}>
          {model ? (
            <motion.div key="ready" {...swap}>
              <FoxHistoryTimeline model={model} playKey={fox.key} play={opened || reduced} />
            </motion.div>
          ) : scene === 'error' ? (
            <motion.div key="error" {...swap}>
              <button
                type="button"
                onClick={retry}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl py-6 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                Historie niet geladen
                <RotateCwIcon aria-hidden className="size-3" />
              </button>
            </motion.div>
          ) : (
            <motion.div key="loading" {...swap}>
              <TimelineSkeleton />
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>

      <div className="mt-2 flex justify-end">
        <HideButton hidden={hidden} onClick={onToggleHidden} />
      </div>
    </div>
  );
}
