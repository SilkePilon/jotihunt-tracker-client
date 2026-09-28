import { useState } from 'react';
import { useAreas } from '@/hooks/areas.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { Skeleton } from '@/components/ui/skeleton';
import { cooldownSummary, huntCooldownMs, lastHuntTimeFor, statusPillClass } from '@/lib/fox-status';
import { formatHintCountdown } from '@/lib/next-hint';
import { cn, getColorFromArea } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

const STATUS_LABEL: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood' };

export default function FoxPills() {
  const { areas, toggleHidden, isHidden } = useAreas();
  const { hunts } = useHunts();
  const { reports } = useHuntReports();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);

  if (!areas) {
    return (
      <div className="grid grid-cols-9 gap-1">
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="h-7 rounded-full" />
        ))}
      </div>
    );
  }

  const cooldowns = cooldownSummary(areas, hunts, now, reports);

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-9 gap-1">
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
                'relative h-7 cursor-pointer rounded-full border text-xs font-semibold transition-opacity',
                cooldown > 0 ? 'border-blue-400 bg-blue-100 text-blue-700' : statusPillClass(area.status),
                hidden && 'opacity-40',
              )}
            >
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-white" style={{ backgroundColor: getColorFromArea(area.name) }} />
              {area.name.charAt(0).toUpperCase()}
            </button>
          );
        })}
      </div>
      {cooldowns && <p className="text-xs text-muted-foreground">Weer te hunten: {cooldowns}</p>}
    </div>
  );
}
