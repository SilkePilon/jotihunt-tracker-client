import { useMemo } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isLocationStale, memberAgeLabel, membersPillText, sortMembersForList } from '@/lib/life360';
import { cn } from '@/lib/utils';
import type { Life360Member } from '@/types/Life360';
import Life360Avatar from './Life360Avatar';

interface Life360MembersMenuProps {
  circleName: string;
  memberCount: number;
  /** undefined while loading */
  members: Life360Member[] | undefined;
  now: number;
  /** Fly the map to a sharing member */
  onFlyTo: (member: Life360Member) => void;
}

/** "<avatars> Jotihunt 2026 · 6 leden ▾" pill; the dropdown lists every member, a click flies to their marker. */
export default function Life360MembersMenu({ circleName, memberCount, members, now, onFlyTo }: Life360MembersMenuProps) {
  const sorted = useMemo(() => sortMembersForList(members ?? []), [members]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="max-w-full rounded-full">
          {sorted.length > 0 && (
            <span className="flex shrink-0">
              {sorted.slice(0, 3).map((member, index) => (
                <Life360Avatar key={member.id} member={member} size={20} className={cn('ring-2 ring-secondary', index > 0 && '-ml-1.5')} />
              ))}
            </span>
          )}
          <span className="truncate">{membersPillText(circleName, memberCount)}</span>
          <ChevronDownIcon className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64">
        {!members ? (
          <DropdownMenuItem disabled>Leden laden…</DropdownMenuItem>
        ) : sorted.length === 0 ? (
          <DropdownMenuItem disabled>Nog geen leden</DropdownMenuItem>
        ) : (
          sorted.map((member) => {
            const old = !!member.location && isLocationStale(member.location, false, now);
            return (
              <DropdownMenuItem key={member.id} disabled={!member.location} onSelect={() => onFlyTo(member)}>
                <Life360Avatar member={member} size={24} />
                <span className="min-w-0 flex-1 truncate">{member.name}</span>
                <span className={cn('shrink-0 text-[11px] text-muted-foreground tabular-nums', old && 'font-medium text-amber-600 dark:text-amber-400')}>{memberAgeLabel(member, now)}</span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
