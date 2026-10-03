import { useState } from 'react';
import { useAreas } from '@/hooks/areas.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { usePredictions, usePredictionSetting } from '@/hooks/predictions.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { huntCooldownMs, lastHuntTimeFor } from '@/lib/fox-status';
import { formatClock, formatCountdown } from '@/lib/format';
import { CONFIDENCE_LABEL } from '@/lib/prediction';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';

const TILE_CLASS: Record<string, string> = {
  green: 'border-green-500 bg-green-500/15',
  orange: 'border-orange-500 bg-orange-500/15',
  red: 'border-red-500 bg-red-500/15',
};
const STATUS_LABEL: Record<string, string> = { green: 'Groen', orange: 'Oranje', red: 'Rood' };

export default function AreaTiles() {
  const { areas } = useAreas();
  const { hunts } = useHunts();
  const { reports } = useHuntReports();
  const { enabled: predictionEnabled } = usePredictionSetting();
  const { predictions } = usePredictions();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);

  return (
    <div className="grid grid-cols-3 gap-2">
      {(areas ?? []).map((area) => {
        const lastHunt = lastHuntTimeFor(hunts, area.name, reports);
        const cooldown = huntCooldownMs(lastHunt, now);
        const prediction = predictions?.find((item) => item.area.toLowerCase() === area.name.toLowerCase());
        return (
          <div key={area._id} className={cn('rounded-lg border-2 p-2', TILE_CLASS[area.status] ?? 'border-gray-400')}>
            <div className="flex items-center gap-1.5 text-lg font-bold">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: getColorFromArea(area.name) }} />
              {capitalizeFirstLetter(area.name)}
            </div>
            <div className="text-sm font-medium">{cooldown > 0 ? <span className="text-blue-500 tabular-nums">Cooldown {formatCountdown(cooldown)}</span> : (STATUS_LABEL[area.status] ?? area.status)}</div>
            <div className="text-xs text-muted-foreground">Hunt: {lastHunt ? formatClock(lastHunt) : '–'}</div>
            {predictionEnabled !== false && prediction?.lastObservation && (
              <div className="text-xs text-muted-foreground">
                {prediction.lastObservation.kind}: {formatClock(prediction.lastObservation.time)}
              </div>
            )}
            {predictionEnabled !== false && prediction?.confidence && <div className="text-xs text-muted-foreground">{CONFIDENCE_LABEL[prediction.confidence]}</div>}
          </div>
        );
      })}
    </div>
  );
}
