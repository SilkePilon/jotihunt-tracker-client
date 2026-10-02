import { useState } from 'react';
import useInterval from '@/hooks/utils/interval.hook';
import { useNextHint } from '@/hooks/next-hint.hook';
import { cn } from '@/lib/utils';

export default function HqClock() {
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), 1000);
  const { label, isUrgent, isNewHint } = useNextHint();
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="font-mono text-6xl font-bold tabular-nums leading-none">{now.toLocaleTimeString('nl-NL')}</div>
      <div className="text-right">
        <div className="text-xs uppercase text-muted-foreground">Volgende hint</div>
        <div className={cn('font-mono text-3xl font-semibold tabular-nums', isUrgent && 'text-orange-500', isNewHint && 'text-green-500')}>{label}</div>
      </div>
    </div>
  );
}
