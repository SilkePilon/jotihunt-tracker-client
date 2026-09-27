import { useState } from 'react';
import useSound from 'use-sound';
import { useArticles } from '@/hooks/articles.hook.ts';
import useInterval from '@/hooks/utils/interval.hook.ts';
import hintAlert from '@/assets/audio/hint-alert.mp3';
import { formatHintCountdown, getLastHintTime, getNextHintTime } from '@/lib/next-hint';

const URGENT_MS = 5 * 60 * 1000;
const NEW_HINT_HIGHLIGHT_MS = 60 * 1000;

/**
 * Countdown to the next hint, plus a sound and highlight when a new hint arrives
 * (not on the first load).
 */
export function useNextHint(): { label: string; isUrgent: boolean; isNewHint: boolean } {
  const { articles, isLoading, isError } = useArticles();
  const [play] = useSound(hintAlert);
  const [now, setNow] = useState(() => Date.now());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastPlayedHint, setLastPlayedHint] = useState<number>();
  const [newHintUntil, setNewHintUntil] = useState(0);

  const lastHintTime = getLastHintTime(articles);

  // On first load, treat the current newest hint (if any) as already announced.
  // Trigger once articles have loaded, even with zero hints yet, so the very
  // first hint of the hunt still gets a sound/highlight instead of being silent.
  if (articles && !hasLoaded) {
    setHasLoaded(true);
    setLastPlayedHint(lastHintTime?.getTime());
  }

  useInterval(() => {
    const current = Date.now();
    setNow(current);
    if (hasLoaded && lastHintTime && (!lastPlayedHint || lastHintTime.getTime() > lastPlayedHint)) {
      setLastPlayedHint(lastHintTime.getTime());
      setNewHintUntil(current + NEW_HINT_HIGHLIGHT_MS);
      play();
    }
  }, 1000);

  const remaining = getNextHintTime(lastHintTime, new Date(import.meta.env.HUNT_START_TIME)).getTime() - now;
  const lastHintSlot = new Date(import.meta.env.HUNT_END_TIME).getTime() - 60 * 60 * 1000;
  const huntOver = now > lastHintSlot;
  const isNewHint = now < newHintUntil;

  let label = formatHintCountdown(remaining);
  if (isLoading) label = '…';
  else if (isError) label = 'Fout';
  else if (isNewHint) label = 'Nieuwe hint!';
  else if (huntOver) label = 'Geen hints meer';

  return { label, isNewHint, isUrgent: !huntOver && !isNewHint && remaining > 0 && remaining < URGENT_MS };
}
