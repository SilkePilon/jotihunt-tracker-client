import { useArticles } from '@/hooks/articles.hook.ts';
import Ripple from '../../magicui/Ripple.tsx';
import { useState } from 'react';
import { Article } from '@/types/Article';
import hintAlert from '@/assets/audio/hint-alert.mp3';
import useInterval from '@/hooks/utils/interval.hook.ts';
import useSound from 'use-sound';

export default function NextHintTime() {
  const { articles, isLoading, isError } = useArticles();
  const [play] = useSound(hintAlert);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastPlayedHint, setLastPlayedHint] = useState<Date>();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [newHint, setNewHint] = useState(false);

  /**
   * The last hint time, derived from the articles.
   */
  const lastHintTime = getLastHintTime(articles);

  /**
   * On the first load, mark the current last hint as already played so the
   * sound does not play on the initial browser load.
   */
  if (lastHintTime && !hasLoaded) {
    setHasLoaded(true);
    setLastPlayedHint(lastHintTime);
  }

  /**
   * Check if there is a new hint available and play the sound if so.
   */
  function checkForNewHint() {
    // if there is a new hint that has not been played yet, play the sound
    // make sure the first browser load does not play the sound

    const hintTime = lastHintTime;
    if (!hintTime) return;

    if (!lastPlayedHint || hintTime.getTime() > lastPlayedHint.getTime()) {
      setNewHint(true);
      setTimeout(() => {
        setNewHint(false);
      }, 60000);
      playSound();
      setLastPlayedHint(hintTime);
    }
  }

  /**
   * Play the hint alert sound.
   */
  function playSound() {
    console.log('A new hint has arrived!');
    play();
  }

  /**
   * This effect runs every second to update the current time and check for new hints.
   */
  useInterval(() => {
    setCurrentTime(new Date());
    if (hasLoaded) checkForNewHint();
  }, 1000);

  /**
   * Get the next hint time.
   * @returns The time when the next hint should be available.
   */
  function getNextHintTime() {
    // if there is no last hint time, return the start time
    if (!lastHintTime) {
      return new Date(import.meta.env.HUNT_START_TIME);
    }

    // if the last hint time is before the start time, return the start time
    if (lastHintTime.getTime() < new Date(import.meta.env.HUNT_START_TIME).getTime()) {
      return new Date(import.meta.env.HUNT_START_TIME);
    }

    // otherwise, return the next hour
    const nextHint = new Date(lastHintTime);
    nextHint.setHours(nextHint.getHours() + 1);
    nextHint.setMinutes(0);
    nextHint.setSeconds(0);
    return nextHint;
  }

  /**
   * Nicely format the countdown in 00:00:00 format.
   * @returns The formatted countdown
   */
  function formatCountdown() {
    const nextHint = getNextHintTime();
    const diff = nextHint.getTime() - currentTime.getTime();

    if (diff < 0) return '00:00:00';

    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Get the content to display based on the current state.
   * @returns The content to display
   */
  function getContent() {
    if (isLoading) return '...';
    if (isError) return 'Fout!';
    if (newHint) return 'Nieuwe hint!';

    const huntEndTime = new Date(import.meta.env.HUNT_END_TIME as string);
    huntEndTime.setHours(huntEndTime.getHours() - 1);

    if (currentTime > huntEndTime) return 'Geen komende hints';

    return formatCountdown();
  }

  return (
    <div className="relative flex flex-col h-full w-full items-center justify-center overflow-hidden rounded-lg bg-card text-card-foreground card p-4">
      <p>Volgende hint:</p>
      <p className="z-10 whitespace-pre-wrap text-center text-4xl tracking-tighter font-semibold text-white">{getContent()}</p>
      <Ripple color={newHint ? 'green' : 'blue'} />
    </div>
  );
}

/**
 * Get the last hint time from the articles.
 * Assumes the articles are sorted by publishAt descending (which they are by default).
 * @param articles The articles to search
 * @returns The last hint time
 */
function getLastHintTime(articles?: Article[]) {
  if (!articles) return;
  const hints = articles.filter((article) => article.type === 'hint');
  if (hints.length === 0) return;
  const lastHint = hints[0];
  return new Date(lastHint.publishAt);
}
