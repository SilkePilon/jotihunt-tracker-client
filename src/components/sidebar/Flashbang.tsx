import { useMemo, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { motion } from 'motion/react';
import { FLASH_MS, THROW_MS, landingSpot, throwPath } from '@/lib/flashbang';

interface Point {
  x: number;
  y: number;
}

interface FlashbangProps {
  /** Where the throw starts (centre of the theme toggle) */
  from: Point;
  /** Switch to light mode; runs under the white */
  onSwitch: () => void;
  /** The effect is over and can unmount */
  onDone: () => void;
}

/** Grenade drawn after the CS:GO flashbang: perforated grey cylinder, fuse head on top. */
function Grenade() {
  return (
    <svg viewBox="0 0 28 48" width="28" height="48" className="drop-shadow-[0_3px_4px_rgba(0,0,0,0.45)]">
      <defs>
        <linearGradient id="flashbang-body" x1="0" x2="1">
          <stop offset="0" stopColor="#3f4347" />
          <stop offset="0.35" stopColor="#a3a9ae" />
          <stop offset="0.55" stopColor="#7d8388" />
          <stop offset="1" stopColor="#363a3e" />
        </linearGradient>
        <linearGradient id="flashbang-fuse" x1="0" x2="1">
          <stop offset="0" stopColor="#4a4d4f" />
          <stop offset="0.4" stopColor="#8e9193" />
          <stop offset="1" stopColor="#3e4143" />
        </linearGradient>
      </defs>
      <rect x="10" y="2" width="8" height="8" rx="1.5" fill="url(#flashbang-fuse)" />
      <rect x="4" y="9" width="20" height="4" rx="1" fill="url(#flashbang-fuse)" />
      <rect x="3" y="12" width="22" height="33" rx="3" fill="url(#flashbang-body)" />
      {[17, 23, 29, 35].map((y) =>
        [7, 12.5, 18].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="3" height="4" rx="0.8" fill="#1c1f21" />),
      )}
      <rect x="3" y="41" width="22" height="5" rx="2" fill="#2e3134" />
    </svg>
  );
}

/** The spoon (lever) that flies off the moment the grenade is thrown */
function Spoon() {
  return (
    <svg viewBox="0 0 8 22" width="8" height="22">
      <path d="M1 1h5.5v3L5 21H3L2.5 4H1z" fill="#6f7478" />
    </svg>
  );
}

/**
 * The dark → light switch as a CS:GO flashbang: the grenade arcs from the toggle onto the page, bounces, pops.
 * At the pop the theme switches inside a view transition: the white bursts open from the grenade, and the
 * frozen dark page (the old snapshot) lingers as an afterimage while the white fades. See `.flashbang` in index.css.
 */
export default function Flashbang({ from, onSwitch, onDone }: FlashbangProps) {
  const [popped, setPopped] = useState(false);
  const path = useMemo(() => throwPath(from, landingSpot(window.innerWidth, window.innerHeight)), [from]);

  const pop = () => {
    const root = document.documentElement;
    root.style.setProperty('--flashbang-x', `${path.end.x}px`);
    root.style.setProperty('--flashbang-y', `${path.end.y}px`);
    const swap = () => flushSync(() => {
      onSwitch();
      setPopped(true);
    });
    if (!document.startViewTransition) {
      // No afterimage without view transitions; switch once the white has burst over the whole screen
      setPopped(true);
      window.setTimeout(onSwitch, 140);
      window.setTimeout(onDone, FLASH_MS);
      return;
    }
    root.classList.add('flashbang');
    document.startViewTransition(swap).finished.finally(() => {
      root.classList.remove('flashbang');
      onDone();
    });
  };

  return createPortal(
    // Blocks clicks for the whole effect: you're flashed
    <div aria-hidden className="fixed inset-0 z-[10000] cursor-default">
      {popped ? (
        <div className="flashbang-flash fixed inset-0 bg-white" />
      ) : (
        <>
          <motion.div
            className="absolute top-0 left-0 -mt-6 -ml-3.5"
            initial={{ x: from.x, y: from.y, rotate: 0, scale: 1.15 }}
            animate={{ x: path.x, y: path.y, rotate: path.rotate, scale: [1.15, 1, 0.9, 0.9, 0.9] }}
            transition={{ duration: THROW_MS / 1000, times: path.times, ease: ['easeOut', 'easeIn', 'easeOut', 'easeIn'] }}
            onAnimationComplete={pop}
          >
            <Grenade />
          </motion.div>
          <motion.div
            className="absolute top-0 left-0 -mt-3 -ml-1"
            initial={{ x: from.x + 8, y: from.y - 10, rotate: 0, opacity: 1 }}
            animate={{ x: from.x - 30, y: [from.y - 10, from.y - 60, from.y + 40], rotate: -540, opacity: [1, 1, 0] }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <Spoon />
          </motion.div>
        </>
      )}
    </div>,
    document.body,
  );
}
