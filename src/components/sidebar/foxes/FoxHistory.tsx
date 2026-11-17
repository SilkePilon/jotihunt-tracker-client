import { Fragment, type RefObject, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EyeIcon, EyeOffIcon, LockIcon, MapPinIcon } from 'lucide-react';
import type { MapRef } from '@/components/Map';
import AutoHeight from '@/components/motion/AutoHeight';
import LoadError from '@/components/LoadError';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreaHistory } from '@/hooks/area-history.hook';
import { useEdition } from '@/hooks/edition.hook';
import { useMarkers } from '@/hooks/markers.hook';
import { useNow } from '@/hooks/now.hook';
import { historyModel, historyStatusLine } from '@/lib/fox-history';
import type { SidebarFox } from '@/lib/fox-status';
import { activatedByKeyboard } from '@/lib/input-modality';
import { FOX_MARKERS_LAYER } from '@/lib/map-layers';
import { latestAreaMarker, latestMarkerLabel } from '@/lib/markers';
import { EASE_OUT, POP, SWAP } from '@/lib/motion';
import { TONAL_BUTTON } from '@/lib/tonal-button';
import { cn, getColorFromArea } from '@/lib/utils';
import useHuntFocusStore from '@/stores/hunt-focus.store';
import useSidebarStore from '@/stores/sidebar.store';
import FoxHistoryTimeline from './FoxHistoryTimeline';

/** The window plays in once the panel's open spring has (mostly) settled. */
const PLAY_DELAY_MS = 300;
const MINUTE_MS = 60_000;
const FLY_TO_ZOOM = 16;

/** The fold-out's tonal buttons: full width, 36px like "Open Intel" (44px on touch) */
const SMALL_TONAL = cn(
  TONAL_BUTTON,
  'inline-flex w-full min-w-0 cursor-pointer items-center justify-center gap-2 px-3 text-sm font-semibold outline-none pointer-coarse:h-11 focus-visible:ring-[3px] focus-visible:ring-ring [&_svg]:size-4',
);

interface FoxHistoryProps {
  fox: SidebarFox;
  hidden: boolean;
  /** Outside the areas our group may hunt (huntable areas): said in words under the status line, not only by the chip's lock */
  forbidden?: boolean;
  onToggleHidden: () => void;
  /** For "Naar laatste hint/hunt" (flies there and opens the marker's popup); without it the button doesn't show */
  mapRef?: RefObject<MapRef | null>;
}

/** "Verberg op kaart" / "Weer tonen": both labels share one grid cell, so the button keeps its width and only fades. */
function HideButton({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  const options = [
    { on: !hidden, icon: EyeOffIcon, label: 'Verberg op kaart' },
    { on: hidden, icon: EyeIcon, label: 'Weer tonen' },
  ];
  return (
    <button type="button" onClick={onClick} aria-label={hidden ? 'Weer tonen op kaart' : 'Verberg op kaart'} className={cn(SMALL_TONAL, 'inline-grid')}>
      {options.map(({ on, icon: Icon, label }) => (
        <span
          key={label}
          aria-hidden
          className={cn(
            'col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 transition-[opacity,filter] duration-200 motion-reduce:transition-none',
            on ? 'opacity-100 blur-0' : 'opacity-0 blur-[2px]',
          )}
        >
          <Icon />
          {label}
        </span>
      ))}
    </button>
  );
}

/** Four empty lanes + the axis while the history loads. */
function TimelineSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-[20px_minmax(0,1fr)] pt-1 pb-5">
      {Array.from({ length: 4 }, (_, index) => (
        <Fragment key={index}>
          <div className="flex h-[22px] items-center">
            <Skeleton className="size-3 rounded-[4px]" />
          </div>
          <div className="flex h-[22px] items-center px-1">
            <Skeleton className="h-3 rounded-[4px]" style={{ width: `${[92, 64, 38, 74][index]}%` }} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * The fold-out under a fox's chip: name, status line, the last three hours as a timeline and the hide-on-map button.
 * Fetches only while mounted; the window moves on every minute.
 */
/**
 * "Naar laatste hint" / "Naar laatste hunt": the area's newest hint or hunt marker. Lowers the phone sheet, flies there, pulses the spot and
 * opens the marker's popup (like a hunt log row); hidden while the area has no such marker.
 */
function LatestMarkerButton({ area, mapRef }: { area: string; mapRef: RefObject<MapRef | null> }) {
  const { markers } = useMarkers();
  const latest = useMemo(() => latestAreaMarker(markers, area), [markers, area]);
  const go = () => {
    if (!latest?._id) return;
    const [lng, lat] = latest.location.coordinates;
    useSidebarStore.getState().setSheetSnap('peek');
    mapRef.current?.flyTo({ center: [lng, lat], zoom: FLY_TO_ZOOM, duration: 1500 });
    useHuntFocusStore.getState().show({ lng, lat, color: getColorFromArea(area) });
    mapRef.current?.openFeature(FOX_MARKERS_LAYER, latest._id, { focus: activatedByKeyboard() });
  };
  return (
    <AnimatePresence initial={false}>
      {latest && (
        <motion.button key="latest" type="button" onClick={go} {...POP} className={SMALL_TONAL}>
          <MapPinIcon aria-hidden />
          {/* Hint or hunt, whichever is newest: the word swaps when a newer one of the other kind comes in */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={latestMarkerLabel(latest)} {...SWAP}>
              {latestMarkerLabel(latest)}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default function FoxHistory({ fox, hidden, forbidden = false, onToggleHidden, mapRef }: FoxHistoryProps) {
  const reduced = useReducedMotion() ?? false;
  const { history, error, mutate } = useAreaHistory(fox.area.name);
  const now = useNow(true, MINUTE_MS);
  const model = useMemo(() => (history ? historyModel(history, now) : undefined), [history, now]);
  const { readOnly } = useEdition();
  // The status word comes from the local fox data, so it shows while loading and after a failed fetch; the counts need the history
  const line = useMemo(() => historyStatusLine(fox.area, history, now, readOnly), [fox.area, history, now, readOnly]);

  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setOpened(true), PLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // A retry shows the skeleton again (SWR keeps the old error until the new answer is in)
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    setRetrying(true);
    void mutate()
      .catch(() => undefined)
      .finally(() => setRetrying(false));
  };

  const scene = model ? 'ready' : error && !retrying ? 'error' : 'loading';
  const swap = reduced ? { ...SWAP, transition: { duration: 0 } } : SWAP;

  return (
    <div className="rounded-2xl bg-card p-2.5 text-foreground">
      <div className="mx-0.5 flex items-baseline justify-between text-caption font-medium">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(fox.area.name) }} />
          <span className="truncate">{fox.name}</span>
        </span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground desk:text-label">laatste 3 uur</span>
      </div>

      {/* Status line: the word swaps (fade + blur-up) when the status changes */}
      <div className="mx-0.5 mt-0.5 flex min-h-4 flex-wrap items-center text-xs text-muted-foreground tabular-nums">
        <span className="relative inline-flex">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={line.status ?? 'none'}
              className="whitespace-nowrap"
              initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={reduced ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
            >
              {line.word}
            </motion.span>
          </AnimatePresence>
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          {line.rest !== null ? (
            <motion.span key="rest" className="inline-flex items-center" {...swap}>
              {line.rest.split(' · ').map((part, index) => (
                <Fragment key={index}>
                  <span className="px-1 opacity-50">·</span>
                  {part}
                </Fragment>
              ))}
            </motion.span>
          ) : (
            scene === 'loading' && (
              <motion.span key="loading" className="ml-2 inline-flex" {...swap}>
                <Skeleton className="h-2.5 w-24" />
              </motion.span>
            )
          )}
        </AnimatePresence>
      </div>

      <Reveal>
        {forbidden && (
          <p className="mx-0.5 mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <LockIcon aria-hidden className="size-3 shrink-0" strokeWidth={2.5} />
            Niet toegestaan voor onze groep · 0 punten
          </p>
        )}
      </Reveal>

      <AutoHeight scene={scene} className="mt-1">
        <AnimatePresence mode="wait" initial={false}>
          {model ? (
            <motion.div key="ready" {...swap}>
              <FoxHistoryTimeline model={model} playKey={fox.key} play={opened || reduced} />
            </motion.div>
          ) : scene === 'error' ? (
            <motion.div key="error" {...swap}>
              {/* The shared "couldn't load" line + tonal retry button; a retry shows the skeleton again */}
              <LoadError centered className="py-4" message="Historie kon niet worden geladen." onRetry={retry} />
            </motion.div>
          ) : (
            <motion.div key="loading" {...swap}>
              <TimelineSkeleton />
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>

      <div className="mt-2 flex flex-col gap-1.5">
        {mapRef && <LatestMarkerButton area={fox.area.name} mapRef={mapRef} />}
        <HideButton hidden={hidden} onClick={onToggleHidden} />
      </div>
    </div>
  );
}
