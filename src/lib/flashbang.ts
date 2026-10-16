/** Dark → light theme switch as a CS:GO flashbang: the grenade is thrown onto the page, pops, the screen goes white and the dark UI lingers as an afterimage. */

/** Grenade flight from the toggle to where it pops (ms) */
export const THROW_MS = 800;
/** Everything after the pop: whiteout, then the white and the afterimage fade (ms); matches the CSS animations in index.css */
export const FLASH_MS = 3200;
/** The bang in flashbang.mp3 starts after this much leading silence (s) */
export const SOUND_ONSET_S = 0.14;
/** The recording is clipped loud; keep it from blowing out speakers */
export const SOUND_GAIN = 0.5;
/** The ringing holds at one level and the file cuts off 4.1s after the bang; it fades out from here (s after the bang)… */
export const SOUND_FADE_FROM_S = 0.6;
/** …to silence just before that cut, like the ringing dying away in-game */
export const SOUND_FADE_TO_S = 4;

interface FlashbangCheck {
  isDarkMode: boolean;
  reducedMotion: boolean;
}

/** Only switching dark → light throws a flashbang; reduced motion keeps the plain switch. */
export function shouldFlashbang({ isDarkMode, reducedMotion }: FlashbangCheck): boolean {
  return isDarkMode && !reducedMotion;
}

interface Point {
  x: number;
  y: number;
}

export interface ThrowPath {
  x: number[];
  y: number[];
  rotate: number[];
  times: number[];
  /** Where the grenade comes to rest and pops */
  end: Point;
}

/**
 * Keyframes for the throw: an arc from `from` to `target`, one short bounce, then a roll a little further.
 * The arc peaks above both ends but never leaves the top of the screen.
 */
export function throwPath(from: Point, target: Point): ThrowPath {
  const dx = target.x - from.x;
  const apex = Math.max(24, Math.min(from.y, target.y) - 140);
  const end = { x: target.x + dx * 0.12, y: target.y };
  return {
    x: [from.x, from.x + dx * 0.5, target.x, target.x + dx * 0.08, end.x],
    y: [from.y, apex, target.y, target.y - 26, end.y],
    rotate: [0, 380, 620, 700, 760],
    times: [0, 0.42, 0.7, 0.84, 1],
    end,
  };
}

/** Somewhere around the middle of the screen, so it never pops in exactly the same place */
export function landingSpot(width: number, height: number, random: () => number = Math.random): Point {
  return {
    x: width * (0.5 + (random() - 0.5) * 0.16),
    y: height * (0.55 + (random() - 0.5) * 0.12),
  };
}
