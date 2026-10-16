import flashbangUrl from '@/assets/audio/flashbang.mp3';
import { SOUND_GAIN, SOUND_ONSET_S } from './flashbang';

/**
 * The flashbang bang through Web Audio, so it can be scheduled to the millisecond on the pop.
 * The file is only fetched once someone points at (or focuses) the theme toggle.
 */
let context: AudioContext | undefined;
let buffer: Promise<AudioBuffer | undefined> | undefined;

function audioContext(): AudioContext | undefined {
  if (!context && typeof AudioContext !== 'undefined') context = new AudioContext();
  return context;
}

/** Fetch and decode the sound ahead of time; safe to call repeatedly. */
export function preloadFlashbangSound(): Promise<AudioBuffer | undefined> {
  const ctx = audioContext();
  if (!ctx) return Promise.resolve(undefined);
  buffer ??= fetch(flashbangUrl)
    .then((response) => response.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .catch(() => {
      buffer = undefined;
      return undefined;
    });
  return buffer;
}

/**
 * Schedule the bang `delayMs` from now. Call from the click handler: resuming the context there
 * counts as the user gesture browsers (Safari) need. If decoding is slower than the throw, it plays late.
 */
export function playFlashbangSound(delayMs: number): void {
  const ctx = audioContext();
  if (!ctx) return;
  ctx.resume().catch(() => {});
  const bangAt = ctx.currentTime + delayMs / 1000;
  preloadFlashbangSound().then((decoded) => {
    if (!decoded) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = SOUND_GAIN;
    source.buffer = decoded;
    source.connect(gain).connect(ctx.destination);
    source.start(Math.max(bangAt, ctx.currentTime), SOUND_ONSET_S);
  });
}
