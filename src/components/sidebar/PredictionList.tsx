import { RefObject, useState } from 'react';
import { InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { MapRef } from '@/components/Map';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { usePredictions } from '@/hooks/predictions.hook';
import useInterval from '@/hooks/utils/interval.hook';
import useSidebarStore from '@/stores/sidebar.store';
import { ageLabel, CONFIDENCE_COLOR, CONFIDENCE_LABEL, formatClock, formatProbability, predictionStatusText } from '@/lib/prediction';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import type { Prediction } from '@/types/Prediction';

const FLY_TO_ZOOM = 14;
const TICK_MS = 30_000;

/** One card per fox team: AI pin, top-3 groups as bars with ETA; tap flies to the pin, ⓘ shows the AI's reason. */
export default function PredictionList({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { predictions } = usePredictions();
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), TICK_MS);

  if (!predictions) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }
  if (predictions.length === 0) return <p className="text-xs text-muted-foreground">Nog geen voorspellingen.</p>;

  function flyTo(prediction: Prediction) {
    const point = prediction.pin ?? prediction.lastObservation;
    if (!point) return;
    mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: FLY_TO_ZOOM, duration: 1500 });
    // On phones, lower the bottom sheet so the pin is visible
    setSheetSnap('peek');
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {predictions.map((prediction) => {
        const color = getColorFromArea(prediction.area);
        const status = predictionStatusText(prediction);
        return (
          <li
            key={prediction.area}
            data-prediction-area={prediction.area}
            className={cn('relative overflow-hidden rounded-lg border bg-card pl-3 text-xs', prediction.stale && 'opacity-60')}
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />
            <div className="flex items-center gap-1.5 py-1.5 pr-1">
              <button
                type="button"
                onClick={() => flyTo(prediction)}
                disabled={!prediction.pin && !prediction.lastObservation}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-semibold disabled:cursor-default"
              >
                {capitalizeFirstLetter(prediction.area)}
                {prediction.confidence && (
                  <span
                    className={cn('size-2 shrink-0 rounded-full', CONFIDENCE_COLOR[prediction.confidence])}
                    title={CONFIDENCE_LABEL[prediction.confidence]}
                    aria-label={CONFIDENCE_LABEL[prediction.confidence]}
                  />
                )}
              </button>
              {prediction.stale && (
                <TriangleAlertIcon className="size-3.5 shrink-0 text-amber-600" aria-label={prediction.error ?? 'Verouderd'}>
                  <title>{prediction.error ?? 'Verouderd'}</title>
                </TriangleAlertIcon>
              )}
              <span className="shrink-0 tabular-nums text-muted-foreground" title={`Bijgewerkt ${formatClock(prediction.updatedAt)}`}>
                {ageLabel(prediction.updatedAt, now)}
              </span>
              {prediction.why && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label="Waarom?">
                      <InfoIcon className="size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="left" className="w-56 p-2 text-xs">
                    {prediction.why}
                  </PopoverContent>
                </Popover>
              )}
            </div>
            {status ? (
              <p className="truncate pb-1.5 pr-2 text-muted-foreground">{status}</p>
            ) : (
              <button type="button" onClick={() => flyTo(prediction)} className="flex w-full flex-col gap-1 pb-2 pr-2 text-left">
                {prediction.candidates.map((candidate) => (
                  <span key={candidate.teamApiId} className="grid grid-cols-[minmax(0,1fr)_3.5rem_2.25rem_2.75rem] items-center gap-1.5">
                    <span className="truncate">{candidate.name}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full" style={{ width: `${Math.round(candidate.probability * 100)}%`, backgroundColor: color }} />
                    </span>
                    <span className="text-right tabular-nums">{formatProbability(candidate.probability)}</span>
                    <span className="rounded bg-muted px-1 text-center tabular-nums">{formatClock(candidate.eta)}</span>
                  </span>
                ))}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
