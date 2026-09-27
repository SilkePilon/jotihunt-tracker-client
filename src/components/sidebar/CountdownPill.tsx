import { useNextHint } from '@/hooks/next-hint.hook';
import { cn } from '@/lib/utils';

export default function CountdownPill() {
  const { label, isUrgent, isNewHint } = useNextHint();

  return (
    <span
      title="Volgende hint"
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold',
        isNewHint && 'animate-pulse bg-green-100 text-green-700',
        !isNewHint && isUrgent && 'bg-red-100 text-red-700',
        !isNewHint && !isUrgent && 'bg-orange-100 text-orange-700',
      )}
    >
      ⧗ {label}
    </span>
  );
}
