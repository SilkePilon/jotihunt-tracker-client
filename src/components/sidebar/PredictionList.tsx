import { RefObject, useState } from 'react';
import { FootprintsIcon, TrainFrontIcon, TriangleAlertIcon } from 'lucide-react';
import { MapRef } from '@/components/Map';
import { Skeleton } from '@/components/ui/skeleton';
import { usePredictions } from '@/hooks/predictions.hook';
import useInterval from '@/hooks/utils/interval.hook';
import useSidebarStore from '@/stores/sidebar.store';
import { candidateLabel, formatClock, isPredictionStale, predictionAccuracyText, predictionStatusText } from '@/lib/prediction';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import type { Prediction } from '@/types/Prediction';

const FLY_TO_ZOOM = 13;
const STALE_CHECK_MS = 30_000;

/** One row per fox team: top-1 group, probability, ETA, mode and accuracy; click flies to the zone. */
export default function PredictionList({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { predictions } = usePredictions();
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), STALE_CHECK_MS);

  if (!predictions) {
    return (
      <div className="flex flex-col gap-1">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-9 rounded-md" />
        ))}
      </div>
    );
  }

  if (predictions.length === 0) {
    return <p className="text-xs text-muted-foreground">Nog geen voorspellingen.</p>;
  }

  function flyTo(prediction: Prediction) {
    if (!prediction.lastObservation) return;
    mapRef.current?.flyTo({ center: [prediction.lastObservation.lng, prediction.lastObservation.lat], zoom: FLY_TO_ZOOM, duration: 1500 });
    // On phones, lower the bottom sheet so the zone is visible
    setSheetSnap('peek');
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {predictions.map((prediction) => {
        const top = prediction.candidates[0];
        const status = predictionStatusText(prediction);
        const accuracy = predictionAccuracyText(prediction);
        const stale = isPredictionStale(prediction, now);
        return (
          <li key={prediction.area}>
            <button
              type="button"
              data-prediction-area={prediction.area}
              disabled={!prediction.lastObservation}
              onClick={() => flyTo(prediction)}
              className={cn(
                'flex w-full flex-col gap-0.5 rounded-md px-1.5 py-1 text-left text-xs',
                prediction.lastObservation ? 'cursor-pointer hover:bg-muted' : 'cursor-default',
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(prediction.area) }} />
                <span className="font-semibold">{capitalizeFirstLetter(prediction.area)}</span>
                {prediction.estimate && <span className="text-muted-foreground">(schatting)</span>}
                {stale && (
                  <span className="text-muted-foreground" title={`Bijgewerkt ${formatClock(prediction.updatedAt)}`}>
                    verouderd
                  </span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
                  {prediction.mode === 'transit' ? (
                    <TrainFrontIcon className="size-3.5" aria-label="Lopen en openbaar vervoer" />
                  ) : (
                    <FootprintsIcon className="size-3.5" aria-label="Lopend" />
                  )}
                  {accuracy}
                </span>
              </span>
              {status || !top ? (
                <span className="truncate text-muted-foreground">{status}</span>
              ) : (
                <span className="flex min-w-0 items-center gap-1">
                  <span className="truncate">{top.name}</span>
                  {top.via === 'transit' && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <span aria-hidden="true">·</span>
                      <TrainFrontIcon className="size-3" aria-label="Openbaar vervoer" />
                      {top.transitLabel}
                    </span>
                  )}
                  <span className="shrink-0">· {candidateLabel(top)}</span>
                </span>
              )}
              {prediction.transitUnavailable && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <TriangleAlertIcon className="size-3 shrink-0" aria-hidden="true" />
                  OV-gegevens niet beschikbaar
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
