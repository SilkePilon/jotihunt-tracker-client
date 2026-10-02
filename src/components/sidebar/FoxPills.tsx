import { useState } from 'react';
import { useAreas } from '@/hooks/areas.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { Skeleton } from '@/components/ui/skeleton';
import { COOLDOWN_PILL_CLASS, huntCooldownMs, lastHuntTimeFor, statusPillClass } from '@/lib/fox-status';
import { formatHintCountdown } from '@/lib/next-hint';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

const STATUS_LABEL: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood' };

const LEGEND = [
  { label: 'actief', dot: 'bg-green-500' },
  { label: 'onderweg', dot: 'bg-orange-500' },
  { label: 'inactief', dot: 'bg-red-500' },
  { label: 'cooldown', dot: 'bg-blue-500' },
];

export default function FoxPills() {
  const { areas, toggleHidden, isHidden } = useAreas();
  const { hunts } = useHunts();
  const { reports } = useHuntReports();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);

  if (!areas) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-16 rounded-badge" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {areas.map((area) => {
          const lastHunt = lastHuntTimeFor(hunts, area.name, reports);
          const cooldown = huntCooldownMs(lastHunt, now);
          const hidden = isHidden(area.name);
          const ago = (time: Date | string) => formatDistanceToNow(new Date(time), { locale: nl, addSuffix: true });
          const title =
            `${area.name}: ${STATUS_LABEL[area.status] ?? area.status} (bijgewerkt ${ago(area.updatedAt)})` +
            ` · laatste hunt: ${lastHunt ? ago(lastHunt) : 'nog geen'}` +
            (cooldown > 0 ? ` · weer te hunten over ${formatHintCountdown(cooldown)}` : '') +
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
                'inline-flex h-6 cursor-pointer items-center gap-1 rounded-badge border px-1.5 text-xs font-medium transition-opacity hover:brightness-95',
                cooldown > 0 ? COOLDOWN_PILL_CLASS : statusPillClass(area.status),
                hidden && 'opacity-40',
              )}
            >
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area.name) }} />
              {capitalizeFirstLetter(area.name)}
              {cooldown > 0 && <span className="tabular-nums">{formatHintCountdown(cooldown)}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span className={cn('size-2 rounded-full', item.dot)} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
