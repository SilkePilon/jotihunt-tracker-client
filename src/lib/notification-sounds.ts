import foxGreen from '@/assets/audio/fox-green.mp3';
import foxStatus from '@/assets/audio/fox-status.mp3';
import hint from '@/assets/audio/hint-alert.mp3';
import article from '@/assets/audio/article.mp3';
import hunt from '@/assets/audio/deadline.mp3';
import broadcast from '@/assets/audio/broadcast.mp3';
import counterHunt from '@/assets/audio/counter-hunt.mp3';
import type { SoundKey } from './notifications';

// happy-hour reuses the broadcast sound under its own key, so it can get its own file later
const SOURCES: Record<SoundKey, string> = { 'fox-green': foxGreen, 'fox-status': foxStatus, hint, article, hunt, broadcast, 'counter-hunt': counterHunt, 'happy-hour': broadcast };

/** Play an alert; silently ignored when the browser blocks audio (no user interaction yet). Returns the audio, to stop it early. */
export function playNotificationSound(key: SoundKey, volume = 1): HTMLAudioElement {
  const audio = new Audio(SOURCES[key]);
  audio.volume = volume;
  audio.play().catch(() => {});
  return audio;
}
