import { Badge } from '@/components/ui/badge';
import { breakdownText, formatKm } from '@/lib/leaderboard';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types/Leaderboard';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  selected: boolean;
  onSelect: () => void;
}

/** One hunter below the podium; clicking toggles the score breakdown. */
export default function LeaderboardRow({ entry, isCurrentUser, selected, onSelect }: LeaderboardRowProps) {
  return (
    <button
      type="button"
      aria-expanded={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        isCurrentUser && 'bg-primary/10 hover:bg-primary/15',
      )}
    >
      <span className="flex w-full items-center gap-2">
        <span className="w-6 shrink-0 text-center text-sm text-muted-foreground tabular-nums">{entry.rank}</span>
        <span className="flex min-w-0 flex-1 items-center gap-0">
          <span className="min-w-0 truncate text-sm font-medium">
            {entry.name}
          </span>
          {isCurrentUser && <span className="ml-1 shrink-0 text-sm font-medium text-muted-foreground">(jij)</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Badge variant="secondary">🎯 {entry.hunts}</Badge>
          <Badge variant="secondary">🧩 {entry.hints}</Badge>
          <Badge variant="secondary" className={cn(entry.distanceKm === 0 && 'hidden sm:inline-flex')}>
            🛣 {formatKm(entry.distanceKm)} km
          </Badge>
        </span>
        <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{entry.score}</span>
      </span>
      {selected && <span className="pl-18 text-xs text-muted-foreground">{breakdownText(entry)}</span>}
    </button>
  );
}
