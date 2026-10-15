import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { animate, AnimatePresence, motion, useMotionValue, type AnimationPlaybackControls } from 'motion/react';
import { Loader2Icon } from 'lucide-react';
import { holdProgressAfter, isHoldComplete } from '@/lib/hold';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Letting go early drains the fill this fast (seconds) */
const RELEASE_S = 0.25;

type HoldButtonProps = {
  /** How long the button must be held (pointer or Space/Enter) before `onConfirm` runs */
  durationMs?: number;
  onConfirm: () => void;
  disabled?: boolean;
  /** Shows a spinner and `busyLabel` instead of the children, and blocks holding */
  busy?: boolean;
  busyLabel: ReactNode;
  /** Touch and pen: shown once the fill is full, until the finger lifts (which confirms) */
  releaseLabel?: ReactNode;
  /** The label; also the accessible name, so keep it plain text or pass `aria-label` (only used while not busy) */
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
};

/**
 * Primary button that only fires after a deliberate hold: a white overlay fills it left to right while held, and
 * drains again when released early. A short tap does nothing.
 *
 * Mouse and keyboard confirm as soon as the fill is full. A finger or pen only "arms" the button there and confirms on
 * lift: `onConfirm` usually opens the passkey prompt, and WebAuthn needs a user activation, which a touch pointerdown
 * is not (iOS WebKit rejects it) but the pointerup is.
 */
export default function HoldButton({ durationMs = 1000, onConfirm, disabled, busy, busyLabel, releaseLabel = 'Laat los om te bevestigen', children, className, 'aria-label': ariaLabel }: HoldButtonProps) {
  const fill = useMotionValue(0);
  const frame = useRef<number | null>(null);
  const release = useRef<AnimationPlaybackControls | null>(null);
  /** The pointer type of the current hold; null for the keyboard */
  const pointerType = useRef<string | null>(null);
  // The ref decides (event handlers may run before a re-render); the state only swaps the label
  const armedRef = useRef(false);
  const [armed, setArmed] = useState(false);
  const blocked = disabled || busy;
  // Disabled or busy while armed: drop the "Laat los" label (adjusting state during render, not in an effect)
  if (blocked && armed) setArmed(false);

  function stopFrame() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }

  function drain() {
    stopFrame();
    release.current?.stop();
    release.current = animate(fill, 0, { duration: RELEASE_S, ease: 'easeOut' });
  }

  function disarm() {
    armedRef.current = false;
    setArmed(false);
  }

  function start(type: string | null) {
    if (blocked || frame.current !== null || armedRef.current) return;
    pointerType.current = type;
    release.current?.stop();
    // Picking up a fill that is still draining continues from where it is, not from zero
    const startedAt = performance.now() - fill.get() * durationMs;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      fill.set(holdProgressAfter(elapsed, durationMs));
      if (isHoldComplete(elapsed, durationMs)) {
        frame.current = null;
        if (pointerType.current === 'touch' || pointerType.current === 'pen') {
          // Full, but wait for the lift: that is the user activation the passkey prompt needs
          armedRef.current = true;
          setArmed(true);
          return;
        }
        onConfirm();
        // The busy label takes over; the fill drains underneath it, ready for another try
        drain();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  /** Let go early, slid off, cancelled by the browser or lost focus: drain and never confirm */
  function cancel() {
    if (armedRef.current) {
      disarm();
      drain();
      return;
    }
    if (frame.current === null) return;
    drain();
  }

  function onPointerUp() {
    if (!armedRef.current) {
      cancel();
      return;
    }
    disarm();
    onConfirm();
    drain();
  }

  // Disabled or busy mid-hold (or unmounting): never confirm afterwards
  useEffect(() => {
    if (!blocked) return;
    const wasArmed = armedRef.current;
    armedRef.current = false;
    if (frame.current === null && !wasArmed) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    release.current?.stop();
    release.current = animate(fill, 0, { duration: RELEASE_S, ease: 'easeOut' });
  }, [blocked, fill]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      release.current?.stop();
    },
    [],
  );

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    start(event.pointerType);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    // No click on Enter, and no page scroll on Space; key repeat keeps the hold going
    event.preventDefault();
    if (!event.repeat) start(null);
  }

  function onKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    cancel();
  }

  return (
    <button
      type="button"
      aria-label={busy ? undefined : ariaLabel}
      disabled={blocked}
      aria-busy={busy || undefined}
      // vaul would otherwise start dragging the drawer when a held finger wobbles
      data-vaul-no-drag
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={cancel}
      // A long press must not open the context menu or select the label
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        'relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground outline-none select-none [-webkit-touch-callout:none] transition-[transform,opacity] focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-70',
        className,
      )}
    >
      <motion.span aria-hidden className="absolute inset-0 origin-left bg-[rgb(255_255_255/0.22)]" style={{ scaleX: fill }} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={busy ? 'busy' : armed ? 'armed' : 'idle'} className="relative flex items-center gap-2 [&_svg]:size-5 [&_svg]:shrink-0" {...SWAP}>
          {busy ? (
            <>
              <Loader2Icon className="animate-spin" />
              {busyLabel}
            </>
          ) : armed ? (
            releaseLabel
          ) : (
            children
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
