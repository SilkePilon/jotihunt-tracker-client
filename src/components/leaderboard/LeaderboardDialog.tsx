import { Fragment, useState } from 'react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { Separator } from '@/components/ui/separator';
import { useLeaderboard } from '@/hooks/leaderboard.hook';
import { teamStripText, windowText } from '@/lib/leaderboard';
import type { User } from '@/types/User';
import LeaderboardRow from './LeaderboardRow';
import Podium from './Podium';

interface LeaderboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Fun ranking of all hunters: podium for the top 3, team totals and the rest as a list. */
export default function LeaderboardDialog({ open, onOpenChange }: LeaderboardDialogProps) {
  const { board, isLoading, isError } = useLeaderboard(open);
  const currentUserId = useAuthUser<User>()?._id;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggle = (userId: string) => setSelectedId((current) => (current === userId ? null : userId));

  function close() {
    setSelectedId(null);
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={open} onClose={close} title="Leaderboard" description="Wie heeft dit weekend het meest bijgedragen?" className="h-auto sm:max-w-xl">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {isError && !board ? (
          <p className="text-sm text-muted-foreground">Leaderboard kon niet geladen worden.</p>
        ) : isLoading || !board ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : (
          <>
            <Podium entries={board.entries} currentUserId={currentUserId} selectedId={selectedId} onSelect={toggle} />
            <p className="text-center text-sm text-balance text-muted-foreground">
              {/* Wrap between the parts, never inside one ("6 hints") */}
              {teamStripText(board)
                .split(' · ')
                .map((part, index) => (
                  <Fragment key={index}>
                    {index > 0 && ' · '}
                    <span className="whitespace-nowrap">{part}</span>
                  </Fragment>
                ))}
            </p>
            <Separator />
            {board.entries.length > 3 && (
              <div className="flex flex-col gap-1">
                {board.entries.slice(3).map((entry) => (
                  <LeaderboardRow key={entry.userId} entry={entry} isCurrentUser={entry.userId === currentUserId} selected={entry.userId === selectedId} onSelect={() => toggle(entry.userId)} />
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{windowText(board)}</p>
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
}
