import flashbangUrl from '@/assets/audio/flashbang.mp3';
import { RING_LOOP, SOUND_FADE_FLOOR, SOUND_FADE_FROM_S, SOUND_FADE_TO_S, SOUND_GAIN, SOUND_ONSET_S, extendRinging } from './flashbang';

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

/** The recording's ringing only lasts ~4s; extend it so it can die away slowly (see SOUND_FADE_TO_S) */
function withLongerRinging(ctx: AudioContext, decoded: AudioBuffer): AudioBuffer {
  const rate = decoded.sampleRate;
  const length = Math.ceil((SOUND_ONSET_S + SOUND_FADE_TO_S + 0.1) * rate);
  const loop = { from: Math.round(RING_LOOP.from * rate), to: Math.round(RING_LOOP.to * rate), crossfade: Math.round(RING_LOOP.crossfade * rate) };
  const extended = ctx.createBuffer(decoded.numberOfChannels, length, rate);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    extended.copyToChannel(extendRinging(decoded.getChannelData(channel), length, loop), channel);
  }
  return extended;
}

/** Fetch and decode the sound ahead of time; safe to call repeatedly. */
export function preloadFlashbangSound(): Promise<AudioBuffer | undefined> {
  const ctx = audioContext();
  if (!ctx) return Promise.resolve(undefined);
  buffer ??= fetch(flashbangUrl)
    .then((response) => response.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((decoded) => withLongerRinging(ctx, decoded))
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
    const start = Math.max(bangAt, ctx.currentTime);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    // Exponential ramp: an even fade in loudness; the last second goes linearly to true silence
    gain.gain.setValueAtTime(SOUND_GAIN, start);
    gain.gain.setValueAtTime(SOUND_GAIN, start + SOUND_FADE_FROM_S);
    gain.gain.exponentialRampToValueAtTime(SOUND_GAIN * SOUND_FADE_FLOOR, start + SOUND_FADE_TO_S - 1);
    gain.gain.linearRampToValueAtTime(0, start + SOUND_FADE_TO_S);
    source.buffer = decoded;
    source.connect(gain).connect(ctx.destination);
    source.start(start, SOUND_ONSET_S);
    source.stop(start + SOUND_FADE_TO_S);
  });
}
