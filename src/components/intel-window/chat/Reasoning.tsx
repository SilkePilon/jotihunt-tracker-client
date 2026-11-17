import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronRightIcon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { revealTransition, SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import ChatMarkdown from './ChatMarkdown';

interface ReasoningProps {
  /** All thinking of the turn (steps joined by a blank line) */
  text: string;
  /** The turn's thinking phase (`thinkingPhase`): open with a shimmering "Nadenken…"; afterwards it folds to "Nagedacht" */
  thinking: boolean;
}

/**
 * The model's thinking above the answer: open for the whole thinking phase (across tool steps), folded to a
 * "Nagedacht · 8 s ›" toggle once the answer starts or the stream stops, and it stays folded for the rest of the turn
 * (history: folded, no duration). The duration runs from the first thought this client saw until the fold.
 */
export default function Reasoning({ text, thinking }: ReasoningProps) {
  const [userOpen, setUserOpen] = useState(false);
  const [thoughtMs, setThoughtMs] = useState<number | null>(null);
  // Once folded by the answer it never opens by itself again in this turn
  const folded = thoughtMs !== null;
  const autoOpen = thinking && !folded;
  useEffect(() => {
    if (!autoOpen) return;
    const start = performance.now();
    return () => setThoughtMs(performance.now() - start);
  }, [autoOpen]);
  const open = autoOpen || userOpen;
  // The open thoughts sit in a capped box that follows the newest line while they stream
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (autoOpen && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [autoOpen, text]);
  const seconds = thoughtMs === null ? null : Math.max(1, Math.round(thoughtMs / 1000));
  const label = autoOpen ? 'Nadenken…' : seconds ? `Nagedacht · ${seconds} s` : 'Nagedacht';
  return (
    // isolate: the toggle's 44px touch area on phones (COARSE_HIT_AREA) stays above the message's background
    <div className="isolate flex flex-col items-start">
      <button
        type="button"
        aria-expanded={open}
        disabled={autoOpen}
        onClick={() => setUserOpen(!userOpen)}
        className={cn(
          COARSE_HIT_AREA,
          'inline-flex items-center gap-1 rounded-md py-0.5 pr-1 text-[12.5px] font-semibold text-muted-foreground outline-none transition-colors enabled:hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring',
        )}
      >
        {/* The button's name; the animated labels are hidden (old and new would both be read during the swap) */}
        <span className="sr-only">{label}</span>
        <span className="relative" aria-hidden>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label}
              className={cn('inline-block', autoOpen && 'ai-shimmer')}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SWAP_TRANSITION}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
        <motion.span aria-hidden className="grid" animate={{ rotate: open ? 90 : 0 }} transition={SWAP_TRANSITION}>
          <ChevronRightIcon className="size-3.5" />
        </motion.span>
      </button>
      {/* Outside the button (a status inside one isn't announced) */}
      <span role="status" className="sr-only">
        {autoOpen ? label : ''}
      </span>
      <div className="w-full">
        <Reveal>
          {open && (
            <div className="pt-1">
              <Grow>
                <div ref={box} className="max-h-40 overflow-y-auto border-l-2 border-beheer-row-high pr-1 pl-3 [scrollbar-gutter:stable]">
                  <ChatMarkdown text={text} className="text-xs leading-[1.5] text-muted-foreground" />
                </div>
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
  // Reduced motion: the height follows at once (no sliding), as in revealTransition
  const reduced = useReducedMotion() ?? false;
  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className="overflow-hidden" initial={false} animate={{ height }} transition={revealTransition(reduced, 'enter')}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}
