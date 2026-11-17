import { RefObject, useRef, useState } from 'react';
import { PauseIcon, TriangleAlertIcon } from 'lucide-react';
import { MapRef } from '@/components/Map';
import { AnimatePresence, motion } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import LoadError from '@/components/LoadError';
import { loadState } from '@/lib/load-state';
import { SWAP } from '@/lib/motion';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePredictions } from '@/hooks/predictions.hook';
import { AGE_CLOCK_TICK_MS, useNow } from '@/hooks/now.hook';
import useSidebarStore from '@/stores/sidebar.store';
import { ageLabel, CONFIDENCE_LABEL, CONFIDENCE_LEVEL, predictionStatusText } from '@/lib/prediction';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import type { Confidence, Prediction } from '@/types/Prediction';

const FLY_TO_ZOOM = 14;

/** Dark text on the light area colours, white text on the dark ones (Hotel). */
function textColorOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#18181b' : '#ffffff';
}

/**
 * A coloured (active) chip's background and text. Stale: the area colour fades into the card behind it, and the text
 * switches to the theme's foreground, which stays readable on that lighter (light theme) or darker (dark theme) tint.
 */
function chipColors(color: string, stale: boolean): { backgroundColor: string; color: string } {
  if (stale) return { backgroundColor: `color-mix(in oklab, ${color} 45%, transparent)`, color: 'var(--foreground)' };
  return { backgroundColor: color, color: textColorOn(color) };
}

/** Neutral 3-bar signal icon (no traffic-light colours, those mean fox status). */
function ConfidenceBars({ confidence }: { confidence: Confidence }) {
  const level = CONFIDENCE_LEVEL[confidence];
  return (
    <span className="flex h-3 shrink-0 items-end gap-px" aria-label={CONFIDENCE_LABEL[confidence]} role="img">
      {[1, 2, 3].map((bar) => (
        <span key={bar} className={cn('w-[3px] rounded-[1px] bg-current', bar > level && 'opacity-30')} style={{ height: `${4 + bar * 3}px` }} />
      ))}
    </span>
  );
}

/** One pill per fox team in its colour with the AI confidence; tap flies to the pin and shows the AI's reason in a tooltip. */
export default function PredictionList({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { predictions, isError, retry } = usePredictions();
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const now = useNow(true, AGE_CLOCK_TICK_MS);
  const [openArea, setOpenArea] = useState<string | null>(null);
  // Radix closes a tooltip on pointerdown of its trigger; remember the state before that so a tap toggles
  const wasOpen = useRef(false);

  const view = loadState(predictions, isError);

  function flyTo(prediction: Prediction) {
    const point = prediction.pin ?? prediction.lastObservation;
    if (!point) return;
    // On phones, lower the bottom sheet so the pin is visible (before the fly, which pads for the new snap)
    setSheetSnap('peek');
    mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: FLY_TO_ZOOM, duration: 1500 });
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {view === 'loading' ? (
        <motion.div key="loading" {...SWAP} className="flex flex-wrap gap-1.5" role="status" aria-label="Voorspellingen laden">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="h-7 w-20 rounded-badge" />
          ))}
        </motion.div>
      ) : view === 'error' ? (
        <motion.div key="error" {...SWAP}>
          <LoadError message="Voorspellingen konden niet worden geladen." onRetry={retry} />
        </motion.div>
      ) : !predictions || predictions.length === 0 ? (
        <motion.p key="empty" {...SWAP} className="text-xs text-muted-foreground">
          Nog geen voorspellingen.
        </motion.p>
      ) : (
        // isolate: the chips' 44px touch areas on phones (COARSE_HIT_AREA) stay above the card's background
        <motion.div key="list" {...SWAP} className="isolate flex flex-wrap gap-1.5">
          {predictions.map((prediction) => {
            const color = getColorFromArea(prediction.area);
            const status = predictionStatusText(prediction);
            const active = !prediction.paused && !!prediction.pin;
            const text = prediction.why || status || 'Geen toelichting';
            return (
              <Tooltip
                key={prediction.area}
                open={openArea === prediction.area}
                onOpenChange={(open) => setOpenArea((current) => (open ? prediction.area : current === prediction.area ? null : current))}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-prediction-area={prediction.area}
                    onPointerDown={() => (wasOpen.current = openArea === prediction.area)}
                    onClick={() => {
                      setOpenArea(wasOpen.current ? null : prediction.area);
                      if (!wasOpen.current) flyTo(prediction);
                    }}
                    className={cn(
                      // Keyboard focus: an outline in --ring, so it shows over the open state's area-coloured ring too
                      'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-badge px-2.5 text-xs font-semibold transition-[transform,box-shadow,background-color] outline-none active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      COARSE_HIT_AREA,
                      // Stale: only the background softens; text and icons keep full contrast
                      !active && (prediction.stale ? 'bg-muted/60 text-muted-foreground' : 'bg-muted text-muted-foreground'),
                      openArea === prediction.area && 'ring-2 ring-offset-2 ring-offset-card',
                    )}
                    style={{ ...(active && chipColors(color, !!prediction.stale)), ...(openArea === prediction.area && { ['--tw-ring-color' as string]: color }) }}
                  >
                    {prediction.paused && <PauseIcon className="size-3" aria-label="Gepauzeerd" />}
                    {capitalizeFirstLetter(prediction.area)}
                    {active && prediction.confidence && <ConfidenceBars confidence={prediction.confidence} />}
                    {prediction.stale && <TriangleAlertIcon className="size-3" aria-label="Verouderd" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-60">
                  <p className="font-semibold">
                    {capitalizeFirstLetter(prediction.area)} <span className="font-normal text-muted-foreground tabular-nums">· {ageLabel(prediction.updatedAt, now)}</span>
                  </p>
                  <p>{text}</p>
                  {prediction.stale && prediction.error && <p className="text-muted-foreground">{prediction.error}</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
