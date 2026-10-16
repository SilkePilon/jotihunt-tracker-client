/** Dark → light theme switch as a CS:GO flashbang: the grenade is thrown onto the page, pops, the screen goes white and the dark UI lingers as an afterimage. */

/** Grenade flight from the toggle to where it pops (ms) */
export const THROW_MS = 800;
/** Everything after the pop: whiteout, then the white and the afterimage fade (ms); matches the CSS animations in index.css */
export const FLASH_MS = 3200;
/** The bang in flashbang.mp3 starts after this much leading silence (s) */
export const SOUND_ONSET_S = 0.14;
/** The recording is clipped loud; keep it from blowing out speakers */
export const SOUND_GAIN = 0.5;
/** The ringing fades out from here (s after the bang)… */
export const SOUND_FADE_FROM_S = 0.6;
/** …to silence here, slowly dying away like in-game. The file is shorter, so its ringing is extended to this length. */
export const SOUND_FADE_TO_S = 8;
/** Even fade in loudness (~4.5 dB/s) down to this share of the gain one second before the end, then linear to silence */
export const SOUND_FADE_FLOOR = 0.04;
/** Steady stretch of ringing in the file (s, file time) that is repeated to extend it; the file cuts off at 4.25s */
export const RING_LOOP = { from: 3, to: 4.15, crossfade: 0.25 };

interface RingLoop {
  /** Start and end of the repeated stretch, and the overlap at every seam (samples) */
  from: number;
  to: number;
  crossfade: number;
}

/**
 * The recording with its ringing extended to `length` samples: the original up to `loop.to`, then the stretch
 * `loop.from`..`loop.to` over and over, every seam an equal-power crossfade so it doesn't click or dip.
 */
export function extendRinging(source: Float32Array, length: number, loop: RingLoop): Float32Array<ArrayBuffer> {
  const out = new Float32Array(length);
  out.set(source.subarray(0, Math.min(loop.to, length)));
  const segment = source.subarray(loop.from, loop.to);
  const crossfade = Math.min(loop.crossfade, segment.length);
  if (segment.length <= crossfade) return out;
  for (let start = loop.to - crossfade; start < length; start += segment.length - crossfade) {
    for (let i = 0; i < segment.length && start + i < length; i++) {
      if (i < crossfade) {
        const angle = (i / crossfade) * (Math.PI / 2);
        out[start + i] = out[start + i] * Math.cos(angle) + segment[i] * Math.sin(angle);
      } else {
        out[start + i] = segment[i];
      }
    }
  }
  return out;
}

interface FlashbangCheck {
  isDarkMode: boolean;
  reducedMotion: boolean;
  /** Phones and tablets (touch as primary pointer) */
  touchDevice: boolean;
}

/** Only switching dark → light throws a flashbang; reduced motion and mobile devices keep the plain switch. */
export function shouldFlashbang({ isDarkMode, reducedMotion, touchDevice }: FlashbangCheck): boolean {
  return isDarkMode && !reducedMotion && !touchDevice;
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
