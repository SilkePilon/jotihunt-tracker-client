import { useState } from 'react';
import { useAreas } from '@/hooks/areas.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { Skeleton } from '@/components/ui/skeleton';
import { huntCooldownMs, lastHuntTimeFor } from '@/lib/fox-status';
import { formatCountdown } from '@/lib/format';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

const STATUS_LABEL: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood' };

type GroupKey = 'green' | 'orange' | 'red' | 'cooldown';

const GROUPS: { key: GroupKey; label: string; dot: string; text: string }[] = [
  { key: 'green', label: 'Actief', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400' },
  { key: 'orange', label: 'Onderweg', dot: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  { key: 'red', label: 'Inactief', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
  { key: 'cooldown', label: 'Cooldown', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
];

export default function FoxPills() {
  const { areas, toggleHidden, isHidden } = useAreas();
  const { hunts } = useHunts();
  const { reports } = useHuntReports();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);

  if (!areas) {
    return (
      <div className="flex flex-col gap-3">
        {GROUPS.map((group) => (
          <div key={group.key} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-1 pl-4">
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const ago = (time: Date | string) => formatDistanceToNow(new Date(time), { locale: nl, addSuffix: true });
  const foxes = areas.map((area) => {
    const lastHunt = lastHuntTimeFor(hunts, area.name, reports);
    const cooldown = huntCooldownMs(lastHunt, now);
    // A fox in its hunt cooldown is listed under cooldown; an unknown status counts as inactive
    const group: GroupKey = cooldown > 0 ? 'cooldown' : area.status === 'green' || area.status === 'orange' ? area.status : 'red';
    return { area, lastHunt, cooldown, group };
  });

  return (
    <div className="flex flex-col gap-3">
      {GROUPS.map((group) => {
        const members = foxes.filter((fox) => fox.group === group.key);
        return (
          <div key={group.key} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className={cn('size-2 shrink-0 rounded-full', group.dot)} />
              <span className={cn('text-xs font-medium', group.text)}>{group.label}</span>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] tabular-nums text-muted-foreground">{members.length}</span>
            </div>
            <div className="flex flex-wrap gap-1 pl-4">
              {members.length === 0 && <span className="text-xs italic text-muted-foreground/70">geen</span>}
              {members.map(({ area, lastHunt, cooldown }) => {
                const hidden = isHidden(area.name);
                const title =
                  `${area.name}: ${STATUS_LABEL[area.status] ?? area.status} (bijgewerkt ${ago(area.updatedAt)})` +
                  ` · laatste hunt: ${lastHunt ? ago(lastHunt) : 'nog geen'}` +
                  (cooldown > 0 ? ` · weer te hunten over ${formatCountdown(cooldown)}` : '') +
                  (hidden ? ' · verborgen' : '');
                return (
                  <button
                    key={area._id}
                    type="button"
                    title={title}
                    aria-label={title}
                    aria-pressed={!hidden}
                    onClick={() => toggleHidden(area.name)}
                    className={cn(
                      'inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium transition-opacity hover:bg-accent dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10',
                      hidden && 'opacity-40',
                    )}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area.name) }} />
                    {capitalizeFirstLetter(area.name)}
                    {cooldown > 0 && <span className="tabular-nums text-blue-600 dark:text-blue-300">{formatCountdown(cooldown)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
