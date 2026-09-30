import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import type { Rect } from './placement';
import { settled, stepSpring, type SpringState } from './spring';

const CHANNELS = ['cardX', 'cardY', 'holeX', 'holeY', 'holeW', 'holeH'] as const;
type Channel = (typeof CHANNELS)[number];
type Values = Record<Channel, number>;

interface Motion {
  springs: Record<Channel, SpringState> | null;
  goals: Values | null;
  frame: number;
  lastTime: number | null;
  /** No frame has run since the springs were created; goal updates snap (e.g. the card's first measurement) */
  fresh: boolean;
}

interface Elements {
  card: RefObject<HTMLElement | null>;
  hole: RefObject<HTMLElement | null>;
}

function paint(springs: Record<Channel, SpringState>, els: Elements) {
  const card = els.card.current;
  if (card) card.style.transform = `translate3d(${springs.cardX.value}px, ${springs.cardY.value}px, 0)`;
  const hole = els.hole.current;
  if (hole) {
    hole.style.transform = `translate3d(${springs.holeX.value}px, ${springs.holeY.value}px, 0)`;
    hole.style.width = `${Math.max(0, springs.holeW.value)}px`;
    hole.style.height = `${Math.max(0, springs.holeH.value)}px`;
  }
}

function snap(goals: Values): Record<Channel, SpringState> {
  return Object.fromEntries(CHANNELS.map((c) => [c, { value: goals[c], velocity: 0 }])) as Record<Channel, SpringState>;
}

function tick(motion: Motion, els: Elements, now: number) {
  const { springs, goals } = motion;
  if (!springs || !goals) return;
  const dt = motion.lastTime === null ? 16 : now - motion.lastTime;
  motion.lastTime = now;
  motion.fresh = false;
  let moving = false;
  for (const c of CHANNELS) {
    const next = stepSpring(springs[c], goals[c], dt);
    if (settled(next, goals[c])) springs[c] = { value: goals[c], velocity: 0 };
    else {
      springs[c] = next;
      moving = true;
    }
  }
  paint(springs, els);
  if (moving) motion.frame = requestAnimationFrame((t) => tick(motion, els, t));
  else {
    motion.frame = 0;
    motion.lastTime = null;
  }
}

/**
 * Glides the tour card and the spotlight hole with springs, writing styles straight to the DOM (no re-render per frame).
 * `active` false resets everything. `hold` keeps the current goals (a target is still being looked up); `hole` null
 * closes the spotlight to 0×0 around the center of its current position. The first goals are applied without animation.
 */
export function useSpotlightMotion(
  { active, hold, card, hole }: { active: boolean; hold: boolean; card: { x: number; y: number }; hole: Rect | null },
  cardRef: RefObject<HTMLElement | null>,
  holeRef: RefObject<HTMLElement | null>,
) {
  const motionRef = useRef<Motion>({ springs: null, goals: null, frame: 0, lastTime: null, fresh: false });
  const holeX = hole?.x ?? null;
  const holeY = hole?.y ?? null;
  const holeW = hole?.width ?? null;
  const holeH = hole?.height ?? null;

  useLayoutEffect(() => {
    const motion = motionRef.current;
    const els: Elements = { card: cardRef, hole: holeRef };
    if (!active) {
      cancelAnimationFrame(motion.frame);
      Object.assign(motion, { springs: null, goals: null, frame: 0, lastTime: null, fresh: false });
      return;
    }
    const prev = motion.goals;
    if (hold && prev) return;

    let goalHole: Pick<Values, 'holeX' | 'holeY' | 'holeW' | 'holeH'>;
    if (holeX !== null && holeY !== null && holeW !== null && holeH !== null) {
      goalHole = { holeX, holeY, holeW, holeH };
    } else {
      // Close in place; the very first hole starts closed in the middle of the screen
      const cur = motion.springs;
      const cx = cur ? cur.holeX.value + cur.holeW.value / 2 : prev ? prev.holeX + prev.holeW / 2 : window.innerWidth / 2;
      const cy = cur ? cur.holeY.value + cur.holeH.value / 2 : prev ? prev.holeY + prev.holeH / 2 : window.innerHeight / 2;
      goalHole = { holeX: cx, holeY: cy, holeW: 0, holeH: 0 };
    }
    const goals: Values = { cardX: card.x, cardY: card.y, ...goalHole };
    if (prev && CHANNELS.every((c) => prev[c] === goals[c])) return;
    motion.goals = goals;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!motion.springs || motion.fresh || reduced) {
      cancelAnimationFrame(motion.frame);
      motion.springs = snap(goals);
      motion.frame = 0;
      motion.lastTime = null;
      motion.fresh = !prev || motion.fresh;
      paint(motion.springs, els);
      // Let the first frame clear `fresh` so later goal changes animate
      if (motion.fresh) motion.frame = requestAnimationFrame((t) => tick(motion, els, t));
      return;
    }
    if (!motion.frame) motion.frame = requestAnimationFrame((t) => tick(motion, els, t));
  }, [active, hold, card.x, card.y, holeX, holeY, holeW, holeH, cardRef, holeRef]);

  useEffect(() => {
    const motion = motionRef.current;
    return () => cancelAnimationFrame(motion.frame);
  }, []);
}
