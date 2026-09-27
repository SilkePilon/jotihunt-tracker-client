import { RefObject } from 'react';
import { FootprintsIcon, TrainFrontIcon, TriangleAlertIcon } from 'lucide-react';
import { MapRef } from '@/components/Map';
import { Skeleton } from '@/components/ui/skeleton';
import { usePredictions } from '@/hooks/predictions.hook';
import { accuracyLabel, candidateLabel, predictionStatusText } from '@/lib/prediction';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import type { Prediction } from '@/types/Prediction';

const FLY_TO_ZOOM = 13;

/** One row per fox team: top-1 group, probability, ETA, mode and accuracy; click flies to the zone. */
export default function PredictionList({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { predictions } = usePredictions();

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
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {predictions.map((prediction) => {
        const top = prediction.candidates[0];
        const status = predictionStatusText(prediction);
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
                <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                  {prediction.transitUnavailable && (
                    <TriangleAlertIcon className="size-3.5 text-amber-500" aria-label="OV-gegevens niet beschikbaar" />
                  )}
                  {prediction.mode === 'transit' ? (
                    <TrainFrontIcon className="size-3.5" aria-label="Lopen en openbaar vervoer" />
                  ) : (
                    <FootprintsIcon className="size-3.5" aria-label="Lopend" />
                  )}
                  {accuracyLabel(prediction.accuracy)}
                </span>
              </span>
              <span className={cn('truncate', status && 'text-muted-foreground')}>{status ?? `${top.name} · ${candidateLabel(top)}`}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
