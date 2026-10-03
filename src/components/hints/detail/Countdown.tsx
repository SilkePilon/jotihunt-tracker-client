import { useState } from 'react';
import useInterval from '@/hooks/utils/interval.hook';
import { formatCountdown, remainingMs } from '@/lib/hints';
import { cn } from '@/lib/utils';

/**
 * Time left to score, ticking every second. Lives in its own component so only it re-renders on each tick. Renders
 * nothing once the time is up.
 */
export default function Countdown({ publishAt }: { publishAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);

  const left = remainingMs(publishAt, now);
  if (left <= 0) return null;
  return (
    <span className={cn('ml-auto font-mono text-sm tabular-nums', left < 5 * 60 * 1000 && 'font-bold text-red-600')} title="Tijd om te scoren">
      {formatCountdown(left)}
    </span>
  );
}
