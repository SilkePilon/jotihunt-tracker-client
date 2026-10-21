import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { CheckIcon, CircleXIcon, CrosshairIcon, EyeIcon, FlagIcon, LightbulbIcon, type LucideIcon } from 'lucide-react';
import { axisTicks, HISTORY_WINDOW_MIN, LANES, type HistoryBlock, type HistoryModel, type LaneKey } from '@/lib/fox-history';
import { EASE_OUT } from '@/lib/motion';
import { cn } from '@/lib/utils';

const PAD = 4; // px left and right of the plot, so the first/last dot isn't cut off
const ROW = 22;
const BLOCK = 12;
const TOP = 4; // plot padding above the first row
const AXIS = 20;
const CARD_W = 200;
const CORNER = 5; // branch line corner radius
const PLAY_MS = 1600;
const SYNC_MS = 50;
const RETURN_DOT_DELAY = 0.26;
const LEAVE_MS = 90; // grace before a mouse-leave closes the card, so crossing the gap to the next block slides it
const ENTER = [0.16, 1, 0.3, 1] as const;

const LANE_ICON: Record<LaneKey, { icon: LucideIcon; name: string }> = {
  status: { icon: FlagIcon, name: 'Status' },
  hint: { icon: LightbulbIcon, name: 'Hints' },
  spot: { icon: EyeIcon, name: 'Spots' },
  hunt: { icon: CrosshairIcon, name: 'Hunts' },
};

/** Spots lane: Tailwind teal-500, the same in light and dark, so it can't be mistaken for the orange status. */
const SPOT_COLOR = '#14b8a6';

/** Lane colour (`--c`) for blocks without a fixed kind colour, branch lines and dots. */
const LANE_COLOR: Record<LaneKey, string> = {
  status: 'var(--foreground)',
  hint: 'var(--muted-foreground)',
  spot: SPOT_COLOR,
  hunt: 'var(--fox-cooldown)',
};

const LEGEND: { label: string; style: CSSProperties }[] = [
  { label: 'groen', style: { background: '#22c55e' } },
  { label: 'oranje', style: { background: '#f97316' } },
  {
    label: 'rood',
    style: {
      background: 'repeating-linear-gradient(-45deg, color-mix(in oklab, #ef4444 75%, transparent) 0 1px, transparent 1px 4px), color-mix(in oklab, #ef4444 10%, var(--card))',
      boxShadow: 'inset 0 0 0 1px #ef4444',
    },
  },
  { label: 'OV', style: { background: '#6366f1' } },
  { label: 'puzzelen', style: { background: 'color-mix(in oklab, var(--muted-foreground) var(--fox-history-pastel), var(--card))' } },
  {
    label: 'cooldown',
    style: {
      background: 'repeating-linear-gradient(-45deg, color-mix(in oklab, var(--fox-cooldown) 60%, transparent) 0 1px, transparent 1px 4px), color-mix(in oklab, var(--fox-cooldown) 8%, var(--card))',
      boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--fox-cooldown) 55%, transparent)',
    },
  },
  { label: 'spot', style: { background: SPOT_COLOR } },
];

const HIDDEN_PATH = { pathLength: 0, opacity: 0 };
const SHOWN_PATH = { pathLength: 1, opacity: 1 };

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const laneIndex = (lane: LaneKey) => LANES.indexOf(lane);
const laneCentre = (lane: LaneKey) => TOP + ROW * laneIndex(lane) + ROW / 2;
/** Bottom edge of the status blocks: where branch lines leave and dots sit. */
const STATUS_EDGE = TOP + ROW / 2 + BLOCK / 2;
const HOUR_MS = 3_600_000;

/** Ends inside the window: a cooldown or late spot may run past now, a running block has no end. */
const capEnd = (block: HistoryBlock) => Math.min(block.end ?? HISTORY_WINDOW_MIN, HISTORY_WINDOW_MIN);
const isRunning = (block: HistoryBlock) => block.end === null || block.end > HISTORY_WINDOW_MIN;

interface ActiveCard {
  block: HistoryBlock;
  /** Opened by a tap: a tap anywhere else closes it (a mouse closes it on leave) */
  touch: boolean;
}

/**
 * One fox's last three hours as four lanes (status, hints, spots, hunts) in uiarc's agent-timeline look: blocks grow
 * from one CSS variable (`--t`, minutes) during a 1.6 s play-in, branch lines draw down from the status lane as the
 * playhead passes them, a running block shines. Hover/tap a block for a card; tap a lane to highlight it.
 * A new `playKey` replays the play-in; a new `model` for the same key only re-lays out. While `play` is false the window
 * waits empty (e.g. until the panel around it has opened); reduced motion shows everything at once regardless.
 */
export default function FoxHistoryTimeline({ model, playKey, play = true }: { model: HistoryModel; playKey: string; play?: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Furthest point the playhead has passed (React state, synced at most every 50 ms); --t itself is set per frame
  const [played, setPlayed] = useState(0);
  const lastPointer = useRef('mouse');
  const [active, setActive] = useState<ActiveCard | null>(null);
  const [focusLane, setFocusLane] = useState<LaneKey | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A different fox: start over (adjusting state during render, not in an effect)
  const [shownKey, setShownKey] = useState(playKey);
  if (shownKey !== playKey) {
    setShownKey(playKey);
    setPlayed(0);
    setActive(null);
    setFocusLane(null);
  }

  useLayoutEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    setWidth(plot.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);

  // Play-in: ease --t from 0 to 180 over 1.6 s (or jump there with reduced motion)
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const setT = (t: number) => wrap.style.setProperty('--t', t.toFixed(3));
    if (reduced) {
      setT(HISTORY_WINDOW_MIN);
      return;
    }
    setT(0);
    if (!play) return;
    let start: number | null = null;
    let lastSync = 0;
    let frame = requestAnimationFrame(function step(time) {
      start ??= time;
      const k = Math.min(1, (time - start) / PLAY_MS);
      const t = easeOutCubic(k) * HISTORY_WINDOW_MIN;
      setT(t);
      if (k >= 1 || time - lastSync >= SYNC_MS) {
        lastSync = time;
        setPlayed(k >= 1 ? HISTORY_WINDOW_MIN : t);
      }
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [playKey, reduced, play]);

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  // A tapped card closes on a tap anywhere outside a block
  useEffect(() => {
    if (!active?.touch) return;
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest('[data-fox-history-block]'))) setActive(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [active?.touch]);

  const passed = reduced ? HISTORY_WINDOW_MIN : played;
  const ppm = Math.max(0, width - 2 * PAD) / HISTORY_WINDOW_MIN;
  const x = (minute: number) => PAD + minute * ppm;
  const done = passed >= HISTORY_WINDOW_MIN;
  const ticks = axisTicks(model.from);

  const hours = useMemo(() => {
    const lines: number[] = [];
    for (let ms = Math.ceil(model.from / HOUR_MS) * HOUR_MS; ms <= model.to; ms += HOUR_MS) lines.push((ms - model.from) / 60_000);
    return lines;
  }, [model.from, model.to]);

  const label = useMemo(() => {
    const status = model.blocks.filter((block) => block.lane === 'status').at(-1);
    return `Historie van de laatste 3 uur${status ? `: ${status.card.title}, ${status.card.meta}` : ''}`;
  }, [model.blocks]);

  // The opacity flips at once: a zero-length path with round caps would still show a dot
  const draw: Transition = reduced ? { duration: 0 } : { duration: 0.36, ease: EASE_OUT, opacity: { duration: 0 } };
  const dim = (lane: LaneKey, amount: number) => (focusLane !== null && focusLane !== lane ? amount : 1);

  const onLaneTap = (lane: LaneKey) => (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('[data-fox-history-block]')) return;
    setFocusLane((current) => (current === lane ? null : lane));
  };

  const onBlockEnter = (block: HistoryBlock) => (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(leaveTimer.current);
    setActive({ block, touch: false });
  };
  // Close a little later: moving straight to the next block (across the 1.5 px gap) re-targets the card instead
  const onBlockLeave = (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setActive((current) => (current?.touch ? current : null)), LEAVE_MS);
  };
  const onBlockTap = (block: HistoryBlock) => (event: MouseEvent) => {
    // Enter/Space (a click with detail 0): show this block's card, never close it (focus already opened it)
    if (event.detail === 0) {
      setActive((current) => (current?.block.id === block.id ? current : { block, touch: false }));
      return;
    }
    // A mouse already shows the card on hover; a tap toggles it
    if (lastPointer.current === 'mouse') return;
    setActive((current) => (current?.block.id === block.id ? null : { block, touch: true }));
  };
  // Keyboard focus shows the card too (not the focus a tap or click gives the button)
  const onBlockFocus = (block: HistoryBlock) => (event: FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(':focus-visible')) setActive({ block, touch: false });
  };

  // Card under the active block, kept inside the plot
  const activeBlock = active ? model.blocks.find((block) => block.id === active.block.id) : undefined;
  const card = activeBlock && {
    left: Math.max(0, Math.min(width - CARD_W, (x(activeBlock.start) + x(capEnd(activeBlock))) / 2 - CARD_W / 2)),
    top: TOP + ROW * laneIndex(activeBlock.lane) + (ROW + BLOCK) / 2 + 6,
  };

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={label}
      className="fox-history relative grid grid-cols-[20px_minmax(0,1fr)] text-foreground"
      style={{ '--t': reduced ? HISTORY_WINDOW_MIN : 0 } as CSSProperties}
    >
      {/* Lane icons */}
      <div style={{ paddingTop: TOP }}>
        {LANES.map((lane) => {
          const { icon: Icon, name } = LANE_ICON[lane];
          // The keyboard way to highlight a lane (the plot rows hold block buttons, so they can't be buttons themselves)
          return (
            <button
              key={lane}
              type="button"
              title={name}
              aria-label={`Markeer ${name.toLowerCase()}`}
              aria-pressed={focusLane === lane}
              onClick={onLaneTap(lane)}
              className="flex w-full cursor-pointer items-center rounded-[4px] text-muted-foreground transition-opacity duration-200 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
              style={{ height: ROW, opacity: dim(lane, 0.28) }}
            >
              <Icon aria-hidden size={13} />
            </button>
          );
        })}
      </div>

      <div ref={plotRef} className="relative" style={{ paddingTop: TOP }}>
        {/* Hourly grid */}
        {hours.map((minute) => (
          <div key={minute} aria-hidden className="absolute top-0 w-px bg-foreground/[0.06]" style={{ left: x(minute), bottom: AXIS }} />
        ))}

        {LANES.map((lane) => (
          <div
            key={lane}
            onClick={onLaneTap(lane)}
            className="relative cursor-pointer transition-opacity duration-200 motion-reduce:transition-none"
            style={{ height: ROW, opacity: dim(lane, 0.28), '--c': LANE_COLOR[lane] } as CSSProperties}
          >
            {width > 0 &&
              model.blocks
                .filter((block) => block.lane === lane)
                .map((block) => {
                  const end = block.end === null ? 'var(--t)' : capEnd(block);
                  const live = done && isRunning(block);
                  return (
                    <button
                      key={block.id}
                      type="button"
                      data-fox-history-block=""
                      data-kind={block.kind}
                      aria-label={`${block.card.title}, ${block.card.meta}${block.card.note ? `, ${block.card.note}` : ''}`}
                      onPointerDown={(event) => (lastPointer.current = event.pointerType)}
                      onPointerEnter={onBlockEnter(block)}
                      onPointerLeave={onBlockLeave}
                      onFocus={onBlockFocus(block)}
                      onBlur={() => setActive((current) => (current?.touch ? current : null))}
                      onClick={onBlockTap(block)}
                      className={cn(
                        'fox-history-block absolute grid cursor-pointer place-items-center overflow-hidden rounded-[4px] text-white transition-[filter] duration-150 hover:brightness-110 hover:saturate-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                        live && 'fox-history-live',
                      )}
                      style={{
                        top: (ROW - BLOCK) / 2,
                        height: BLOCK,
                        left: x(block.start) + 1,
                        width: `max(0px, calc((max(${block.start}, min(var(--t), ${end})) - ${block.start}) * ${ppm}px - 1.5px))`,
                      }}
                    >
                      {block.icon === 'check' && <CheckIcon aria-hidden size={9} strokeWidth={3} />}
                      {block.icon === 'x' && <CircleXIcon aria-hidden size={9} strokeWidth={2.25} />}
                    </button>
                  );
                })}
          </div>
        ))}

        {/* Branch lines from the status lane down to their lane and back up */}
        {width > 0 && (
          <svg aria-hidden className="pointer-events-none absolute top-0 left-0 overflow-visible" width={width} height={TOP + ROW * LANES.length}>
            {model.links.map((link) => {
              const y = laneCentre(link.lane);
              const out = x(link.out);
              const back = link.back === null || link.back > HISTORY_WINDOW_MIN ? null : x(link.back);
              const stroke = { stroke: LANE_COLOR[link.lane], strokeWidth: 1.5, strokeLinecap: 'round', fill: 'none' } as const;
              const opacity = dim(link.lane, 0.16);
              return (
                <g key={`${shownKey}-${link.id}`} className="transition-opacity duration-200 motion-reduce:transition-none" style={{ opacity }}>
                  <motion.path
                    d={`M${out} ${STATUS_EDGE} V${y - CORNER} Q${out} ${y} ${out + CORNER} ${y} H${out + 6}`}
                    {...stroke}
                    initial={HIDDEN_PATH}
                    animate={passed >= link.out ? SHOWN_PATH : HIDDEN_PATH}
                    transition={draw}
                  />
                  {back !== null && (
                    <motion.path
                      d={`M${back - 6} ${y} H${back - CORNER} Q${back} ${y} ${back} ${y - CORNER} V${STATUS_EDGE}`}
                      {...stroke}
                      initial={HIDDEN_PATH}
                      animate={link.back !== null && passed >= link.back ? SHOWN_PATH : HIDDEN_PATH}
                      transition={draw}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Dots on the status lane where a line leaves / comes back (the return dot pops 260 ms after its line) */}
        {width > 0 &&
          model.links.map((link) => {
            const points = [{ key: 'out', minute: link.out, delay: 0 }];
            if (link.back !== null && link.back <= HISTORY_WINDOW_MIN) points.push({ key: 'back', minute: link.back, delay: RETURN_DOT_DELAY });
            return (
              <div
                key={`${shownKey}-${link.id}`}
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[2] transition-opacity duration-200 motion-reduce:transition-none"
                style={{ opacity: dim(link.lane, 0.16) }}
              >
                {points.map((point) => {
                  const on = passed >= point.minute;
                  return (
                    <motion.span
                      key={point.key}
                      className="absolute -mt-[3px] -ml-[3px] size-1.5 rounded-full ring-[1.5px] ring-card"
                      style={{ left: x(point.minute), top: STATUS_EDGE, backgroundColor: LANE_COLOR[link.lane] }}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={on ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
                      transition={reduced ? { duration: 0 } : { duration: 0.16, ease: ENTER, delay: on ? point.delay : 0 }}
                    />
                  );
                })}
              </div>
            );
          })}

        {/* Playhead + knob, from the same --t */}
        <div aria-hidden className="pointer-events-none absolute top-0 z-[3] w-px bg-foreground opacity-45" style={{ bottom: AXIS, left: `calc(${PAD}px + var(--t) * ${ppm}px)` }} />
        <div
          aria-hidden
          className="pointer-events-none absolute z-[3] -ml-[3.5px] size-[7px] rounded-full bg-foreground ring-2 ring-card"
          style={{ bottom: AXIS - 3, left: `calc(${PAD}px + var(--t) * ${ppm}px)` }}
        />

        {/* Axis */}
        <div aria-hidden className="relative text-[10.5px] text-muted-foreground tabular-nums" style={{ height: AXIS }}>
          <span className="absolute top-1 whitespace-nowrap" style={{ left: x(0) }}>
            {ticks[0]}
          </span>
          <span className="absolute top-1 -translate-x-1/2 whitespace-nowrap" style={{ left: x(HISTORY_WINDOW_MIN / 2) }}>
            {ticks[1]}
          </span>
          <span className="absolute top-1 -translate-x-full whitespace-nowrap" style={{ left: x(HISTORY_WINDOW_MIN) }}>
            {ticks[2]}
          </span>
        </div>

        {/* Hover / tap card: slides between blocks, fades out on leave */}
        <AnimatePresence>
          {activeBlock && card && (
            <motion.div
              key="card"
              aria-hidden
              className="pointer-events-none absolute z-[6] rounded-[14px] bg-popover px-[11px] py-[9px] text-xs text-popover-foreground shadow-[0_12px_30px_rgb(0_0_0/0.2)] ring-1 ring-border"
              style={{ width: CARD_W }}
              initial={{ opacity: 0, y: 3, left: card.left, top: card.top }}
              animate={{ opacity: 1, y: 0, left: card.left, top: card.top }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.12 } }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { opacity: { duration: 0.16, ease: ENTER }, y: { type: 'spring', visualDuration: 0.4, bounce: 0 }, default: { type: 'spring', visualDuration: 0.26, bounce: 0 } }
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div key={activeBlock.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduced ? { duration: 0 } : { duration: 0.16, ease: ENTER }}>
                  <div className="text-[13px] font-medium">{activeBlock.card.title}</div>
                  <div className="mt-0.5 text-muted-foreground tabular-nums">{activeBlock.card.meta}</div>
                  {activeBlock.card.note && <div className="mt-1 text-muted-foreground">{activeBlock.card.note}</div>}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div aria-hidden className="col-span-2 mx-0.5 mt-1 flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px] text-muted-foreground">
        {LEGEND.map(({ label, style }) => (
          <span key={label} className="inline-flex items-center gap-1">
            <i className="inline-block h-1.5 w-2.5 rounded-[2px]" style={style} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
