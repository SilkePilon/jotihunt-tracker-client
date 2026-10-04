import { cn } from '@/lib/utils';
import type { PresenceEntry } from '@/types/Intel';

const COLOURS = ['bg-amber-300', 'bg-sky-300', 'bg-emerald-300', 'bg-pink-300', 'bg-violet-300', 'bg-orange-300'];
const CIRCLE = 'flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold';

/** A stable colour per user: the same person has the same colour everywhere */
function colourOf(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index++) hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  return COLOURS[hash % COLOURS.length];
}

/** Small overlapping circles with the initials of the users who have something open */
export default function PresenceAvatars({ entries, max = 3 }: { entries: PresenceEntry[]; max?: number }) {
  if (entries.length === 0) return null;
  const shown = entries.slice(0, max);
  const rest = entries.length - shown.length;

  return (
    <span className="flex shrink-0 items-center">
      {shown.map((entry, index) => (
        <span key={entry.userId} role="img" title={entry.name} aria-label={entry.name} className={cn(CIRCLE, 'text-neutral-900', colourOf(entry.userId), index > 0 && '-ml-1.5')}>
          {entry.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      ))}
      {rest > 0 && (
        <span
          role="img"
          title={entries
            .slice(max)
            .map((entry) => entry.name)
            .join(', ')}
          aria-label={`en ${rest} anderen`}
          className={cn(CIRCLE, '-ml-1.5 bg-muted text-muted-foreground')}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
