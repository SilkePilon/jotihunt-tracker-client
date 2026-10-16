import { useMemo } from 'react';
import { ChevronDownIcon, NavigationIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { hiddenMembersText, memberAgeLabel, membersMenuList, membersPillText, sortMembersForList } from '@/lib/life360';
import { TRIGGER_OPEN } from '@/lib/menu-styles';
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

/** "<avatars> Jotihunt 2026 · 6 leden ▾" pill; the dropdown lists only sharing members (a click flies to their marker) and counts the rest. */
export default function Life360MembersMenu({ circleName, memberCount, members, now, onFlyTo }: Life360MembersMenuProps) {
  const sorted = useMemo(() => sortMembersForList(members ?? []), [members]);
  const { sharing, hiddenCount } = useMemo(() => membersMenuList(members ?? []), [members]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className={cn('group/pill max-w-full rounded-full', TRIGGER_OPEN)}>
          {sorted.length > 0 && (
            <span className="flex shrink-0">
              {sorted.slice(0, 3).map((member, index) => (
                <Life360Avatar
                  key={member.id}
                  member={member}
                  size={20}
                  className={cn('ring-2 ring-secondary group-data-[state=open]/pill:ring-(--map-selected-bg)', index > 0 && '-ml-1.5')}
                />
              ))}
            </span>
          )}
          <span className="truncate">{membersPillText(circleName, memberCount)}</span>
          <ChevronDownIcon data-chevron className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64">
        {!members ? (
          <DropdownMenuItem disabled>Leden laden…</DropdownMenuItem>
        ) : sharing.length === 0 ? (
          <DropdownMenuItem disabled>Niemand deelt nu locatie</DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuLabel className="flex items-center">
              Live
              <span className="ml-auto font-semibold tabular-nums">{sharing.length}</span>
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {sharing.map((member) => (
                <DropdownMenuItem key={member.id} onSelect={() => onFlyTo(member)} className="group/row py-2 pl-2">
                  <Life360Avatar member={member} size={26} />
                  <span className="min-w-0 flex-1 truncate">{member.name}</span>
                  <span className="shrink-0 text-[11.5px] font-medium text-muted-foreground tabular-nums">{memberAgeLabel(member, now)}</span>
                  <NavigationIcon aria-hidden className="size-3.5 opacity-0 transition-opacity duration-150 group-focus/row:opacity-100" />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
        {members && hiddenCount > 0 && <p className="px-1 pt-2 text-center text-[11.5px] text-muted-foreground">{hiddenMembersText(hiddenCount)}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
