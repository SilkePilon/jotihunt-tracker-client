import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { CheckIcon } from 'lucide-react';
import { Layer, Marker, Source, useMap, type FillLayerSpecification, type LineLayerSpecification } from 'react-map-gl/maplibre';
import { useIsMobile } from '@/hooks/media.hook';
import { useMarkers } from '@/hooks/markers.hook';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import {
  guessBounds, guessShapes, type GuessShapeProps, HINT_GUESS_AREA_FILL_LAYER, HINT_GUESS_AREA_LINE_LAYER, HINT_GUESS_REACH_LAYER,
  HINT_GUESS_SOURCE, lastFoxFix, parseGuess, rankGuess,
} from '@/lib/hint-guess';
import { INTEL_CLOSE_MS } from '@/lib/intel-window';
import { cn } from '@/lib/utils';
import useHintGuessStore from '@/stores/hint-guess.store';
import useSidebarStore from '@/stores/sidebar.store';

/** The map's padding ease after the phone sheet moves (Map.tsx easeTo 300 ms), plus a little slack */
const SHEET_EASE_MS = 350;
const AREA_FILTER: FillLayerSpecification['filter'] = ['==', ['get', 'role'], 'area'];
const REACH_FILTER: LineLayerSpecification['filter'] = ['==', ['get', 'role'], 'reach'];
/** Fade of the rectangle and the reach circle (paint *-opacity-transition) */
const SHAPE_FADE_MS = 200;
const SHAPE_FADE = { duration: SHAPE_FADE_MS, delay: 0 };

type Shape = Feature<Polygon, GuessShapeProps>;

/**
 * A shape that fades: while it is gone, the last one stays as data (at opacity 0) for the fade-out, then is dropped.
 * @returns the shape to draw (current or fading out) and whether it should be visible
 */
function useFadingShape(shape: Shape | null): { data: Shape | null; visible: boolean } {
  const [kept, setKept] = useState(shape);
  if (shape && shape !== kept) setKept(shape);
  useEffect(() => {
    if (shape) return;
    const timer = setTimeout(() => setKept(null), SHAPE_FADE_MS);
    return () => clearTimeout(timer);
  }, [shape]);
  return { data: shape ?? kept, visible: !!shape };
}

/**
 * The partly solved hint being typed (hint card or Intel row): numbered candidate dots (tap = fill in that digit), or
 * the rectangle of everything that could match, plus the red dashed reach of the fox since its last known spot.
 */
export default function HintGuess() {
  const input = useHintGuessStore((state) => state.input);
  const pick = useHintGuessStore((state) => state.pick);
  const clear = useHintGuessStore((state) => state.clear);
  const { markers } = useMarkers();
  const dark = useDarkMode();
  const map = useMap().current;
  const isMobile = useIsMobile();

  const guess = useMemo(() => (input ? parseGuess(input.x, input.y) : null), [input]);
  const fix = useMemo(() => (input?.area && input.at !== null ? lastFoxFix(markers ?? [], input.area, input.at) : null), [input, markers]);
  const rank = useMemo(() => (guess ? rankGuess(guess, fix, input?.at ?? null) : null), [guess, fix, input]);
  const shapes = useMemo(() => guessShapes(guess, rank), [guess, rank]);
  const area = useFadingShape(shapes.features.find((feature) => feature.properties.role === 'area') ?? null);
  const reach = useFadingShape(shapes.features.find((feature) => feature.properties.role === 'reach') ?? null);
  const data = useMemo<FeatureCollection<Polygon, GuessShapeProps>>(
    () => ({ type: 'FeatureCollection', features: [area.data, reach.data].filter((feature) => feature !== null) }),
    [area.data, reach.data],
  );

  // Fly to the candidates when the guess itself changes (from Intel: once the window has closed)
  const fitKey = input ? `${input.source}|${input.x}|${input.y}|${input.area}` : '';
  useEffect(() => {
    if (!map || !guess || !input) return;
    const bounds = guessBounds(guess, fix);
    if (!bounds) return;
    // Phones: the sheet covers the map, lower it so the candidates can be tapped. The map's own padding then eases to
    // the peek height (~300 ms, an ease that would cancel our fit) and fitBounds adds its padding on top of it.
    if (isMobile) useSidebarStore.getState().setSheetSnap('peek');
    // From Intel: after the window has closed; phones: after the sheet's padding ease, whichever is later
    const intel = input.source === 'intel';
    const delay = isMobile ? Math.max(SHEET_EASE_MS, intel ? INTEL_CLOSE_MS : 0) : intel ? INTEL_CLOSE_MS : 0;
    const timer = setTimeout(() => {
      // Desktop: the sidebar floats over the map's left edge, keep the candidates out from under it
      const padding = isMobile
        ? { top: 64, right: 32, bottom: 32, left: 32 }
        : { top: 80, right: 80, bottom: 80, left: 80 + (document.querySelector('aside')?.getBoundingClientRect().right ?? 0) };
      map.fitBounds(bounds, { padding, maxZoom: 15, duration: 1200 });
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the guess changes, not on every marker poll
  }, [map, fitKey]);

  // Escape takes the guess off the map, but only when nothing else used that key press: Radix dialogs/popovers close on
  // Escape in the document capture phase and preventDefault it, so this bubble-phase window listener runs after them
  useEffect(() => {
    if (!input) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (target?.closest('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')) return;
      clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input, clear]);

  const purple = dark ? '#b9a6ff' : '#7b61d1';
  const red = dark ? '#ffb4ab' : '#ba1a1a';
  const points = guess?.kind === 'points' ? guess.points : [];

  return (
    <>
      <Source id={HINT_GUESS_SOURCE} type="geojson" data={data}>
        <Layer id={HINT_GUESS_REACH_LAYER} type="line" filter={REACH_FILTER}
               paint={{ 'line-color': red, 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': reach.visible ? 1 : 0, 'line-opacity-transition': SHAPE_FADE }} />
        <Layer id={HINT_GUESS_AREA_FILL_LAYER} type="fill" filter={AREA_FILTER}
               paint={{ 'fill-color': purple, 'fill-opacity': area.visible ? 0.15 : 0, 'fill-opacity-transition': SHAPE_FADE }} />
        <Layer id={HINT_GUESS_AREA_LINE_LAYER} type="line" filter={AREA_FILTER}
               paint={{ 'line-color': purple, 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': area.visible ? 1 : 0, 'line-opacity-transition': SHAPE_FADE }} />
      </Source>
      <AnimatePresence>
        {points.map((point, index) => {
          const role = rank?.roles[index] ?? 'in';
          return (
            <Marker key={point.digit} longitude={point.lng} latitude={point.lat} anchor="center"
                    onClick={(event) => {
                      event.originalEvent.stopPropagation();
                      pick(point.digit);
                    }}>
              <motion.button
                type="button"
                aria-label={guess?.kind === 'points' && guess.collapsed ? 'Gebruik deze plek' : `Gebruik cijfer ${point.digit}`}
                initial={{ opacity: 0, scale: 0.5 }}
                // The stagger is for entering only; dots leave together
                // The best candidate is drawn 1.25× (scale, so the swap between best and in animates)
                animate={{ opacity: role === 'out' ? 0.4 : 1, scale: role === 'best' ? 1.25 : 1, transition: { duration: 0.2, delay: index * 0.02 } }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                // before: an invisible ~32 px tap target around the 22 px dot
                className={cn(
                  "relative flex size-[22px] cursor-pointer items-center justify-center rounded-full text-[11px] font-bold tabular-nums shadow-md outline-none transition-[background-color,color,box-shadow] duration-200 before:absolute before:-inset-[5px] before:rounded-full before:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  role === 'best' ? 'bg-guess text-card ring-4 ring-guess/30' : 'bg-card text-on-guess-container ring-2 ring-guess',
                )}
              >
                {guess?.kind === 'points' && guess.collapsed ? <CheckIcon aria-hidden className="size-3.5" /> : point.digit}
              </motion.button>
            </Marker>
          );
        })}
      </AnimatePresence>
    </>
  );
}
