import { CrownIcon } from 'lucide-react';
import { breakdownText, initials, podiumOrder } from '@/lib/leaderboard';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types/Leaderboard';

interface PodiumProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  selectedId: string | null;
  onSelect: (userId: string) => void;
}

/** Block per podium position (2-1-3 layout: index 0 is second place, 1 first, 2 third). */
const BLOCKS = ['h-16 bg-muted text-muted-foreground', 'h-24 bg-primary/20 text-primary', 'h-12 bg-orange-200/60 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200'];

/** Top 3 as a classic 2-1-3 podium; a spot toggles its score breakdown below. */
export default function Podium({ entries, currentUserId, selectedId, onSelect }: PodiumProps) {
  const selected = entries.slice(0, 3).find((entry) => entry.userId === selectedId);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 items-end gap-3">
        {podiumOrder(entries).map((entry, position) => {
          if (!entry) return <div key={position} />;
          const first = position === 1;
          return (
            <button
              key={entry.userId}
              type="button"
              aria-label={`${entry.name}, plek ${entry.rank}, ${entry.score} punten`}
              aria-pressed={entry.userId === selectedId}
              onClick={() => onSelect(entry.userId)}
              className="flex min-w-0 flex-col items-center gap-1 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {first && <CrownIcon className="size-5 text-amber-500" />}
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full font-semibold',
                  first ? 'size-12 bg-primary/15 text-primary ring-2 ring-amber-400' : 'size-10 bg-muted text-sm text-muted-foreground',
                )}
              >
                {initials(entry.name)}
              </span>
              <span className="w-full truncate text-center text-sm font-medium">
                {entry.name}
                {entry.userId === currentUserId && <span className="text-muted-foreground"> (jij)</span>}
              </span>
              <span className={cn('text-sm font-semibold tabular-nums', first && 'text-primary')}>{entry.score}</span>
              <span className={cn('flex w-full items-start justify-center rounded-t-lg pt-2 text-lg font-bold', BLOCKS[position])}>{entry.rank}</span>
            </button>
          );
        })}
      </div>
      {selected && <p className="text-center text-xs text-muted-foreground">{breakdownText(selected)}</p>}
    </div>
  );
}
