import { useState } from 'react';
import CookieBadge from '@/components/tracker/CookieBadge';
import { inlineLinkClass } from '@/components/tracker/styles';
import { useNow } from '@/hooks/now.hook';
import { life360LiveLine, refreshAllowed } from '@/lib/life360';
import { cn } from '@/lib/utils';
import type { Life360LinkedStatus, Life360Member } from '@/types/Life360';
import Life360MembersMenu from './Life360MembersMenu';

interface Life360LinkedProps {
  status: Life360LinkedStatus;
  members: Life360Member[] | undefined;
  /** Ask Life360 for fresh fixes (toasts inside) */
  onRefresh: () => Promise<void>;
  /** An archive edition is shown: "ververs" is refused (423), so it's disabled */
  readOnly?: boolean;
  onFlyTo: (member: Life360Member) => void;
}

/** Linked (mockup A): green cookie, "Gekoppeld", live count + last poll + "ververs", members pill. */
export default function Life360Linked({ status, members, readOnly, onRefresh, onFlyTo }: Life360LinkedProps) {
  const now = useNow(true);
  const [refreshing, setRefreshing] = useState(false);
  const canRefresh = !refreshing && !readOnly && refreshAllowed(status.refreshAvailableAt, now);

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-0.5 pt-1 pb-0.5 text-center" data-life360-state="linked">
      <CookieBadge tone="ok" size={72} />
      <p className="mt-2 text-base font-bold">Gekoppeld</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {life360LiveLine(status, now)} ·{' '}
        <button type="button" className={cn(inlineLinkClass, 'disabled:cursor-default disabled:text-muted-foreground disabled:no-underline')} disabled={!canRefresh} onClick={() => void refresh()}>
          ververs
        </button>
      </p>
      <div className="mt-2.5 max-w-full">
        <Life360MembersMenu circleName={status.circleName} memberCount={status.memberCount} members={members} now={now} onFlyTo={onFlyTo} />
      </div>
    </div>
  );
}
