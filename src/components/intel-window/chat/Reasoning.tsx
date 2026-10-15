import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRightIcon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { REVEAL_TRANSITION, SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import ChatMarkdown from './ChatMarkdown';

interface ReasoningProps {
  /** All thinking of the turn (steps joined by a blank line) */
  text: string;
  /** The model is thinking right now: open with a shimmering "Nadenken…"; afterwards it folds to "Nagedacht" */
  thinking: boolean;
}

/**
 * The model's thinking above the answer: open while it streams, folded to a "Nagedacht · 8 s ›" toggle once the answer or a
 * tool takes over (history: folded, no duration). The duration is the time this client watched it think, summed over steps.
 */
export default function Reasoning({ text, thinking }: ReasoningProps) {
  const [userOpen, setUserOpen] = useState(false);
  const [thoughtMs, setThoughtMs] = useState<number | null>(null);
  useEffect(() => {
    if (!thinking) return;
    const start = performance.now();
    return () => setThoughtMs((total) => (total ?? 0) + performance.now() - start);
  }, [thinking]);
  const open = thinking || userOpen;
  const seconds = thoughtMs === null ? null : Math.max(1, Math.round(thoughtMs / 1000));
  const label = thinking ? 'Nadenken…' : seconds ? `Nagedacht · ${seconds} s` : 'Nagedacht';
  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        aria-expanded={open}
        disabled={thinking}
        onClick={() => setUserOpen(!userOpen)}
        className="inline-flex items-center gap-1 rounded-[10px] py-0.5 pr-1 text-[12.5px] font-semibold text-muted-foreground outline-none transition-colors enabled:hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="relative">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label}
              className={cn('inline-block', thinking && 'ai-shimmer')}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SWAP_TRANSITION}
              role={thinking ? 'status' : undefined}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
        <motion.span className="grid" animate={{ rotate: open ? 90 : 0 }} transition={SWAP_TRANSITION}>
          <ChevronRightIcon className="size-3.5" />
        </motion.span>
      </button>
      <div className="w-full">
        <Reveal>
          {open && (
            <div className="pt-1">
              <Grow>
                <ChatMarkdown text={text} className="border-l-2 border-beheer-row-high pl-3 text-[12px] leading-[1.5] text-muted-foreground" />
              </Grow>
            </div>
          )}
        </Reveal>
      </div>
    </div>
  );
}

/** Eases its height after the content as streamed thinking adds lines (instead of jumping a line at a time) */
function Grow({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className="overflow-hidden" initial={false} animate={{ height }} transition={REVEAL_TRANSITION}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}
