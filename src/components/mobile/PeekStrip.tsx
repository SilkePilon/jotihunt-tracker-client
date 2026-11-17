import { useNow } from '@/hooks/now.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { trackerPeekLine } from '@/lib/tracker';
import { isIOSDevice } from '@/lib/android-promo';
import { cookiePath, BADGE_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { useSidebarFoxes } from '@/components/sidebar/foxes/useSidebarFoxes';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import FoxStatusBar, { GroupSwatch } from '@/components/sidebar/foxes/FoxStatusBar';
import { cooldownLegendChars, FOX_GROUP_LABEL, groupCounts, legendGroups, legendInitials, legendInitialsChars, soonestCooldown, type FoxGroup, type SidebarFox } from '@/lib/fox-status';
import { formatCountdown } from '@/lib/format';
import useMobileNavStore from '@/stores/mobile-nav.store';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { EyeOffIcon, TimerIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreas } from '@/hooks/areas.hook';
import { SWAP, SWAP_TRANSITION } from '@/lib/motion';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { tourTarget } from '@/components/tour/targets';

const COOKIE_16 = cookiePath(16, BADGE_COOKIE_DEPTH);
const TONE_FILL = { ok: 'var(--status-ok-dot)', warn: 'var(--status-warn-dot)', muted: 'var(--muted-foreground)' } as const;

/** Own tracker line; ticks every second for the age, on its own so the fox bar does not re-render with it. */
function TrackerLine({ onOpen }: { onOpen: () => void }) {
  const { status, isError, retry } = useTrackerStatus();
  const now = useNow(true);
  // A failed first load says so ("tik voor opnieuw"): the tap fetches again and opens the tracker page
  const line = trackerPeekLine(status, now, isError, isIOSDevice());
  const open = () => {
    if (!status && isError) void retry();
    onOpen();
  };
  return (
    <button type="button" onClick={open} className={cn('flex min-h-9 items-center gap-2 text-left text-[13.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset rounded-md', COARSE_HIT_AREA)}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        <path d={COOKIE_16} fill={TONE_FILL[line.tone]} />
      </svg>
      <span className={cn('truncate font-semibold tabular-nums', line.tone === 'warn' && 'text-status-warn-text')}>{line.text}</span>
    </button>
  );
}

/** Rough px per character of the 12px legend (a little wide, so a borderline fit falls back rather than overflowing) */
const LEGEND_CHAR_PX = 7;

/** Width of an element, kept up to date (0 until measured). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Legend under the peek's fox bar: which foxes are in which group ("A D actief  B onderweg") when that fits on one line,
 * with the countdown of the cooldown that ends first ("B 12:34") when that fits too; else the counts per group
 * ("2 actief"). A colour swatch before each ties it to the bar; without room for those either (narrow phones with an OV
 * group), plain counts.
 */
function PeekLegend({ foxes, counts, hidden }: { foxes: SidebarFox[]; counts: Record<FoxGroup, number>; hidden: number }) {
  const [ref, width] = useWidth<HTMLSpanElement>();
  const initials = legendInitials(foxes);
  const groups = legendGroups(counts);
  // "⊘ 2 verborgen" at the end while foxes are hidden on the map: icon, count, label and a gap
  const hiddenChars = hidden > 0 ? 1 + String(hidden).length + 1 + 'verborgen'.length + 3 : 0;
  const countChars = groups.reduce((sum, group) => sum + String(counts[group]).length + 1 + FOX_GROUP_LABEL[group].length + 3, 0) + hiddenChars;
  // The same countdown as the fox chips (FoxChip), ticking with the sidebar's per-second clock while a cooldown runs
  const cooldown = soonestCooldown(foxes);
  const countdown = cooldown ? formatCountdown(cooldown.ms) : '';
  const initialsChars = legendInitialsChars(initials) + hiddenChars;
  // Room is judged at the widest countdown of its kind, so a ticking (or 1:00:00 → 59:59) value never flips the layout
  const timeChars = cooldown ? cooldownLegendChars(countdown.replace(/\d/g, '0')) : 0;
  const mode = width === 0 ? 'counts' : initialsChars * LEGEND_CHAR_PX <= width ? 'initials' : countChars * LEGEND_CHAR_PX <= width ? 'counts' : 'plain';
  // No room for it: the initials as before
  const showTime = mode === 'initials' && !!cooldown && (initialsChars + timeChars) * LEGEND_CHAR_PX <= width;
  return (
    <span ref={ref} className="relative block h-4 text-xs text-muted-foreground tabular-nums">
      <AnimatePresence initial={false}>
        {/* Cross-fades when the layout changes or the hidden entry comes or goes */}
        <motion.span key={`${mode}:${showTime}:${hidden > 0}`} {...SWAP} className={cn('absolute inset-0 flex items-center whitespace-nowrap', mode === 'initials' ? 'gap-3' : 'justify-between')}>
          {mode === 'initials'
            ? initials.map((item) => (
                <span key={item.group} className="inline-flex items-center gap-1">
                  <GroupSwatch group={item.group} />
                  <b className="font-semibold text-foreground">{item.initials.join(' ')}</b> {FOX_GROUP_LABEL[item.group].toLowerCase()}
                </span>
              ))
            : groups.map((group) => (
                <span key={group} className="inline-flex items-center gap-1">
                  {mode === 'counts' && <GroupSwatch group={group} />}
                  <b className="font-semibold text-foreground">{counts[group]}</b> {FOX_GROUP_LABEL[group].toLowerCase()}
                </span>
              ))}
          {/* The cooldown that ends first: its fox and the time left */}
          {showTime && cooldown && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <TimerIcon aria-hidden className="size-3" strokeWidth={2.75} />
              <b className="font-semibold text-foreground">{cooldown.initial}</b> <span className="sr-only">weer te hunten over</span> {countdown}
            </span>
          )}
          {/* Plain (no room): the eye and the count only, the word for screen readers */}
          {hidden > 0 && (
            <span className="inline-flex items-center gap-1">
              <EyeOffIcon aria-hidden className="size-3" strokeWidth={2.75} />
              <b className="font-semibold text-foreground">{hidden}</b> <span className={cn(mode === 'plain' && 'sr-only')}>verborgen</span>
            </span>
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * Always-visible top of the phone sheet: own tracker line + Vossen status bar with legend. The fox part always takes
 * the bar's height (h-8: 10px bar + 6px gap + 16px legend), loading or empty too, so the peek (and the map above it)
 * doesn't shift when the areas come in.
 */
export default function PeekStrip() {
  const foxes = useSidebarFoxes();
  const { isError, isHidden, retry } = useAreas();
  const { isForbidden } = useHuntableAreas();
  const push = useMobileNavStore((s) => s.push);
  const counts = foxes ? groupCounts(foxes) : undefined;
  const hidden = foxes ? foxes.filter((fox) => isHidden(fox.area.name)).length : 0;
  const scene = foxes && foxes.length > 0 ? 'bar' : foxes ? 'empty' : isError ? 'error' : 'loading';

  return (
    // isolate: the buttons' 44px touch areas (COARSE_HIT_AREA) stay above the sheet's background. Held sideways the
    // sheet is a column already clear of the notch: no safe-area padding inside it
    <div {...tourTarget('mobile.peek')} className="isolate flex flex-col gap-2 pr-[max(1rem,env(safe-area-inset-right))] pb-3 pl-[max(1rem,env(safe-area-inset-left))] landscape-phone:px-4">
      <TrackerLine onOpen={() => push({ id: 'tracking' })} />
      <div className="relative h-8">
        <AnimatePresence initial={false}>
          <motion.div key={scene} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SWAP_TRANSITION}>
            {scene === 'bar' && foxes && counts ? (
              <button type="button" onClick={() => push({ id: 'foxes' })} className={cn('flex w-full flex-col gap-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset rounded-md', COARSE_HIT_AREA)}>
                <FoxStatusBar foxes={foxes} size="full" isForbidden={isForbidden} />
                {/* The visible counts are part of the button's name; the sr-only prefix says what a tap does */}
                <span className="sr-only">Vossen openen: </span>
                <PeekLegend foxes={foxes} counts={counts} hidden={hidden} />
              </button>
            ) : scene === 'loading' ? (
              <div className="flex flex-col gap-1.5" role="status" aria-label="Vossen laden">
                {/* The sheet is beheer-window, which the default accent fill all but matches in the light theme */}
                <Skeleton className="h-2.5 w-full rounded-md bg-card" />
                <Skeleton className="h-4 w-full bg-card" />
              </div>
            ) : (
              // A failed load: the tap fetches the areas again (and opens Vossen, like the tracker line)
              <button type="button" onClick={() => { if (scene === 'error') void retry(); push({ id: 'foxes' }); }} className={cn('flex h-full w-full items-center text-left text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset rounded-md', COARSE_HIT_AREA)}>
                {scene === 'error' ? 'Vossen niet geladen — tik voor opnieuw' : 'Nog geen vossen'}
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
