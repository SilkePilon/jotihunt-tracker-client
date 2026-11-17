import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import MaterialGlyph from '@/components/MaterialGlyph';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useHappyHour } from '@/hooks/happy-hour.hook';
import { useNow } from '@/hooks/now.hook';
import { LAYOUT_SPRING, SWAP_TRANSITION, swapPreset } from '@/lib/motion';
import { usePublishTopHeight } from '@/stores/top-stack.store';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { cn } from '@/lib/utils';
import { happyHourExplanation, happyHourPill, happyHourPillText, happyHourWindow, type HappyHourWindow } from '@/lib/happy-hour';

/**
 * Amber pill (shadow-md over the map, like the offline badge): "Happy hour · 2× punten · nog 34 min"; tap for the explanation and the bot's message. The amber is
 * happy hour's own colour (also its toast and notification tile), deliberately not a fox status token.
 */
function HappyHourPillView({ hour, now, measureRef }: { hour: HappyHourWindow; now: number; measureRef: (node: HTMLElement | null) => void }) {
  const { title, countdown } = happyHourPill(hour, now);
  // Reduced motion: no blur (and MotionConfig skips the slide), so the swap is a plain fade
  const swap = swapPreset(useReducedMotion() ?? false);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          ref={measureRef}
          type="button"
          aria-label={happyHourPillText(hour, now)}
          // Fades in and out with the happy hour (AnimatePresence below); eases to its new width when the label swaps
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ default: SWAP_TRANSITION, layout: LAYOUT_SPRING }}
          layout
          // Set as a style so motion corrects the corners while the width animates
          style={{ borderRadius: 9999 }}
          className={cn(COARSE_HIT_AREA, "pointer-events-auto flex cursor-pointer items-center gap-2 bg-happy-hour py-1.5 pr-3.5 pl-2.5 text-[13px] font-bold whitespace-nowrap text-on-happy-hour shadow-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring")}
          data-happy-hour={hour.state}
        >
          <motion.span layout="position" className="grid place-items-center">
            <MaterialGlyph name="celebration" size={18} />
          </motion.span>
          {/* Upcoming → active: the old label swaps out for the new one */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={hour.state} layout="position" className="flex items-center gap-2" {...swap}>
              {title}
              <span className="font-medium tabular-nums opacity-80">{countdown}</span>
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </PopoverTrigger>
      <PopoverContent aria-label="Happy hour" align="center" className="flex w-72 flex-col gap-2 text-sm">
        <p>{happyHourExplanation(hour)}</p>
        {hour.text && <blockquote className="rounded-xl bg-beheer-row p-2 text-xs whitespace-pre-line break-words text-muted-foreground">{hour.text}</blockquote>}
      </PopoverContent>
    </Popover>
  );
}

/** The happy-hour pill from the server's /happy-hour; nothing when there is none. Fades in and out. */
export default function HappyHourPill() {
  const { view } = useHappyHour();
  // Ticks while there is a happy hour; a new or changed one renders with the current time right away
  const now = useNow(!!view && view.state !== 'none');
  const hour = happyHourWindow(view, now);
  // The drawing toolbar and phone toasts make room below the pill while it is shown (lib/top-stack.ts)
  const measureRef = usePublishTopHeight('pill', !!hour);
  return <AnimatePresence>{hour && <HappyHourPillView key="pill" hour={hour} now={now} measureRef={measureRef} />}</AnimatePresence>;
}
